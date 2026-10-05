import sys
import os
import requests
import json
import time
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:8000"

def log_header(title):
    print("\n" + "=" * 65, flush=True)
    print(f"  {title}", flush=True)
    print("=" * 65, flush=True)

def run_all_tests():
    ts = int(time.time())
    summary = {}

    # =========================================================================
    # 1. PATIENT TESTING
    # =========================================================================
    log_header("1. TESTING PATIENT FLOW")
    p_email = f"patient_{ts}@healthly.com"
    p_pass = "PatientPass123!"
    p_name = f"Alice Patient {ts}"

    # 1.1 Register & Login
    r_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": p_email,
        "password": p_pass,
        "full_name": p_name,
        "role": "patient"
    })
    print(f"[Patient Auth] Register: {r_reg.status_code}", flush=True)
    assert r_reg.status_code == 201

    r_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": p_email,
        "password": p_pass
    })
    print(f"[Patient Auth] Login: {r_login.status_code}", flush=True)
    assert r_login.status_code == 200
    p_token = r_login.json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    me_res = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=p_headers)
    p_id = me_res.json()["id"]
    print(f"[Patient Auth] ID={p_id}, Name='{p_name}', Email='{p_email}'", flush=True)
    summary["PATIENT_AUTH"] = "PASSED"

    # 1.2 Telemetry & Sensors
    print("\n[Patient Sensors] Submitting manual telemetry...", flush=True)
    sensor_res = requests.post(f"{BASE_URL}/api/auth/google-fit/manual?user_id={p_id}", json={
        "steps": 9200,
        "sleep_hours": 7.5,
        "heart_rate": 72
    }, headers=p_headers)
    assert sensor_res.status_code == 200
    print(f"[Patient Sensors] Manual telemetry saved: {sensor_res.json()['data']['risk_level']} risk", flush=True)

    latest_res = requests.get(f"{BASE_URL}/api/users/{p_id}/latest", headers=p_headers)
    assert latest_res.status_code == 200
    latest_data = latest_res.json()
    print(f"[Patient Sensors] Verified latest: Steps={latest_data['steps']}, Sleep={latest_data['sleep_hours']}h, HR={latest_data['heart_rate']} bpm", flush=True)
    summary["PATIENT_SENSORS"] = "PASSED"

    # 1.3 PHQ-9 Questionnaire Submission
    print("\n[Patient PHQ-9] Submitting PHQ-9 depression screening...", flush=True)
    phq9_payload = {"answers": [2, 3, 2, 2, 1, 2, 2, 1, 0]} # Score = 15 (Moderately Severe)
    phq9_res = requests.post(f"{BASE_URL}/api/v1/assessment/phq9", json=phq9_payload, headers=p_headers)
    assert phq9_res.status_code == 200
    phq9_data = phq9_res.json()
    assessment_id = phq9_data.get("id")
    print(f"[Patient PHQ-9] Score: {phq9_data['score']}/27, Risk Level: {phq9_data['risk_level']}", flush=True)
    print(f"[Patient PHQ-9] Dominant Emotion: {phq9_data.get('dominant_emotion')}, Mental State: {phq9_data.get('mental_state_label')}", flush=True)
    print(f"[Patient PHQ-9] Action Recommendation: {phq9_data.get('recommended_action')}", flush=True)
    summary["PATIENT_PHQ9_ASSESSMENT"] = "PASSED"

    # 1.4 PHQ-9 Assessment History
    hist_res = requests.get(f"{BASE_URL}/api/v1/assessment/phq9/history", headers=p_headers)
    assert hist_res.status_code == 200
    items = hist_res.json().get("items", [])
    assert len(items) >= 1
    assessment_id = items[0]["id"]
    print(f"[Patient History] Found {len(items)} assessment record(s). Latest assessment ID: {assessment_id}", flush=True)
    summary["PATIENT_ASSESSMENT_HISTORY"] = "PASSED"

    # 1.5 Chatbot Interaction
    print("\n[Patient Chatbot] Testing mental health AI assistant...", flush=True)
    chat_res = requests.post(f"{BASE_URL}/api/v1/chat/message", json={
        "message": "I feel tired and a bit anxious about my deadlines."
    }, headers=p_headers)
    assert chat_res.status_code == 200
    chat_reply = chat_res.json().get("response", chat_res.json().get("reply", "OK"))
    print(f"[Patient Chatbot] Assistant response: {chat_reply[:120]}...", flush=True)
    summary["PATIENT_CHATBOT"] = "PASSED"

    # 1.6 Unified Multimodal Dashboard
    print("\n[Patient Dashboard] Fetching multimodal clinical wellness dashboard...", flush=True)
    dash_res = requests.get(f"{BASE_URL}/api/v1/multimodal/dashboard", headers=p_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    print(f"[Patient Dashboard] Active Modes: {dash_data.get('modes_active')}", flush=True)
    print(f"[Patient Dashboard] Unified Wellness Index: {dash_data.get('unified_wellness_index')}%", flush=True)
    print(f"[Patient Dashboard] Risk Classification: {dash_data.get('risk_classification')}", flush=True)
    summary["PATIENT_MULTIMODAL_DASHBOARD"] = "PASSED"


    # =========================================================================
    # 2. CONSULTANT TESTING
    # =========================================================================
    log_header("2. TESTING CONSULTANT FLOW")
    c_email = f"dr_aarav_{ts}@healthly.com"
    c_pass = "ConsultPass123!"
    c_name = "Dr. Aarav Patel"

    # 2.1 Registration with Medical Registry Verification
    print("[Consultant Auth] Registering with Karnataka Medical Council (KMC10001)...", flush=True)
    c_reg = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": c_email,
        "password": c_pass,
        "full_name": c_name,
        "role": "consultant",
        "registration_number": "KMC10001",
        "registration_body": "Karnataka Medical Council"
    })
    print(f"[Consultant Auth] Register: {c_reg.status_code}", flush=True)
    assert c_reg.status_code == 201
    reg_body = c_reg.json()
    print(f"[Consultant Auth] Verification Status: {reg_body.get('verification_status')}", flush=True)
    assert reg_body.get("verification_status") == "approved"

    # 2.2 Login
    c_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": c_email,
        "password": c_pass
    })
    assert c_login.status_code == 200
    c_token = c_login.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}
    c_id = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=c_headers).json()["id"]
    print(f"[Consultant Auth] Logged in: ID={c_id}, Dr. Aarav Patel (Verified)", flush=True)
    summary["CONSULTANT_AUTH_AND_VERIFICATION"] = "PASSED"


    # =========================================================================
    # 3. ADMIN TESTING
    # =========================================================================
    log_header("3. TESTING ADMIN FLOW")
    a_email = f"admin_{ts}@healthly.com"
    a_pass = "AdminPass123!"
    a_name = f"Healthly Admin {ts}"

    # 3.1 Register and promote to admin
    requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": a_email,
        "password": a_pass,
        "full_name": a_name,
        "role": "admin"
    })
    # Ensure role in DB
    from app.db.session import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    admin_row = db.query(User).filter(User.email == a_email).first()
    if admin_row:
        admin_row.role = "admin"
        db.commit()
    db.close()

    a_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": a_email,
        "password": a_pass
    })
    assert a_login.status_code == 200
    a_token = a_login.json()["access_token"]
    a_headers = {"Authorization": f"Bearer {a_token}"}
    print(f"[Admin Auth] Logged in: {a_email} (Role: admin)", flush=True)
    summary["ADMIN_AUTH"] = "PASSED"

    # 3.2 Platform Stats
    print("\n[Admin Stats] Fetching platform aggregate statistics...", flush=True)
    stats_res = requests.get(f"{BASE_URL}/api/v1/admin/stats", headers=a_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    print(f"[Admin Stats] Total Users: {stats['total_users']} (Patients: {stats['patients']}, Consultants: {stats['consultants']}, Admins: {stats['admins']})", flush=True)
    print(f"[Admin Stats] Total Assessments: {stats['total_assessments']}, Sensor Records: {stats['total_sensor_records']}", flush=True)
    print(f"[Admin Stats] Risk Distribution: {stats['risk_distribution']}", flush=True)
    summary["ADMIN_PLATFORM_STATS"] = "PASSED"

    # 3.3 List Users
    print("\n[Admin Users] Fetching user directory...", flush=True)
    users_res = requests.get(f"{BASE_URL}/api/v1/admin/users", headers=a_headers)
    assert users_res.status_code == 200
    print(f"[Admin Users] Retrieved {len(users_res.json()['users'])} platform users.", flush=True)
    summary["ADMIN_USER_MANAGEMENT"] = "PASSED"

    # 3.4 Patient-Consultant Manual Assignment System
    print("\n[Admin Assignment] Checking pending unassigned patients...", flush=True)
    pending_res = requests.get(f"{BASE_URL}/api/v1/admin/assignments/pending", headers=a_headers)
    assert pending_res.status_code == 200
    unassigned = pending_res.json().get("unassigned_patients", [])
    print(f"[Admin Assignment] Unassigned patients count: {len(unassigned)}", flush=True)

    print(f"[Admin Assignment] Assigning patient {p_id} ({p_name}) -> Consultant {c_id} ({c_name})...", flush=True)
    assign_res = requests.post(f"{BASE_URL}/api/v1/admin/assignments/{p_id}/assign", json={
        "consultant_id": c_id
    }, headers=a_headers)
    assert assign_res.status_code == 200
    print(f"[Admin Assignment] Assignment confirmed: {assign_res.json()}", flush=True)
    summary["ADMIN_PATIENT_ASSIGNMENT"] = "PASSED"


    # =========================================================================
    # 4. CONSULTANT CLINICAL WORKFLOW & ACCESS CONTROL
    # =========================================================================
    log_header("4. TESTING CONSULTANT CLINICAL WORKFLOW")

    # 4.1 Triage Queue
    print("[Consultant Triage] Fetching consultant patient queue...", flush=True)
    queue_res = requests.get(f"{BASE_URL}/api/v1/consultant/queue", headers=c_headers)
    assert queue_res.status_code == 200
    q_patients = queue_res.json().get("patients", [])
    print(f"[Consultant Triage] Triage Queue contains {len(q_patients)} patient(s).", flush=True)
    found_patient = next((p for p in q_patients if p["id"] == p_id), None)
    assert found_patient is not None, f"Patient {p_id} not found in consultant queue!"
    print(f"[Consultant Triage] Verified assigned patient: Name='{found_patient['full_name']}', Latest Risk={found_patient['latest_risk_level']}", flush=True)
    summary["CONSULTANT_TRIAGE_QUEUE"] = "PASSED"

    # 4.2 Patient Clinical Detail
    print("\n[Consultant Detail] Fetching complete clinical chart for patient...", flush=True)
    detail_res = requests.get(f"{BASE_URL}/api/v1/consultant/patient/{p_id}", headers=c_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    print(f"[Consultant Detail] Patient: {detail['patient']['full_name']} ({detail['patient']['email']})", flush=True)
    print(f"[Consultant Detail] Assessment Score: {detail.get('latest_assessment', {}).get('score')}", flush=True)
    summary["CONSULTANT_PATIENT_DETAIL"] = "PASSED"

    # 4.3 Patient Sensor View
    print("\n[Consultant Sensors] Viewing patient sensor telemetry...", flush=True)
    c_sensor_res = requests.get(f"{BASE_URL}/api/v1/admin/patients/{p_id}/sensor-data", headers=c_headers)
    assert c_sensor_res.status_code == 200
    print(f"[Consultant Sensors] Retrieved sensor telemetry for patient {p_id}.", flush=True)
    summary["CONSULTANT_SENSOR_VIEW"] = "PASSED"

    # 4.4 Submit Clinical Review Note
    print("\n[Consultant Review] Submitting clinical evaluation & review note...", flush=True)
    review_res = requests.post(f"{BASE_URL}/api/v1/consultant/patient/{p_id}/review/{assessment_id}", json={
        "clinical_note": "Patient presents moderate-severe depressive symptoms. Recommended weekly CBT check-in and regular sleep hygiene."
    }, headers=c_headers)
    assert review_res.status_code == 200
    review_body = review_res.json()
    print(f"[Consultant Review] Clinical note saved: NeedsReview={review_body.get('needs_human_review')}, Note='{review_body.get('clinical_note')}'", flush=True)
    summary["CONSULTANT_CLINICAL_REVIEW"] = "PASSED"

    # 4.5 Access Control Enforcement
    print("\n[Access Control] Testing multi-tenant access control boundaries...", flush=True)
    # Register 2nd Consultant
    c2_email = f"dr_sneha_{ts}@healthly.com"
    requests.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": c2_email,
        "password": "Pass1234!",
        "full_name": "Dr. Sneha Iyer",
        "role": "consultant",
        "registration_number": "RCI20002",
        "registration_body": "Rehabilitation Council of India"
    })
    c2_login = requests.post(f"{BASE_URL}/api/v1/auth/login", json={"email": c2_email, "password": "Pass1234!"})
    c2_headers = {"Authorization": f"Bearer {c2_login.json()['access_token']}"}

    # Dr. Sneha should NOT be allowed to view Dr. Aarav's patient
    unauth_res = requests.get(f"{BASE_URL}/api/v1/admin/patients/{p_id}/sensor-data", headers=c2_headers)
    print(f"[Access Control] Unauthorized access attempt: HTTP {unauth_res.status_code} ({unauth_res.json().get('detail')})", flush=True)
    assert unauth_res.status_code == 403
    print("[Access Control] Access control strictly enforced (403 Forbidden).", flush=True)
    summary["ACCESS_CONTROL_ENFORCEMENT"] = "PASSED"

    # =========================================================================
    # SUMMARY
    # =========================================================================
    log_header("TEST RESULTS SUMMARY")
    print(json.dumps(summary, indent=2), flush=True)
    print("\nALL ROLES (PATIENT, CONSULTANT, ADMIN) FULLY VERIFIED AND OPERATIONAL!", flush=True)

if __name__ == "__main__":
    run_all_tests()
