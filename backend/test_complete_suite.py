import sys
import os
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def log_step(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_complete_system():
    results = {}

    # -------------------------------------------------------------
    # STEP 0: PREPARE USERS
    # -------------------------------------------------------------
    log_step("STEP 0: Initializing Test Accounts")

    # 1. Patient User
    patient_email = "test_patient_v2@healthly.com"
    patient_pass = "PatientPass123!"
    patient_name = "Alice Patient"

    # Register Patient
    p_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": patient_email,
        "password": patient_pass,
        "full_name": patient_name,
        "role": "patient"
    })
    print(f"Patient register: {p_reg.status_code}")

    # Login Patient
    p_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": patient_email,
        "password": patient_pass
    })
    assert p_login.status_code == 200, f"Patient login failed: {p_login.text}"
    patient_token = p_login.json()["access_token"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    p_me = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=patient_headers).json()
    patient_id = p_me["id"]
    print(f"Patient logged in: ID={patient_id}, Email={patient_email}")

    # 2. Consultant User (Using verified registry number KMC10001 from synthetic seed)
    consultant_email = "dr_aarav_v2@healthly.com"
    consultant_pass = "ConsultPass123!"
    consultant_name = "Dr. Aarav Patel"

    c_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": consultant_email,
        "password": consultant_pass,
        "full_name": consultant_name,
        "role": "consultant",
        "registration_number": "KMC10001",
        "registration_body": "Karnataka Medical Council"
    })
    print(f"Consultant register: {c_reg.status_code}")

    c_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": consultant_email,
        "password": consultant_pass
    })
    assert c_login.status_code == 200, f"Consultant login failed: {c_login.text}"
    consultant_token = c_login.json()["access_token"]
    consultant_headers = {"Authorization": f"Bearer {consultant_token}"}
    c_me = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=consultant_headers).json()
    consultant_id = c_me["id"]
    print(f"Consultant logged in: ID={consultant_id}, Email={consultant_email}, Status={c_me.get('verification_status')}")

    # 3. Admin User
    admin_email = "admin_v2@healthly.com"
    admin_pass = "AdminPass123!"
    admin_name = "Healthly Admin"

    a_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": admin_email,
        "password": admin_pass,
        "full_name": admin_name,
        "role": "admin"
    })
    print(f"Admin register: {a_reg.status_code}")

    # Ensure role is admin in DB directly if register defaults or locks admin
    from app.db.session import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if admin_user:
        admin_user.role = "admin"
        db.commit()
    db.close()

    a_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": admin_email,
        "password": admin_pass
    })
    assert a_login.status_code == 200, f"Admin login failed: {a_login.text}"
    admin_token = a_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    a_me = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=admin_headers).json()
    admin_id = a_me["id"]
    print(f"Admin logged in: ID={admin_id}, Role={a_me.get('role')}")

    results["STEP_0_AUTH"] = "PASSED"

    # -------------------------------------------------------------
    # STEP 1: PATIENT TESTS (PHQ-9, SENSORS, CHAT, MULTIMODAL)
    # -------------------------------------------------------------
    log_step("STEP 1: Testing Patient Endpoints")

    # 1.1 Submit PHQ-9 Assessment
    print("\n--- [1.1] Submitting PHQ-9 Questionnaire ---")
    phq9_payload = {
        "answers": [2, 3, 2, 2, 1, 2, 3, 1, 0]  # Score = 16 (Moderately Severe)
    }
    phq9_res = requests.post(f"{BASE_URL}/api/v1/assessment/phq9", json=phq9_payload, headers=patient_headers)
    assert phq9_res.status_code == 200, f"PHQ-9 submission failed: {phq9_res.text}"
    phq9_data = phq9_res.json()
    print(f"Score: {phq9_data['score']}/27")
    print(f"Risk Level: {phq9_data['risk_level']}")
    print(f"Dominant Emotion: {phq9_data.get('dominant_emotion')}")
    print(f"Mental State: {phq9_data.get('mental_state_label')}")
    print(f"Recommended Action: {phq9_data.get('recommended_action')}")
    assert phq9_data["score"] == 16
    assert phq9_data["risk_level"] in ["Moderately Severe", "Moderate", "High"]
    results["PATIENT_PHQ9_SUBMISSION"] = "PASSED"

    # 1.2 Fetch PHQ-9 History
    print("\n--- [1.2] Fetching PHQ-9 History ---")
    hist_res = requests.get(f"{BASE_URL}/api/v1/assessment/phq9/history", headers=patient_headers)
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert len(hist_data.get("items", [])) >= 1
    latest_assessment_id = hist_data["items"][0]["id"]
    print(f"Found {len(hist_data['items'])} assessment record(s). Latest ID: {latest_assessment_id}")
    results["PATIENT_PHQ9_HISTORY"] = "PASSED"

    # 1.3 Ingest Sensor / Telemetry Data
    print("\n--- [1.3] Ingesting Sensor Data (Google Fit / Manual) ---")
    sensor_payload = {
        "steps": 6420,
        "sleep_hours": 6.8,
        "heart_rate": 78
    }
    sensor_res = requests.post(f"{BASE_URL}/api/auth/google-fit/manual", json=sensor_payload, headers=patient_headers)
    assert sensor_res.status_code == 200, f"Sensor submission failed: {sensor_res.text}"
    print(f"Manual Sensor Result: {sensor_res.json()}")

    # 1.4 Fetch Latest Sensor Reading
    latest_sensor_res = requests.get(f"{BASE_URL}/api/users/{patient_email}/latest", headers=patient_headers)
    assert latest_sensor_res.status_code == 200
    latest_sensor = latest_sensor_res.json()
    print(f"Retrieved Latest Telemetry: Steps={latest_sensor.get('steps')}, Sleep={latest_sensor.get('sleep_hours')}, HR={latest_sensor.get('heart_rate')}")
    assert latest_sensor.get("steps") == 6420
    results["PATIENT_SENSORS"] = "PASSED"

    # 1.5 Test Chatbot Message
    print("\n--- [1.5] Testing Patient AI Chatbot ---")
    chat_payload = {
        "message": "I've been feeling quite overwhelmed with work lately."
    }
    chat_res = requests.post(f"{BASE_URL}/api/v1/chat/message", json=chat_payload, headers=patient_headers)
    assert chat_res.status_code == 200, f"Chat failed: {chat_res.text}"
    chat_data = chat_res.json()
    print(f"Chatbot Reply: {chat_data.get('response', chat_data.get('reply'))[:100]}...")
    results["PATIENT_CHATBOT"] = "PASSED"

    # 1.6 Test Multimodal Assessment Endpoint
    print("\n--- [1.6] Testing Multimodal Comprehensive Assessment ---")
    multi_payload = {
        "phq9_data": {
            "answers": [2, 3, 2, 2, 1, 2, 3, 1, 0],
            "score": 16
        },
        "sensor_data": {
            "heart_rate": 82,
            "sleep_hours": 5.5,
            "steps": 3200
        },
        "demographics": {
            "gender": "female",
            "age_group": "25-35"
        }
    }
    multi_res = requests.post(f"{BASE_URL}/api/v1/multimodal/comprehensive-assessment", json=multi_payload, headers=patient_headers)
    assert multi_res.status_code == 200, f"Multimodal assessment failed: {multi_res.text}"
    multi_data = multi_res.json()
    print(f"Multimodal Risk Score: {multi_data.get('final_risk_score')}")
    print(f"Risk Classification: {multi_data.get('risk_classification')}")
    results["PATIENT_MULTIMODAL"] = "PASSED"

    # -------------------------------------------------------------
    # STEP 2: ADMIN TESTS (STATS, USERS, ASSIGNMENT, MODERATION)
    # -------------------------------------------------------------
    log_step("STEP 2: Testing Admin Endpoints")

    # 2.1 Platform Stats
    print("\n--- [2.1] Fetching Platform Stats ---")
    stats_res = requests.get(f"{BASE_URL}/api/v1/admin/stats", headers=admin_headers)
    assert stats_res.status_code == 200, f"Admin stats failed: {stats_res.text}"
    stats = stats_res.json()
    print(f"Total Users: {stats['total_users']}")
    print(f"Patients: {stats['patients']}, Consultants: {stats['consultants']}, Admins: {stats['admins']}")
    print(f"Assessments All Time: {stats['total_assessments']}")
    print(f"Risk Distribution: {stats['risk_distribution']}")
    assert stats["total_users"] >= 3
    results["ADMIN_STATS"] = "PASSED"

    # 2.2 List Users
    print("\n--- [2.2] Listing All Users ---")
    users_res = requests.get(f"{BASE_URL}/api/v1/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    user_list = users_res.json()["users"]
    print(f"Retrieved {len(user_list)} users.")
    results["ADMIN_USER_MANAGEMENT"] = "PASSED"

    # 2.3 Check Pending Assignments & Assign Patient to Consultant
    print("\n--- [2.3] Patient Assignment System ---")
    pending_res = requests.get(f"{BASE_URL}/api/v1/admin/assignments/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_patients = pending_res.json().get("unassigned_patients", [])
    print(f"Unassigned Patients Count: {len(pending_patients)}")

    # Assign patient to consultant
    assign_payload = {"consultant_id": consultant_id}
    assign_res = requests.post(f"{BASE_URL}/api/v1/admin/assignments/{patient_id}/assign", json=assign_payload, headers=admin_headers)
    assert assign_res.status_code == 200, f"Assignment failed: {assign_res.text}"
    print(f"Assignment result: {assign_res.json()}")
    results["ADMIN_PATIENT_ASSIGNMENT"] = "PASSED"

    # -------------------------------------------------------------
    # STEP 3: CONSULTANT TESTS (QUEUE, PATIENT DETAIL, REVIEW, ACCESS CONTROL)
    # -------------------------------------------------------------
    log_step("STEP 3: Testing Consultant Endpoints")

    # 3.1 Fetch Consultant Triage Queue
    print("\n--- [3.1] Fetching Consultant Triage Queue ---")
    queue_res = requests.get(f"{BASE_URL}/api/v1/consultant/queue", headers=consultant_headers)
    assert queue_res.status_code == 200, f"Consultant queue failed: {queue_res.text}"
    queue_patients = queue_res.json().get("patients", [])
    print(f"Triage Queue Patients: {len(queue_patients)}")
    assigned_match = any(p["id"] == patient_id for p in queue_patients)
    assert assigned_match, f"Assigned patient {patient_id} not found in consultant queue!"
    print(f"✓ Patient {patient_name} (ID: {patient_id}) verified in Consultant Triage Queue.")
    results["CONSULTANT_TRIAGE_QUEUE"] = "PASSED"

    # 3.2 Fetch Patient Clinical Detail
    print("\n--- [3.2] Fetching Clinical Patient Detail ---")
    detail_res = requests.get(f"{BASE_URL}/api/v1/consultant/patient/{patient_id}", headers=consultant_headers)
    assert detail_res.status_code == 200, f"Patient detail failed: {detail_res.text}"
    detail_data = detail_res.json()
    print(f"Patient Name: {detail_data.get('patient', {}).get('full_name')}")
    print(f"Latest Risk: {detail_data.get('latest_assessment', {}).get('risk_level')}")
    results["CONSULTANT_PATIENT_DETAIL"] = "PASSED"

    # 3.3 Fetch Patient Sensor Data via Consultant Portal
    print("\n--- [3.3] Fetching Patient Sensor Telemetry View ---")
    c_sensor_res = requests.get(f"{BASE_URL}/api/v1/admin/patients/{patient_id}/sensor-data", headers=consultant_headers)
    assert c_sensor_res.status_code == 200, f"Consultant sensor view failed: {c_sensor_res.text}"
    print(f"Consultant successfully retrieved sensor data for patient {patient_id}")
    results["CONSULTANT_SENSOR_VIEW"] = "PASSED"

    # 3.4 Submit Clinical Review Note
    print("\n--- [3.4] Submitting Clinical Review Note ---")
    review_payload = {
        "clinical_notes": "Patient reports moderately severe depressive symptoms and work burnout. Recommended weekly CBT check-in and sleep hygiene protocol.",
        "assigned_action": "Schedule follow-up appointment in 7 days."
    }
    review_res = requests.post(f"{BASE_URL}/api/v1/consultant/assessment/{latest_assessment_id}/review", json=review_payload, headers=consultant_headers)
    assert review_res.status_code == 200, f"Review submission failed: {review_res.text}"
    review_data = review_res.json()
    print(f"Review response: Status={review_data.get('status')}, ReviewedBy={review_data.get('reviewed_by')}")
    results["CONSULTANT_CLINICAL_REVIEW"] = "PASSED"

    # 3.5 Test Access Control (Consultant cannot view unauthorized patient)
    print("\n--- [3.5] Testing Role-Based Access Control ---")
    # Register another unassigned patient
    other_patient = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": "unauthorized_p@healthly.com",
        "password": "Pass1234!",
        "full_name": "Unauthorized Patient",
        "role": "patient"
    })
    # Another consultant
    other_cons = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": "dr_sneha_v2@healthly.com",
        "password": "Pass1234!",
        "full_name": "Dr. Sneha Iyer",
        "role": "consultant",
        "registration_number": "RCI20002",
        "registration_body": "Rehabilitation Council of India"
    })
    other_c_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": "dr_sneha_v2@healthly.com",
        "password": "Pass1234!"
    })
    other_c_headers = {"Authorization": f"Bearer {other_c_login.json()['access_token']}"}

    # Dr. Sneha should NOT be allowed to access Alice Patient (assigned to Dr. Aarav)
    unauth_res = requests.get(f"{BASE_URL}/api/v1/admin/patients/{patient_id}/sensor-data", headers=other_c_headers)
    print(f"Unauthorized consultant access check: HTTP {unauth_res.status_code}")
    assert unauth_res.status_code == 403, f"Expected 403 Forbidden, got {unauth_res.status_code}"
    print("✓ Access control strictly enforced: 403 Forbidden received as expected.")
    results["ACCESS_CONTROL_ENFORCEMENT"] = "PASSED"

    # -------------------------------------------------------------
    # FINAL SUMMARY
    # -------------------------------------------------------------
    log_step("TEST SUITE SUMMARY: ALL 3 ROLES VERIFIED")
    print(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    test_complete_system()
