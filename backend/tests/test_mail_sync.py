"""Offline regression tests for IMAP synchronization and transaction recovery."""

import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from backend.app.models import MailMessage, OutlookAccount, StationUser
from backend.app.routers import messages as message_routes
from backend.app.services import mail_sync_service
from backend.app.services.outlook_service import FolderSyncResult, OutlookService, SyncedMessage


class ImapSyncTests(unittest.TestCase):
    def setUp(self):
        self.service = OutlookService(OutlookAccount(email="mailbox@example.com"))
        self.connection = Mock()

    def test_select_quotes_folder_names_with_spaces(self):
        self.connection.select.side_effect = lambda name, **kwargs: (
            ("OK", [b"1"]) if name == '"Sent Items"' else ("NO", [])
        )
        self.connection.list.return_value = ("OK", [])
        self.assertEqual(self.service._select_folder(self.connection, "sent"), "Sent Items")

    def test_incremental_search_ignores_old_uid_returned_by_star_range(self):
        self.connection.uid.return_value = ("OK", [b"90"])
        self.assertEqual(
            self.service._search_folder_message_ids(self.connection, last_uid=100),
            ([], 100),
        )

    def test_incremental_search_sorts_uids_and_keeps_new_messages(self):
        self.connection.uid.return_value = ("OK", [b"105 99 101"])
        self.assertEqual(
            self.service._search_folder_message_ids(self.connection, last_uid=100),
            ([b"101", b"105"], 105),
        )

    def test_fallback_search_does_not_move_cursor_backwards(self):
        self.connection.uid.side_effect = [("NO", []), ("OK", [b"80 90"])]
        self.assertEqual(
            self.service._search_folder_message_ids(self.connection, last_uid=100),
            ([], 100),
        )

    def test_failed_search_is_not_reported_as_empty_mailbox(self):
        self.connection.uid.return_value = ("NO", [b"search failed"])
        with self.assertRaises(RuntimeError):
            self.service._search_folder_message_ids(self.connection)

    def test_failed_fetch_does_not_silently_skip_a_message(self):
        self.connection.uid.return_value = ("NO", [b"fetch failed"])
        with self.assertRaises(RuntimeError):
            self.service._fetch_single_message(self.connection, b"101", "inbox")


class SyncTransactionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.account = OutlookAccount(email="mailbox@example.com", inbox_last_uid=10)
        self.session.add(self.account)
        self.session.commit()
        self.session.refresh(self.account)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def fail_database_write(self, session, account, **kwargs):
        account.inbox_last_uid = 20
        session.add(OutlookAccount(email=account.email))
        session.flush()

    def test_failed_write_rolls_back_and_preserves_original_exception(self):
        with patch.object(mail_sync_service, "_sync_account_mailbox_locked", self.fail_database_write):
            with self.assertRaises(IntegrityError):
                mail_sync_service.sync_account_mailbox(self.session, self.account)
        self.session.refresh(self.account)
        self.assertEqual(self.account.inbox_last_uid, 10)
        self.assertTrue(self.account.last_error)
        self.assertEqual(len(self.session.exec(select(OutlookAccount)).all()), 1)

    def test_failed_write_can_fall_back_to_cached_mail(self):
        self.session.add(MailMessage(
            account_id=self.account.id, folder="inbox", message_key="cached-message",
        ))
        self.session.commit()
        with patch.object(mail_sync_service, "_sync_account_mailbox_locked", self.fail_database_write):
            result = mail_sync_service.maybe_sync_account_mailbox(
                self.session, self.account, allow_stale_on_error=True,
            )
        self.assertIsNone(result)
        self.assertEqual(self.account.inbox_last_uid, 10)

    def test_sync_keeps_new_and_cached_mail_with_other_recipients(self):
        self.session.add(MailMessage(
            account_id=self.account.id, folder="inbox", message_key="cached-list-mail",
            recipient_summary="list@example.com",
        ))
        self.session.commit()
        with patch.object(mail_sync_service, "OutlookService") as service_class:
            service = service_class.return_value
            service.refresh_token_for_storage.return_value = ""
            service.fetch_mailbox_messages.return_value = {
                "inbox": FolderSyncResult("inbox", "INBOX", [SyncedMessage(
                    folder="inbox", message_key="new-bcc-mail", remote_uid="11",
                    internet_message_id="<bcc@example.com>", sender_name="Sender",
                    sender_email="sender@example.com", recipient_summary="other@example.com",
                    subject="Bcc delivery", preview="body", body_text="body", body_html="",
                    sent_at=None,
                )], 11),
            }
            mail_sync_service.sync_account_mailbox(self.session, self.account, folders=("inbox",))
        cached = self.session.exec(select(MailMessage)).all()
        self.assertEqual({item.message_key for item in cached}, {"cached-list-mail", "new-bcc-mail"})
        self.assertTrue(all(item.account_id == self.account.id for item in cached))

    def test_list_and_detail_allow_other_recipient_headers(self):
        self.account.owner_user_id = 7
        self.session.add(self.account)
        message = MailMessage(
            account_id=self.account.id, folder="inbox", message_key="alias-mail",
            recipient_summary="alias@example.com", body_text="Alias delivery",
        )
        self.session.add(message)
        self.session.commit()
        user = StationUser(id=7, username="owner", role="user")
        with patch.object(message_routes, "require_admin_authorization", return_value=user):
            items = message_routes.list_messages(
                self.account.id, folder="inbox", authorization=None, session=self.session,
            )
            self.assertEqual([item.id for item in items], [message.id])
            detail = message_routes.get_account_message(
                self.account.id, message.id, authorization=None, session=self.session,
            )
            self.assertEqual(detail.body_text, "Alias delivery")

    def test_detail_still_rejects_a_message_from_another_mailbox(self):
        self.account.owner_user_id = 7
        other_account = OutlookAccount(email="other@example.com", owner_user_id=7)
        self.session.add_all([self.account, other_account])
        self.session.commit()
        message = MailMessage(
            account_id=other_account.id, folder="inbox", message_key="other-mailbox",
            recipient_summary=self.account.email,
        )
        self.session.add(message)
        self.session.commit()
        user = StationUser(id=7, username="owner", role="user")
        with patch.object(message_routes, "require_admin_authorization", return_value=user):
            with self.assertRaises(HTTPException) as raised:
                message_routes.get_account_message(
                    self.account.id, message.id, authorization=None, session=self.session,
                )
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
