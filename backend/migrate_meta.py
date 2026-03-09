from app.core.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Adding 'meta' column to 'schemas' table...")
        try:
            conn.execute(text("ALTER TABLE schemas ADD COLUMN meta JSON;"))
            conn.commit()
            print("Successfully added 'meta' column.")
        except Exception as e:
            print(f"Error or column already exists: {e}")
            
        print("Populating tags based on categories...")
        try:
            # Simple script to update existing rows
            # We fetch all schemas, and for each we split category by '|' and save as tags
            from sqlalchemy.orm import Session
            from app.models.schema import Schema
            
            with Session(engine) as session:
                schemas = session.query(Schema).all()
                for s in schemas:
                    if s.category:
                        tags = [t.strip().lower() for t in s.category.split('|') if t.strip()]
                        s.meta = {"tags": tags}
                session.commit()
            print("Successfully populated tags.")
        except Exception as e:
            print(f"Error populating tags: {e}")

if __name__ == "__main__":
    migrate()
