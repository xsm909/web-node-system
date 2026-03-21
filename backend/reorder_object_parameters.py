import sys
import os
import uuid
from sqlalchemy import create_engine, text

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    try:
        from app.core.config import DATABASE_URL
        print(f"Loaded DATABASE_URL from config: {DATABASE_URL}")
    except ImportError:
        DATABASE_URL = "sqlite:///./test.db"
        print(f"Using fallback DATABASE_URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def run_reorder():
    print(f"Starting reordering for object_parameters on {DATABASE_URL}...")
    
    with engine.connect() as conn:
        # 1. Get current columns
        if "postgresql" in DATABASE_URL:
            # Postgres check
            res = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'object_parameters' 
                ORDER BY ordinal_position
            """))
            current_cols = [row[0] for row in res.fetchall()]
        else:
            # SQLite check
            res = conn.execute(text("PRAGMA table_info(object_parameters)"))
            current_cols = [row[1] for row in res.fetchall()]
        
        print(f"Current columns: {current_cols}")
        
        # Target order: id, object_id, object_name, parameter_name, parameter_type, default_value, source, value_field, label_field
        target_order = [
            "id", "object_id", "object_name", "parameter_name", 
            "parameter_type", "default_value", "source", "value_field", "label_field"
        ]
        
        # Check if reordering is needed
        if current_cols[:4] == target_order[:4] and len(current_cols) == len(target_order):
             # Check if the whole list matches if we want to be strict
             if current_cols == target_order:
                 print("Columns are already in the correct order.")
                 return

        print("Reordering columns...")
        
        # 2. Recreate table approach (Safer for both SQLite and PG)
        # We'll use a transaction
        try:
            # Rename existing
            conn.execute(text("ALTER TABLE object_parameters RENAME TO object_parameters_old"))
            
            # Create new table with correct order
            # Note: We need to match the types exactly.
            if "postgresql" in DATABASE_URL:
                create_sql = """
                CREATE TABLE object_parameters (
                    id UUID PRIMARY KEY,
                    object_id UUID NOT NULL,
                    object_name VARCHAR(255) NOT NULL DEFAULT 'reports',
                    parameter_name VARCHAR(255) NOT NULL,
                    parameter_type VARCHAR(50) NOT NULL DEFAULT 'text',
                    default_value TEXT,
                    source VARCHAR(255),
                    value_field VARCHAR(255),
                    label_field VARCHAR(255),
                    FOREIGN KEY (object_id) REFERENCES reports (id)
                )
                """
            else:
                create_sql = """
                CREATE TABLE object_parameters (
                    id UUID NOT NULL PRIMARY KEY,
                    object_id UUID NOT NULL,
                    object_name VARCHAR(255) NOT NULL DEFAULT 'reports',
                    parameter_name VARCHAR(255) NOT NULL,
                    parameter_type VARCHAR(50) NOT NULL DEFAULT 'text',
                    default_value TEXT,
                    source VARCHAR(255),
                    value_field VARCHAR(255),
                    label_field VARCHAR(255),
                    FOREIGN KEY (object_id) REFERENCES reports (id)
                )
                """
            
            conn.execute(text(create_sql))
            
            # Copy data in new order
            # Mapping columns from old to new
            cols_to_copy = ", ".join(target_order)
            conn.execute(text(f"INSERT INTO object_parameters ({cols_to_copy}) SELECT {cols_to_copy} FROM object_parameters_old"))
            
            # Drop old
            conn.execute(text("DROP TABLE object_parameters_old"))
            
            # Recreate index for SQLite if needed (SQLAlchemy adds it usually)
            if "sqlite" in DATABASE_URL:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_object_parameters_id ON object_parameters (id)"))

            conn.commit()
            print("Reordering completed successfully.")
            
        except Exception as e:
            conn.rollback()
            print(f"Error during reordering: {e}")
            # Try to restore if possible (though some ALTERS are not undoable in some DBs without manual work)
            raise

if __name__ == "__main__":
    run_reorder()
