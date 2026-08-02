import os
import sqlite3
import sys

db_paths = [
    os.path.join(os.path.dirname(__file__), "healthly.db"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "healthly.db")
]

user_columns_to_add = [
    ("role", "VARCHAR(50) DEFAULT 'patient'"),
    ("device_id", "VARCHAR(255)"),
    ("device_token_hash", "VARCHAR(255)"),
    ("registration_number", "VARCHAR(255)"),
    ("registration_body", "VARCHAR(255)"),
    ("verification_status", "VARCHAR(50)"),
    ("verification_reason", "VARCHAR(255)"),
    ("verified_at", "TIMESTAMP"),
    ("verified_by", "VARCHAR(255)"),
    ("google_fit_refresh_token", "VARCHAR(512)"),
    ("google_fit_connected_at", "TIMESTAMP"),
    ("google_fit_last_sync", "TIMESTAMP")
]

for db_path in set(db_paths):
    if not os.path.exists(db_path):
        continue
    print(f"Checking DB: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Check if users table exists
    tables = [row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    if "users" in tables:
        existing_cols = [c[1] for c in cur.execute("PRAGMA table_info(users)").fetchall()]
        for col_name, col_type in user_columns_to_add:
            if col_name not in existing_cols:
                try:
                    cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                    print(f"  + Added column {col_name} to users table in {os.path.basename(db_path)}")
                except Exception as e:
                    print(f"  - Error adding {col_name}: {e}")
            else:
                print(f"  = Column {col_name} already present")
    conn.commit()
    conn.close()

# Also run Base.metadata.create_all to ensure all tables exist
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import engine, Base
import app.models.user
import app.models.wifi_sensor
import app.models.phq9_assessment

Base.metadata.create_all(bind=engine)
print("Schema sync complete.")
