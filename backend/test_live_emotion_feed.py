"""Comprehensive in-process test script for Real-Time Emotion Telemetry Feed & WebSocket Role-Gating."""
import sys
import json
import base64
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.user import User
from app.models.session_analytics import SessionAnalytics

client = TestClient(app)

def setup_test_users():
    db = SessionLocal()
    try:
        # Check or create patient
        patient = db.query(User).filter(User.email == "patient_test@healthly.com").first()
        if not patient:
            patient = User(
                full_name="Test Patient",
                email="patient_test@healthly.com",
                role="patient",
                hashed_password="hashed_pw"
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)

        # Check or create consultant
        consultant = db.query(User).filter(User.email == "doctor_test@healthly.com").first()
        if not consultant:
            consultant = User(
                full_name="Dr. Test Consultant",
                email="doctor_test@healthly.com",
                role="consultant",
                hashed_password="hashed_pw"
            )
            db.add(consultant)
            db.commit()
            db.refresh(consultant)

        patient_token = create_access_token(subject=patient.email)
        consultant_token = create_access_token(subject=consultant.email)

        return patient, consultant, patient_token, consultant_token
    finally:
        db.close()

def run_test():
    print("\n" + "=" * 60)
    print(" HEALTHLY REAL-TIME EMOTION TELEMETRY & WEBSOCKET AUDIT")
    print("=" * 60)

    # 1. Setup Test Users & Tokens
    print("\n[1] Preparing test user accounts and JWT tokens...")
    patient, consultant, patient_token, consultant_token = setup_test_users()
    print(f"OK: Patient ID #{patient.id} Token generated.")
    print(f"OK: Consultant ID #{consultant.id} Token generated.")

    # 2. Test Role-Gating: Patient role attempt to connect to WS -> MUST BE REJECTED (4003)
    print("\n[2] Testing Role-Gating: Patient role connecting to consultant WS...")
    ws_rejected = False
    try:
        with client.websocket_connect(f"/ws/consultant/session/{patient.id}?token={patient_token}") as ws:
            data = ws.receive_json()
            print(f"FAILED: Patient user unexpectedly connected: {data}")
    except Exception as e:
        ws_rejected = True
        print(f"OK: Patient WS connection properly rejected by security layer ({e})")
    assert ws_rejected, "Security failure: Patient role was not blocked from consultant WS endpoint!"

    # 3. Test Consultant Role connecting to WS -> MUST SUCCEED
    print("\n[3] Testing Consultant role connecting to live session WS...")
    with client.websocket_connect(f"/ws/consultant/session/{patient.id}?token={consultant_token}") as ws:
        connected_msg = ws.receive_json()
        print(f"OK: Consultant WS Connected: {connected_msg}")
        assert connected_msg.get("status") == "connected", "Consultant failed to receive connection confirmation!"

        # 4. Trigger /analyze-frame with active session telemetry
        print("\n[4] Posting video frame to /analyze-frame endpoint...")
        tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        frame_payload = {
            "image_base64": tiny_png,
            "session_id": str(patient.id),
            "user_id": patient.id
        }
        headers = {"Authorization": f"Bearer {patient_token}"}
        resp = client.post("/api/v1/multimodal/analyze-frame", json=frame_payload, headers=headers)
        assert resp.status_code == 200, f"Frame analysis failed with code {resp.status_code}: {resp.text}"
        frame_res = resp.json()
        print(f"OK: Frame Analysis Response: Expression='{frame_res['dominant_expression']}', Valence={frame_res['facial_valence']}, Arousal={frame_res['facial_arousal']}")

        # 5. Receive Broadcast on Consultant WebSocket
        print("\n[5] Verifying live WebSocket broadcast received by Consultant Dashboard...")
        broadcast = ws.receive_json()
        print("OK: Received Broadcast Payload:")
        print(json.dumps(broadcast, indent=2))

        assert broadcast["session_id"] == str(patient.id), "Session ID mismatch in broadcast!"
        assert broadcast["dominant_expression"] == frame_res["dominant_expression"], "Expression mismatch!"
        assert broadcast["model_status"] == "validated", "Model status mismatch!"
        assert broadcast["validation_accuracy"] == 0.1719, "Validation accuracy mismatch!"

        print(f"\nOK: Clinical Status Badge Verified: Model Status='{broadcast['model_status']}', Validation Accuracy={broadcast['validation_accuracy']*100}%")

    # 6. Verify Database Persistence in session_analytics
    print("\n[6] Auditing session_analytics database records...")
    db = SessionLocal()
    try:
        latest = db.query(SessionAnalytics).filter(SessionAnalytics.user_id == patient.id).order_by(SessionAnalytics.id.desc()).first()
        assert latest is not None, "Failed to persist frame result to session_analytics!"
        print(f"OK: Session Analytics Persisted: ID #{latest.id}, User #{latest.user_id}, Expression='{latest.dominant_expression}', Valence={latest.facial_valence}, Arousal={latest.facial_arousal}")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print(" ALL REAL-TIME EMOTION TELEMETRY & WEBSOCKET TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_test()
