import requests
import json
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
import time

base_url = 'http://localhost:8000/api/v1/auth/register'

test_cases = [
    {
        'full_name': 'Dr. Aarav Patel',
        'email': 'aarav@test.com',
        'password': 'password123',
        'role': 'consultant',
        'registration_number': 'KMC10001',
        'registration_body': 'Karnataka Medical Council'
    },
    {
        'full_name': 'Dr. Fake',
        'email': 'fake@test.com',
        'password': 'password123',
        'role': 'consultant',
        'registration_number': 'XXX9999',
        'registration_body': 'Fake Body'
    },
    {
        'full_name': 'Dr. Vikram Singh',
        'email': 'vikram@test.com',
        'password': 'password123',
        'role': 'consultant',
        'registration_number': 'TMC50005',
        'registration_body': 'Tamil Nadu Medical Council'
    },
    {
        'full_name': 'Dr. Bob Iyer',
        'email': 'bob@test.com',
        'password': 'password123',
        'role': 'consultant',
        'registration_number': 'RCI20002',
        'registration_body': 'Rehabilitation Council of India'
    }
]

# Delete these users if they exist to allow re-running
db = SessionLocal()
db.query(User).filter(User.email.in_([c['email'] for c in test_cases])).delete(synchronize_session=False)
db.commit()

print("--- REGISTRATION RESPONSES ---")
for i, case in enumerate(test_cases, 1):
    r = requests.post(base_url, json=case)
    print(f"Test {i}: {case['registration_number']}")
    data = r.json()
    # Strip the access token for cleaner output
    if 'access_token' in data:
        data['access_token'] = '***'
    print(f"Status Code: {r.status_code}")
    print(f"Response: {json.dumps(data, indent=2)}")
    print("-" * 40)

time.sleep(1)

print("\n--- DATABASE ROWS ---")
users = db.query(User).filter(User.email.in_([c['email'] for c in test_cases])).all()
for u in users:
    print(f"Name: {u.full_name}")
    print(f"Email: {u.email}")
    print(f"Role: {u.role}")
    print(f"Verification Status: {u.verification_status}")
    print(f"Verification Reason: {u.verification_reason}")
    print(f"Verified By: {u.verified_by}")
    print("-" * 40)

db.close()
