from sqlalchemy import Column, Date, Integer, String
from app.db.session import Base

class VerifiedPractitionerRegistry(Base):
    __tablename__ = "verified_practitioners_registry"

    id = Column(Integer, primary_key=True, index=True)
    registration_number = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    registration_body = Column(String(255), nullable=False)
    specialization = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False) # "active", "suspended", "revoked"
    issued_date = Column(Date, nullable=True)
