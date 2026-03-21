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
        DATABASE_URL = "sqlite:///./test.db"
        print(f"Using fallback DATABASE_URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def run_migration():
    print("Starting migration for object_parameters...")
    
    # 1. Rename table if it exists
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE report_parameters RENAME TO object_parameters"))
            conn.commit()
            print("Renamed table report_parameters to object_parameters")
        except Exception as e:
            # conn.rollback() # Not always needed if it failed to find table
            print(f"Table rename skipped or already done")

    # 2. Rename column report_id to object_id
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE object_parameters RENAME COLUMN report_id TO object_id"))
            conn.commit()
            print("Renamed column report_id to object_id")
        except Exception as e:
            print(f"Column rename skipped or already done")

    # 3. Add object_name column
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT object_name FROM object_parameters LIMIT 1"))
            print("Column object_name already exists")
        except Exception:
            # We must rollback the failed select in PG before doing ALTER
            try:
                # Some dialects need explicit rollback on connection
                conn.rollback()
            except:
                pass
            print("Adding column object_name")
            conn.execute(text("ALTER TABLE object_parameters ADD COLUMN object_name VARCHAR(255) NOT NULL DEFAULT 'reports'"))
            conn.commit()
            print("Added column object_name with default 'reports'")

    # 4. Add missing columns (parameter_type, default_value)
    for col, col_type in [("parameter_type", "VARCHAR(50) DEFAULT 'text'"), ("default_value", "TEXT")]:
        with engine.connect() as conn:
            try:
                conn.execute(text(f"SELECT {col} FROM object_parameters LIMIT 1"))
                print(f"Column {col} already exists")
            except Exception:
                try:
                    conn.rollback()
                except:
                    pass
                print(f"Adding column {col}")
                conn.execute(text(f"ALTER TABLE object_parameters ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Added column {col}")

    print("Migration completed successfully")

if __name__ == "__main__":
    run_migration()
