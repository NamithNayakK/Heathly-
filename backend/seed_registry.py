import os
import sys
from datetime import date

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.models.practitioner_registry import VerifiedPractitionerRegistry
from app.models.user import Base

def seed_registry():
    # SYNTHETIC DATA — stands in for a real medical registry API in production, not real practitioner records
    print("Starting synthetic practitioner registry seed...")
    db = SessionLocal()
    
    # Check if we already seeded
    count = db.query(VerifiedPractitionerRegistry).count()
    if count > 0:
        print(f"Registry already contains {count} records. Skipping seed.")
        db.close()
        return

    synthetic_practitioners = [
        {"registration_number": "KMC10001", "full_name": "Dr. Aarav Patel", "registration_body": "Karnataka Medical Council", "specialization": "Psychiatry", "status": "active", "issued_date": date(2015, 5, 12)},
        {"registration_number": "RCI20002", "full_name": "Dr. Sneha Iyer", "registration_body": "Rehabilitation Council of India", "specialization": "Clinical Psychology", "status": "active", "issued_date": date(2018, 8, 22)},
        {"registration_number": "DMC30003", "full_name": "Dr. Rajesh Sharma", "registration_body": "Delhi Medical Council", "specialization": "Psychiatry", "status": "active", "issued_date": date(2010, 11, 5)},
        {"registration_number": "MMC40004", "full_name": "Dr. Ananya Desai", "registration_body": "Maharashtra Medical Council", "specialization": "Counseling", "status": "active", "issued_date": date(2020, 1, 15)},
        {"registration_number": "TMC50005", "full_name": "Dr. Vikram Singh", "registration_body": "Tamil Nadu Medical Council", "specialization": "Psychiatry", "status": "revoked", "issued_date": date(2005, 3, 30)},
        {"registration_number": "KMC10006", "full_name": "Dr. Priya Reddy", "registration_body": "Karnataka Medical Council", "specialization": "Clinical Psychology", "status": "active", "issued_date": date(2017, 6, 18)},
        {"registration_number": "RCI20007", "full_name": "Dr. Arjun Menon", "registration_body": "Rehabilitation Council of India", "specialization": "Psychiatry", "status": "active", "issued_date": date(2019, 9, 10)},
        {"registration_number": "DMC30008", "full_name": "Dr. Kavita Verma", "registration_body": "Delhi Medical Council", "specialization": "Counseling", "status": "suspended", "issued_date": date(2012, 12, 1)},
        {"registration_number": "MMC40009", "full_name": "Dr. Sanjay Gupta", "registration_body": "Maharashtra Medical Council", "specialization": "Psychiatry", "status": "active", "issued_date": date(2014, 4, 25)},
        {"registration_number": "TMC50010", "full_name": "Dr. Lakshmi Nair", "registration_body": "Tamil Nadu Medical Council", "specialization": "Clinical Psychology", "status": "active", "issued_date": date(2021, 2, 14)},
        {"registration_number": "KMC10011", "full_name": "Dr. Rahul Joshi", "registration_body": "Karnataka Medical Council", "specialization": "Counseling", "status": "active", "issued_date": date(2016, 7, 8)},
        {"registration_number": "RCI20012", "full_name": "Dr. Neha Kapoor", "registration_body": "Rehabilitation Council of India", "specialization": "Psychiatry", "status": "active", "issued_date": date(2011, 10, 19)},
        {"registration_number": "DMC30013", "full_name": "Dr. Anil Kumar", "registration_body": "Delhi Medical Council", "specialization": "Clinical Psychology", "status": "revoked", "issued_date": date(2008, 5, 3)},
        {"registration_number": "MMC40014", "full_name": "Dr. Meera Chopra", "registration_body": "Maharashtra Medical Council", "specialization": "Counseling", "status": "active", "issued_date": date(2019, 11, 27)},
        {"registration_number": "TMC50015", "full_name": "Dr. Rohan Das", "registration_body": "Tamil Nadu Medical Council", "specialization": "Psychiatry", "status": "active", "issued_date": date(2013, 8, 12)},
        {"registration_number": "KMC10016", "full_name": "Dr. Swati Mishra", "registration_body": "Karnataka Medical Council", "specialization": "Clinical Psychology", "status": "active", "issued_date": date(2022, 3, 21)},
        {"registration_number": "RCI20017", "full_name": "Dr. Amit Agarwal", "registration_body": "Rehabilitation Council of India", "specialization": "Counseling", "status": "active", "issued_date": date(2015, 9, 4)},
        {"registration_number": "DMC30018", "full_name": "Dr. Puja Bhatt", "registration_body": "Delhi Medical Council", "specialization": "Psychiatry", "status": "active", "issued_date": date(2018, 1, 30)},
        {"registration_number": "MMC40019", "full_name": "Dr. Sunil Patil", "registration_body": "Maharashtra Medical Council", "specialization": "Clinical Psychology", "status": "active", "issued_date": date(2010, 6, 15)},
        {"registration_number": "TMC50020", "full_name": "Dr. Divya Rao", "registration_body": "Tamil Nadu Medical Council", "specialization": "Counseling", "status": "suspended", "issued_date": date(2017, 12, 8)},
    ]

    for record in synthetic_practitioners:
        entry = VerifiedPractitionerRegistry(**record)
        db.add(entry)

    db.commit()
    print(f"Successfully inserted {len(synthetic_practitioners)} synthetic practitioners.")
    db.close()

if __name__ == "__main__":
    seed_registry()
