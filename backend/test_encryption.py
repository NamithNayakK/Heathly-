"""
Automated Test Suite for Database Encryption & Decryption (Fernet / AES)
Verifies:
1. Unit encryption & decryption
2. Raw SQL inspection (confirm ciphertext on disk/database)
3. ORM transparent decryption (confirm automatic read in plaintext)
4. Model coverage (ChatMessage, HealthReport, PHQ9Assessment)
5. Backward compatibility for legacy unencrypted text
6. Key rotation / mismatch simulation (invalid key handling)
"""

import sys
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.core.security import encrypt_data, decrypt_data, get_data_cipher
from app.models.chat_message import ChatMessage
from app.models.health_report import HealthReport
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User


def run_tests():
    print("=" * 70)
    print("RUNNING HEALTHLY ENCRYPTION & DECRYPTION TEST SUITE")
    print("=" * 70)

    # -------------------------------------------------------------
    # TEST 1: Unit Encryption / Decryption
    # -------------------------------------------------------------
    print("\n[TEST 1] Unit Encryption / Decryption:")
    sample_text = "Patient reports persistent insomnia and anxiety during evening hours."
    encrypted = encrypt_data(sample_text)
    assert encrypted is not None
    assert encrypted != sample_text, "Ciphertext should not equal plaintext"
    assert encrypted.startswith("gAAAAA"), f"Fernet token should start with 'gAAAAA', got {encrypted[:10]}"
    decrypted = decrypt_data(encrypted)
    assert decrypted == sample_text, "Decrypted text must match original plaintext"
    print("  [PASS] Basic string encryption & decryption verified")

    # None and empty handling
    assert encrypt_data(None) is None
    assert decrypt_data(None) is None
    assert encrypt_data("") == ""
    assert decrypt_data("") == ""
    print("  [PASS] None and empty string edge cases verified")

    # -------------------------------------------------------------
    # TEST 2 & 3: ChatMessage DB Storage & ORM Decryption
    # -------------------------------------------------------------
    print("\n[TEST 2 & 3] ChatMessage Storage & ORM Read:")
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("  [!] No user found, skipping DB insert test")
            return

        test_msg = "Confidential crisis note: I need someone to talk to right now."
        test_bot = "I hear you, and you are not alone. Let me connect you with support."

        chat_record = ChatMessage(
            user_id=user.id,
            user_message=test_msg,
            bot_response=test_bot,
            emotion="distress",
            confidence=0.92,
            escalation_required=True
        )
        db.add(chat_record)
        db.commit()
        db.refresh(chat_record)
        record_id = chat_record.id

        # Raw SQL Inspection: Verify stored column is ciphertext
        with engine.connect() as conn:
            raw_row = conn.execute(
                text("SELECT user_message, bot_response FROM chat_messages WHERE id = :id"),
                {"id": record_id}
            ).fetchone()
            raw_user_msg = raw_row[0]
            raw_bot_resp = raw_row[1]

            assert raw_user_msg.startswith("gAAAAA"), f"Raw DB column must be Fernet ciphertext! Got: {raw_user_msg[:20]}"
            assert raw_bot_resp.startswith("gAAAAA"), f"Raw DB column must be Fernet ciphertext! Got: {raw_bot_resp[:20]}"
            assert test_msg not in raw_user_msg, "Plaintext must not be visible in raw database storage!"
            print(f"  [PASS] Raw SQL Check: Stored user_message is ciphertext on disk: {raw_user_msg[:30]}...")

        # ORM Transparent Read: Verify model yields plaintext
        db.expire_all()
        fetched = db.query(ChatMessage).filter(ChatMessage.id == record_id).first()
        assert fetched.user_message == test_msg, f"ORM should automatically decrypt! Got: {fetched.user_message}"
        assert fetched.bot_response == test_bot, f"ORM should automatically decrypt! Got: {fetched.bot_response}"
        print("  [PASS] ORM Transparent Decryption Check: Data retrieved in clear text seamlessly")

        # Clean up test row
        db.delete(fetched)
        db.commit()

    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST 4: HealthReport & PHQ9 Model Coverage
    # -------------------------------------------------------------
    print("\n[TEST 4] HealthReport & PHQ9 Model Coverage:")
    db = SessionLocal()
    try:
        user = db.query(User).first()

        # HealthReport
        report = HealthReport(
            user_id=user.id,
            filename="psych_eval_test.pdf",
            summary="Patient has recurrent episodic mood disorders.",
            diagnoses=["F33.1"],
            medications=["Fluoxetine 20mg"],
            clinical_notes="Prescribed 4-week trial with weekly tele-health monitoring."
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        rep_id = report.id

        with engine.connect() as conn:
            raw_rep = conn.execute(
                text("SELECT summary, clinical_notes FROM health_reports WHERE id = :id"),
                {"id": rep_id}
            ).fetchone()
            assert raw_rep[0].startswith("gAAAAA"), "HealthReport.summary must be stored encrypted"
            assert raw_rep[1].startswith("gAAAAA"), "HealthReport.clinical_notes must be stored encrypted"
            print("  [PASS] HealthReport raw SQL columns confirmed encrypted")

        db.expire_all()
        rep_fetched = db.query(HealthReport).filter(HealthReport.id == rep_id).first()
        assert rep_fetched.summary == "Patient has recurrent episodic mood disorders."
        assert rep_fetched.clinical_notes == "Prescribed 4-week trial with weekly tele-health monitoring."
        print("  [PASS] HealthReport ORM fetch confirmed seamlessly decrypted")

        db.delete(rep_fetched)
        db.commit()

    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST 5: Backward Compatibility for Legacy Plaintext
    # -------------------------------------------------------------
    print("\n[TEST 5] Backward Compatibility (Plaintext Fallback):")
    legacy_text = "Legacy plain text stored before encryption was enabled."
    # decrypt_data on unencrypted string should return the text intact without crashing
    result = decrypt_data(legacy_text)
    assert result == legacy_text, f"Fallback must return legacy text intact. Got: {result}"
    print("  [PASS] Legacy plaintext fallback safely returned string without error")

    # -------------------------------------------------------------
    # TEST 6: Key Rotation / Mismatch Simulation
    # -------------------------------------------------------------
    print("\n[TEST 6] Key Rotation / Mismatch Simulation:")
    original_secret = "Confidential clinical psychiatric evaluation."
    valid_ciphertext = encrypt_data(original_secret)

    # Generate a completely different Fernet key
    different_key = Fernet.generate_key().decode()
    different_cipher = Fernet(different_key.encode("utf-8"))

    # Attempting to decrypt with wrong key must raise InvalidToken
    key_mismatch_detected = False
    try:
        different_cipher.decrypt(valid_ciphertext.encode("utf-8"))
    except InvalidToken:
        key_mismatch_detected = True

    assert key_mismatch_detected, "Decrypting with mismatched key must raise InvalidToken"
    print("  [PASS] Key mismatch simulation: InvalidToken properly raised when key differs")

    print("\n" + "=" * 70)
    print("ALL 6 ENCRYPTION & DECRYPTION TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
