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


def get_data_cipher():
    from cryptography.fernet import Fernet
    key = settings.data_encryption_key
    if not key:
        raise ValueError("DATA_ENCRYPTION_KEY environment variable is required.")
    return Fernet(key.encode("utf-8"))


def get_token_fernet():
    """Returns primary data cipher, with fallback capability for legacy tokens."""
    return get_data_cipher()


def encrypt_data(plain_text: str | None) -> str | None:
    """Encrypts plain text string using DATA_ENCRYPTION_KEY via Fernet."""
    if not plain_text:
        return plain_text
    cipher = get_data_cipher()
    return cipher.encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_data(cipher_text: str | None) -> str | None:
    """
    Decrypts ciphertext string using DATA_ENCRYPTION_KEY.
    Gracefully falls back to plain text if string is not encrypted (backward compatibility).
    """
    if not cipher_text:
        return cipher_text

    from cryptography.fernet import InvalidToken

    cipher = get_data_cipher()
    try:
        return cipher.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except (InvalidToken, binascii.Error, ValueError):
        # Backward compatibility: text was stored before encryption was enabled
        return cipher_text


def encrypt_token(token: str) -> str:
    if not token:
        return ""
    return encrypt_data(token) or ""


def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return ""

    from cryptography.fernet import Fernet, InvalidToken

    # First attempt with modern DATA_ENCRYPTION_KEY
    try:
        return get_data_cipher().decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except Exception:
        pass

    # Fallback to legacy secret_key derivation for tokens encrypted before separation
    try:
        key_bytes = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
        legacy_key = base64.urlsafe_b64encode(key_bytes)
        return Fernet(legacy_key).decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, binascii.Error, ValueError):
        return encrypted_token

