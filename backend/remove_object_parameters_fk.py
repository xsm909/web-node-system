import sys
import os
from sqlalchemy import create_engine, text

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    try:
        from app.core.config import DATABASE_URL
        print(f"Loaded DATABASE_URL from config: {DATABASE_URL}")
    except ImportError as e:
        print(f"ImportError: {e}")
        DATABASE_URL = "postgresql://user:password@localhost:5432/workflow_db"
        print(f"Using fallback DATABASE_URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def run_migration():
    print("Starting migration to remove foreign key constraint from object_parameters...")
    
    with engine.connect() as conn:
        try:
            # 1. Identify the constraint name if it exists
            # We already know it's likely 'object_parameters_object_id_fkey' from the logs
            # But let's be safe and try to drop it.
            
            # In PG, we can use IF EXISTS for dropping constraints in newer versions, 
            # but usually it's ALTER TABLE table_name DROP CONSTRAINT constraint_name
            
            print("Attempting to drop constraint 'object_parameters_object_id_fkey'...")
            conn.execute(text("ALTER TABLE object_parameters DROP CONSTRAINT IF EXISTS object_parameters_object_id_fkey"))
            conn.commit()
            print("Successfully dropped 'object_parameters_object_id_fkey'")
            
            # Also check for the old name just in case it didn't rename automatically or something weird
            print("Attempting to drop constraint 'report_parameters_report_id_fkey'...")
            conn.execute(text("ALTER TABLE object_parameters DROP CONSTRAINT IF EXISTS report_parameters_report_id_fkey"))
            conn.commit()
            print("Successfully dropped 'report_parameters_report_id_fkey'")

        except Exception as e:
            print(f"Error during migration: {e}")
            conn.rollback()

    print("Migration completed.")

if __name__ == "__main__":
    run_migration()
