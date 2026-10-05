"""
Data Migration Script: Encrypt Existing Plaintext Sensitive Fields at Rest
Migrates:
- chat_messages (user_message, bot_response)
- health_reports (summary, clinical_notes)
- phq9_assessments (clinical_note, emotion_rationale, emotion_summary)
"""

import sys
from cryptography.fernet import InvalidToken
from sqlalchemy import text
from app.db.session import engine
from app.core.security import get_data_cipher, encrypt_data


def is_already_encrypted(value: str | None, cipher) -> bool:
    """Returns True if the value is non-empty and successfully decrypts with cipher."""
    if not value or not isinstance(value, str):
        return True  # Nothing to encrypt
    try:
        cipher.decrypt(value.encode("utf-8"))
        return True
    except (InvalidToken, Exception):
        return False


def run_migration():
    print("=" * 60)
    print("STARTING DATA ENCRYPTION MIGRATION")
    print("=" * 60)

    cipher = get_data_cipher()

    with engine.begin() as conn:
        # 1. chat_messages
        rows = conn.execute(text("SELECT id, user_message, bot_response FROM chat_messages")).fetchall()
        migrated_chat = 0
        for row in rows:
            cid, u_msg, b_resp = row[0], row[1], row[2]
            new_u = u_msg if is_already_encrypted(u_msg, cipher) else encrypt_data(u_msg)
            new_b = b_resp if is_already_encrypted(b_resp, cipher) else encrypt_data(b_resp)

            if new_u != u_msg or new_b != b_resp:
                conn.execute(
                    text("UPDATE chat_messages SET user_message = :u, bot_response = :b WHERE id = :id"),
                    {"u": new_u, "b": new_b, "id": cid}
                )
                migrated_chat += 1
        print(f"[*] chat_messages: {migrated_chat} / {len(rows)} rows encrypted")

        # 2. health_reports
        rows = conn.execute(text("SELECT id, summary, clinical_notes FROM health_reports")).fetchall()
        migrated_reports = 0
        for row in rows:
            rid, summ, notes = row[0], row[1], row[2]
            new_s = summ if is_already_encrypted(summ, cipher) else encrypt_data(summ)
            new_n = notes if is_already_encrypted(notes, cipher) else encrypt_data(notes)

            if new_s != summ or new_n != notes:
                conn.execute(
                    text("UPDATE health_reports SET summary = :s, clinical_notes = :n WHERE id = :id"),
                    {"s": new_s, "n": new_n, "id": rid}
                )
                migrated_reports += 1
        print(f"[*] health_reports: {migrated_reports} / {len(rows)} rows encrypted")

        # 3. phq9_assessments
        rows = conn.execute(
            text("SELECT id, clinical_note, emotion_rationale, emotion_summary FROM phq9_assessments")
        ).fetchall()
        migrated_phq = 0
        for row in rows:
            pid, c_note, e_rat, e_sum = row[0], row[1], row[2], row[3]
            new_note = c_note if is_already_encrypted(c_note, cipher) else encrypt_data(c_note)
            new_rat = e_rat if is_already_encrypted(e_rat, cipher) else encrypt_data(e_rat)
            new_sum = e_sum if is_already_encrypted(e_sum, cipher) else encrypt_data(e_sum)

            if new_note != c_note or new_rat != e_rat or new_sum != e_sum:
                conn.execute(
                    text("UPDATE phq9_assessments SET clinical_note = :n, emotion_rationale = :r, emotion_summary = :s WHERE id = :id"),
                    {"n": new_note, "r": new_rat, "s": new_sum, "id": pid}
                )
                migrated_phq += 1
        print(f"[*] phq9_assessments: {migrated_phq} / {len(rows)} rows encrypted")

    print("=" * 60)
    print("MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 60)


if __name__ == "__main__":
    run_migration()
