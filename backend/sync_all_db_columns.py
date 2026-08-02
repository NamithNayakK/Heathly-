import os
import sqlite3
import sys

# Append backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import Base
import app.models  # load all models into Base.metadata

def sync_database(db_path):
    print(f"--- Synchronizing Database: {db_path} ---")
    if not os.path.exists(db_path):
        print(f"File {db_path} does not exist, skipping.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Iterate over all tables defined in SQLAlchemy metadata
    for table_name, table in Base.metadata.tables.items():
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_cols = {row[1]: row[2] for row in cursor.fetchall()}

        if not existing_cols:
            print(f"Table '{table_name}' does not exist in SQLite DB. Will be created by Base.metadata.create_all().")
            continue

        for col in table.columns:
            if col.name not in existing_cols:
                # Determine SQLite data type
                col_type = "TEXT"
                type_str = str(col.type).upper()
                if "INT" in type_str:
                    col_type = "INTEGER"
                elif "FLOAT" in type_str or "NUMERIC" in type_str or "REAL" in type_str:
                    col_type = "REAL"
                elif "BOOL" in type_str:
                    col_type = "BOOLEAN"
                elif "JSON" in type_str:
                    col_type = "JSON"

                default_clause = ""
                if col.default is not None and not callable(col.default.arg):
                    default_val = col.default.arg
                    if isinstance(default_val, str):
                        default_clause = f" DEFAULT '{default_val}'"
                    elif isinstance(default_val, bool):
                        default_clause = f" DEFAULT {1 if default_val else 0}"
                    else:
                        default_clause = f" DEFAULT {default_val}"

                sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_clause}"
                print(f"Executing: {sql}")
                try:
                    cursor.execute(sql)
                except Exception as e:
                    print(f"Error adding column {col.name} to {table_name}: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    db_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "healthly.db")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "healthly.db")),
    ]
    for p in db_paths:
        sync_database(p)

    # Trigger create_all for any missing tables
    from app.db.session import engine
    Base.metadata.create_all(bind=engine)
    print("Database sync complete!")
