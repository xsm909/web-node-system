import sys
import os
from sqlalchemy import create_engine, text
import uuid

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

try:
    from app.core.config import DATABASE_URL
    print(f"Loaded DATABASE_URL: {DATABASE_URL}")
except ImportError as e:
    print(f"ImportError: {e}")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    print(f"Using fallback DATABASE_URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

TABLES_TO_PROTECT = [
    "schemas",
    "records",
    "workflows",
    "reports",
    "users",
    "node_types",
    "object_parameters",
    "report_styles",
    "agent_hints",
    "client_metadata"
]

def run_migration():
    with engine.begin() as conn:
        print("Starting lock system migration...")
        
        # 1. Create lock_data table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lock_data (
                id CHAR(36) PRIMARY KEY,
                entity_id CHAR(36) NOT NULL,
                entity_type VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_id, entity_type)
            )
        """))
        print("Table 'lock_data' created or already exists.")

        # 2. Migrate existing locks from 'schemas' and 'records' if they exist
        for table in ["schemas", "records"]:
            try:
                # Check if 'lock' column exists
                res = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                columns = [r[1] for r in res]
                
                if "lock" in columns:
                    print(f"Migrating locks from '{table}'...")
                    # Insert into lock_data where lock = 1
                    # In SQLite, UUIDs are often stored as strings
                    conn.execute(text(f"""
                        INSERT OR IGNORE INTO lock_data (id, entity_id, entity_type)
                        SELECT lower(hex(randomblob(16))), id, '{table}'
                        FROM {table} WHERE lock = 1 OR lock = '1' or lock = true
                    """))
                    
                    # We can't easily drop columns in SQLite before 3.35.0
                    # For safety, we'll just leave it or rename it if needed, 
                    # but the prompts say "remove", so we'll try to drop if supported or just ignore.
                    # Since we want a clean state, let's try to DROP COLUMN (supported in SQLite 3.35.0+)
                    try:
                        conn.execute(text(f"ALTER TABLE {table} DROP COLUMN lock"))
                        print(f"Dropped 'lock' column from '{table}'.")
                    except Exception as e:
                        print(f"Could not drop 'lock' column from '{table}' (might be old SQLite version): {e}")
            except Exception as e:
                print(f"Error migrating locks from '{table}': {e}")

        # 3. Create Triggers
        for table in TABLES_TO_PROTECT:
            print(f"Creating triggers for '{table}'...")
            
            # Update Trigger
            conn.execute(text(f"DROP TRIGGER IF EXISTS trg_{table}_lock_update"))
            conn.execute(text(f"""
                CREATE TRIGGER trg_{table}_lock_update
                BEFORE UPDATE ON {table}
                FOR EACH ROW
                WHEN EXISTS (SELECT 1 FROM lock_data WHERE entity_id = OLD.id AND entity_type = '{table}')
                BEGIN
                    SELECT RAISE(ABORT, 'Record is locked and cannot be modified.');
                END;
            """))

            # Delete Trigger
            conn.execute(text(f"DROP TRIGGER IF EXISTS trg_{table}_lock_delete"))
            conn.execute(text(f"""
                CREATE TRIGGER trg_{table}_lock_delete
                BEFORE DELETE ON {table}
                FOR EACH ROW
                WHEN EXISTS (SELECT 1 FROM lock_data WHERE entity_id = OLD.id AND entity_type = '{table}')
                BEGIN
                    SELECT RAISE(ABORT, 'Record is locked and cannot be deleted.');
                END;
            """))

        print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
