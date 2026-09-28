"""Regression tests using an isolated database, with no external mail access."""

import unittest
from datetime import timedelta
from unittest.mock import patch

from sqlmodel import Session, SQLModel, create_engine, select

from backend.app.models import OutlookAccount, ShareToken, utcnow
from backend.app.routers.public_share import create_share_for_account


class ShareTransactionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.account = OutlookAccount(email="mailbox@example.com")
        self.session.add(self.account)
        self.session.commit()
        self.session.refresh(self.account)
        self.session.add(ShareToken(
            account_id=self.account.id, token="old-token", expires_at=utcnow() + timedelta(days=1),
        ))
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_failed_replacement_keeps_existing_share(self):
        with patch("backend.app.routers.public_share.secrets.token_urlsafe", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                create_share_for_account(self.session, account=self.account, base_url="http://test", days=1)
        self.session.rollback()
        shares = self.session.exec(select(ShareToken)).all()
        self.assertEqual([share.token for share in shares], ["old-token"])

    def test_successful_replacement_leaves_one_share(self):
        result = create_share_for_account(self.session, account=self.account, base_url="http://test/", days=1)
        shares = self.session.exec(select(ShareToken)).all()
        self.assertEqual([share.token for share in shares], [result.token])
        self.assertNotEqual(result.token, "old-token")
        self.assertEqual(result.url, f"http://test/share/{result.token}")


if __name__ == "__main__":
    unittest.main()
