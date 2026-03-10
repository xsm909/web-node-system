import sys
import os
from sqlalchemy import text

# Add current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.database import engine

def migrate():
    with engine.connect() as conn:
        print("Adding 'parent_id' column to 'records' table...")
        try:
            # We add parent_id with a foreign key constraint to records.id
            conn.execute(text("ALTER TABLE records ADD COLUMN parent_id UUID REFERENCES records(id) ON DELETE CASCADE;"))
            conn.execute(text("CREATE INDEX idx_records_parent_id ON records(parent_id);"))
            conn.commit()
            print("Successfully added 'parent_id' column.")
        except Exception as e:
            print(f"Error or column already exists: {e}")

if __name__ == "__main__":
    migrate()
