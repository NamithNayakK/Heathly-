import base64
import binascii
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings

ALGORITHM = "HS256"
PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 390000
PBKDF2_PREFIX = "pbkdf2_sha256"


def _encode_bytes(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _decode_bytes(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def _verify_pbkdf2_password(plain_password: str, hashed_password: str) -> bool:
    try:
        prefix, iterations_str, salt_b64, digest_b64 = hashed_password.split("$", 3)
        if prefix != PBKDF2_PREFIX:
            return False

        iterations = int(iterations_str)
        salt = _decode_bytes(salt_b64)
        expected_digest = _decode_bytes(digest_b64)

        computed_digest = hashlib.pbkdf2_hmac(
            PBKDF2_ALGORITHM,
            plain_password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(computed_digest, expected_digest)
    except (ValueError, binascii.Error):
        return False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(f"{PBKDF2_PREFIX}$"):
        return _verify_pbkdf2_password(plain_password, hashed_password)

    try:
        from passlib.context import CryptContext

        legacy_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")
        return legacy_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}${_encode_bytes(salt)}${_encode_bytes(digest)}"


def create_access_token(subject: str) -> str:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def get_token_fernet():
    from cryptography.fernet import Fernet
    key_bytes = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_token(token: str) -> str:
    if not token:
        return ""
    f = get_token_fernet()
    return f.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return ""
    f = get_token_fernet()
    return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")

