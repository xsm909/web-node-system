import sys
import os
from sqlalchemy import text

# Add current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.database import engine

def migrate():
    with engine.connect() as conn:
        print("Adding 'lock' column to 'schemas' table...")
        try:
            conn.execute(text("ALTER TABLE schemas ADD COLUMN lock BOOLEAN DEFAULT FALSE NOT NULL;"))
            conn.commit()
            print("Successfully added 'lock' column to 'schemas'.")
        except Exception as e:
            print(f"Error or column already exists in 'schemas': {e}")

        print("Adding 'lock' column to 'records' table...")
        try:
            conn.execute(text("ALTER TABLE records ADD COLUMN lock BOOLEAN DEFAULT FALSE NOT NULL;"))
            conn.commit()
            print("Successfully added 'lock' column to 'records'.")
        except Exception as e:
            print(f"Error or column already exists in 'records': {e}")

if __name__ == "__main__":
    migrate()
