from app.core.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Adding 'category' column to 'schemas' table...")
        try:
            conn.execute(text("ALTER TABLE schemas ADD COLUMN category VARCHAR;"))
            conn.commit()
            print("Successfully added 'category' column.")
        except Exception as e:
            print(f"Error or column already exists: {e}")

if __name__ == "__main__":
    migrate()
