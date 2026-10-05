from sqlalchemy import String, Text, TypeDecorator
from app.core.security import encrypt_data, decrypt_data


class EncryptedText(TypeDecorator):
    """
    SQLAlchemy type decorator that transparently encrypts text on save
    and decrypts on load using Fernet (AES-128-CBC + HMAC).
    Underlying database column is standard Text.
    """
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_data(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_data(str(value))


class EncryptedString(TypeDecorator):
    """
    SQLAlchemy type decorator for bounded strings that transparently encrypts
    on save and decrypts on load. Underlying database column is String.
    """
    impl = String
    cache_ok = True

    def __init__(self, length: int = 1000, **kwargs):
        super().__init__(length=length, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_data(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_data(str(value))
