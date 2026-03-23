import sys
import os

# Add the parent directory to sys.path to allow importing from 'app'
# Since this script is in 'backend/', we need to add 'backend/' to path to find 'app'
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from sqlalchemy import text
from app.core.database import SessionLocal

def migrate():
    db = SessionLocal()
    try:
        print("Starting migration: renaming 'records' to 'metadata'...")
        
        # 1. Rename the table
        # Check if table 'records' exists
        table_exists = db.execute(text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'records');")).scalar()
        if table_exists:
            db.execute(text("ALTER TABLE records RENAME TO metadata;"))
            print("Table 'records' renamed to 'metadata'.")
            
            # 2. Update indices
            db.execute(text("ALTER INDEX IF EXISTS idx_records_entity RENAME TO idx_metadata_entity;"))
            db.execute(text("ALTER INDEX IF EXISTS records_pkey RENAME TO metadata_pkey;"))
            db.execute(text("ALTER INDEX IF EXISTS idx_records_schema_id RENAME TO idx_metadata_schema_id;"))
            db.execute(text("ALTER INDEX IF EXISTS idx_records_parent_id RENAME TO idx_metadata_parent_id;"))
            db.execute(text("ALTER INDEX IF EXISTS idx_records_entity_id RENAME TO idx_metadata_entity_id;"))
            db.execute(text("ALTER INDEX IF EXISTS idx_records_entity_type RENAME TO idx_metadata_entity_type;"))
            print("Indices renamed.")
        else:
            print("Table 'records' does not exist. Skipping rename.")
        
        # 3. Update lock_data entries
        db.execute(text("UPDATE lock_data SET entity_type = 'metadata' WHERE entity_type = 'records';"))
        print("Updated 'lock_data' entries.")
        
        db.commit()
        print("Migration completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
