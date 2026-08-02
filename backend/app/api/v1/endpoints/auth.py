from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.models.practitioner_registry import VerifiedPractitionerRegistry
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserProfileResponse
from datetime import datetime
import re

def normalize_string(s):
    if not s: return ""
    return re.sub(r'\s+', ' ', s).strip().lower()

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.role == "consultant":
        reg_number = payload.registration_number
        reg_body = payload.registration_body
        if not reg_number or not reg_body:
            raise HTTPException(status_code=400, detail="Registration number and body are required for consultants")
        
        registry_entry = db.query(VerifiedPractitionerRegistry).filter(VerifiedPractitionerRegistry.registration_number == reg_number).first()
        if not registry_entry:
            verification_status = "rejected"
            verification_reason = "Registration number not found in registry"
        elif normalize_string(registry_entry.full_name) != normalize_string(payload.full_name):
            verification_status = "rejected"
            verification_reason = "Name does not match registry record"
        elif registry_entry.status in ("suspended", "revoked"):
            verification_status = "rejected"
            verification_reason = f"Registration is {registry_entry.status}"
        else:
            verification_status = "approved"
            verification_reason = None
            
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=get_password_hash(payload.password),
            role="consultant",
            registration_number=reg_number,
            registration_body=reg_body,
            verification_status=verification_status,
            verification_reason=verification_reason,
            verified_at=datetime.utcnow() if verification_status == "approved" else None,
            verified_by="automated_registry_check" if verification_status == "approved" else None,
        )
    else:
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=get_password_hash(payload.password),
            role=payload.role or "patient",
        )
        
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    return TokenResponse(
        access_token=token, 
        user_email=user.email, 
        full_name=user.full_name, 
        role=user.role or "patient",
        verification_status=user.verification_status,
        verification_reason=user.verification_reason
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=user.email)
    return TokenResponse(
        access_token=token, 
        user_email=user.email, 
        full_name=user.full_name, 
        role=user.role or "patient",
        verification_status=user.verification_status,
        verification_reason=user.verification_reason
    )


@router.get("/me", response_model=UserProfileResponse)
def me(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        id=current_user.id, 
        email=current_user.email, 
        full_name=current_user.full_name, 
        role=current_user.role or "patient",
        verification_status=current_user.verification_status,
        verification_reason=current_user.verification_reason
    )
