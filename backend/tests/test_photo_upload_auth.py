import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from routes import products


class PhotoUploadAuthTests(unittest.TestCase):
    def test_firebase_token_is_verified_for_configured_project(self):
        claims = {"sub": "kirana_4", "aud": products.FIREBASE_PROJECT_ID}
        with patch.object(products.id_token, "verify_firebase_token", return_value=claims) as verify:
            self.assertEqual(products.verify_firebase_photo_token("signed-token"), claims)
        self.assertEqual(verify.call_args.kwargs["audience"], products.FIREBASE_PROJECT_ID)

    def test_invalid_firebase_token_is_rejected(self):
        with patch.object(products.id_token, "verify_firebase_token", side_effect=ValueError("invalid")):
            with self.assertRaises(HTTPException) as raised:
                products.verify_firebase_photo_token("invalid-token")
        self.assertEqual(raised.exception.status_code, 401)

    def test_legacy_render_session_remains_supported(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="render-token")
        render_user = object()
        with patch.object(products, "get_current_user_dep", return_value=render_user), \
                patch.object(products, "verify_firebase_photo_token") as verify_firebase:
            result = products.get_photo_upload_user(credentials, object())
        self.assertIs(result, render_user)
        verify_firebase.assert_not_called()

    def test_firebase_session_is_accepted_when_render_jwt_is_not_valid(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="firebase-token")
        claims = {"sub": "kirana_4"}
        with patch.object(products, "get_current_user_dep", side_effect=HTTPException(status_code=401)), \
                patch.object(products, "verify_firebase_photo_token", return_value=claims):
            result = products.get_photo_upload_user(credentials, object())
        self.assertEqual(result, claims)

    def test_missing_credentials_are_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            products.get_photo_upload_user(None, object())
        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
