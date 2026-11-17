"""Regression tests for mailbox visibility, credential imports and OAuth errors."""

import unittest
from unittest.mock import MagicMock, Mock, patch

from sqlmodel import Session, SQLModel, create_engine, select

from backend.app import database
from backend.app.models import AccountSiteUsage, OutlookAccount, Site
from backend.app.routers import accounts
from backend.app.schemas import BatchUpdateAccountsRequest, ImportAccountsRequest, UpdateAccountRequest
from backend.app.services.outlook_service import OutlookService


class AccountManagementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.admin = patch.object(accounts, "require_admin_authorization")
        self.admin.start()

    def tearDown(self):
        self.admin.stop()
        self.session.close()
        self.engine.dispose()

    def test_oauth_only_import_and_existing_credentials_are_preserved(self):
        account = OutlookAccount(email="a@example.com", password="old", client_id="app", refresh_token="token", enabled=False, batch_code="old", show_in_station=True)
        self.session.add(account)
        self.session.commit()
        result = accounts.import_accounts(ImportAccountsRequest(data="a@example.com----new"), session=self.session)
        self.session.refresh(account)
        self.assertEqual(result.updated, 1)
        self.assertEqual((account.password, account.client_id, account.refresh_token), ("new", "app", "token"))
        self.assertEqual((account.enabled, account.batch_code, account.show_in_station), (False, "old", True))
        result = accounts.import_accounts(ImportAccountsRequest(data="b@example.com----app----token"), session=self.session)
        created = self.session.exec(select(OutlookAccount).where(OutlookAccount.email == "b@example.com")).one()
        self.assertEqual(result.created, 1)
        self.assertEqual((created.password, created.client_id, created.refresh_token, created.show_in_station), ("", "app", "token", False))
        self.assertIsNone(accounts._parse_import_line("b@example.com----password----app----"))

    def test_station_visibility_does_not_release_site_usage(self):
        site = Site(code="SHOP", name="Shop")
        account = OutlookAccount(email="a@example.com", password="secret", show_in_station=True)
        self.session.add(site)
        self.session.add(account)
        self.session.commit()
        usage = AccountSiteUsage(account_id=account.id, site_id=site.id, user_id=0)
        self.session.add(usage)
        self.session.commit()
        accounts.update_account(account.id, UpdateAccountRequest(show_in_station=False), session=self.session)
        self.session.refresh(usage)
        self.assertIsNone(usage.released_at)
        self.assertEqual(len(accounts._collect_visible_accounts(self.session, "", "all", "", "", include_disabled=True)), 1)
        self.assertEqual(len(accounts._collect_visible_accounts(self.session, "", "all", "", "", station_only=True)), 0)
        item = accounts._collect_visible_accounts(self.session, "", "all", "", "")[0]
        self.assertEqual(item.password, "")
        self.assertTrue(item.has_password)
        accounts.batch_update_accounts(BatchUpdateAccountsRequest(account_ids=[account.id], show_in_station=True), session=self.session)
        self.session.refresh(usage)
        self.assertIsNone(usage.released_at)
        self.assertEqual(len(accounts._collect_visible_accounts(self.session, "", "all", "", "", station_only=True)), 1)

    def test_disabled_accounts_are_visible_in_management(self):
        self.session.add(OutlookAccount(email="disabled@example.com", enabled=False))
        self.session.commit()
        self.assertEqual(len(accounts._collect_visible_accounts(self.session, "", "all", "", "")), 0)
        self.assertEqual(len(accounts._collect_visible_accounts(self.session, "", "all", "", "", include_disabled=True)), 1)

    def test_legacy_database_visibility_defaults_to_visible(self):
        engine = create_engine("sqlite://")
        with engine.begin() as conn:
            conn.exec_driver_sql("CREATE TABLE outlook_accounts (id INTEGER PRIMARY KEY, email TEXT)")
            conn.exec_driver_sql("CREATE TABLE sites (id INTEGER PRIMARY KEY, code TEXT)")
            conn.exec_driver_sql("INSERT INTO outlook_accounts (id, email) VALUES (1, 'old@example.com')")
        with patch.object(database, "engine", engine):
            database._ensure_outlook_account_columns()
        with engine.connect() as conn:
            self.assertEqual(conn.exec_driver_sql("SELECT show_in_station FROM outlook_accounts").scalar(), 1)
        engine.dispose()


class OAuthFailureTests(unittest.TestCase):
    def test_missing_oauth_never_falls_back_to_password(self):
        service = OutlookService(OutlookAccount(email="a@example.com", password="secret"))
        with patch("backend.app.services.outlook_service.imaplib.IMAP4_SSL") as imap:
            with self.assertRaisesRegex(RuntimeError, "缺少 OAuth"):
                service._open_imap_connection()
            imap.assert_not_called()

    def test_refresh_failure_reports_safe_error_code(self):
        service = OutlookService(OutlookAccount(email="a@example.com", client_id="app", refresh_token="secret"))
        response = Mock(status_code=400)
        response.json.return_value = {"error": "invalid_grant", "error_description": "secret"}
        client = MagicMock()
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=False)
        client.post.return_value = response
        with patch("backend.app.services.outlook_service.httpx.Client", return_value=client):
            with self.assertRaisesRegex(RuntimeError, "invalid_grant") as error:
                service._open_imap_connection()
        self.assertNotIn("secret", str(error.exception))


if __name__ == "__main__":
    unittest.main()
