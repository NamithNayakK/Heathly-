"""Add clinical_note, reviewed_by_id, reviewed_at columns to phq9_assessments."""
from app.db.session import engine
from sqlalchemy import text, inspect

inspector = inspect(engine)
existing = [c["name"] for c in inspector.get_columns("phq9_assessments")]

with engine.begin() as conn:
    if "clinical_note" not in existing:
        conn.execute(text("ALTER TABLE phq9_assessments ADD COLUMN clinical_note TEXT"))
        print("Added clinical_note column")
    else:
        print("clinical_note already exists")

    if "reviewed_by_id" not in existing:
        conn.execute(text("ALTER TABLE phq9_assessments ADD COLUMN reviewed_by_id INTEGER REFERENCES users(id)"))
        print("Added reviewed_by_id column")
    else:
        print("reviewed_by_id already exists")

    if "reviewed_at" not in existing:
        conn.execute(text("ALTER TABLE phq9_assessments ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE"))
        print("Added reviewed_at column")
    else:
        print("reviewed_at already exists")

print("Migration complete.")
