from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login", auto_error=False)


def get_or_create_guest_user(db: Session) -> User:
    guest_email = "guest@healthly.local"
    guest = db.query(User).filter(User.email == guest_email).first()
    if guest:
        return guest

    guest = User(
        email=guest_email,
        full_name="Guest User",
        hashed_password=get_password_hash("guest_password_not_used"),
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if token:
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
            subject = payload.get("sub")
            if subject:
                user = db.query(User).filter(User.email == subject).first()
                if user:
                    return user
        except JWTError:
            pass

    return get_or_create_guest_user(db)
