import sys
import os
from sqlalchemy import create_engine, text

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

try:
    from app.core.config import DATABASE_URL
    print(f"Loaded DATABASE_URL: {DATABASE_URL}")
except ImportError as e:
    print(f"ImportError: {e}")
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/workflow_db")
    print(f"Using fallback DATABASE_URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def add_column_if_missing(conn, table, column, col_type, default=None):
    try:
        conn.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
        print(f"{table}.{column} already exists")
    except Exception:
        print(f"Adding {table}.{column}")
        alter_query = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
        if default is not None:
            alter_query += f" DEFAULT {default}"
        conn.execute(text(alter_query))
        conn.commit()

def run_migration():
    with engine.connect() as conn:
        print("Starting migration...")
        
        # Workflows table
        add_column_if_missing(conn, "workflows", "category", "VARCHAR(50)", "'personal'")
        add_column_if_missing(conn, "workflows", "created_by", "VARCHAR(36)")
        add_column_if_missing(conn, "workflows", "workflow_data", "JSON", "'{}'")
        
        # Fill created_by with owner_id if NULL
        conn.execute(text("UPDATE workflows SET created_by = owner_id WHERE created_by IS NULL"))
        
        # Node Types table
        add_column_if_missing(conn, "node_types", "is_async", "BOOLEAN", "0") # SQLite uses 0/1
        add_column_if_missing(conn, "node_types", "category", "VARCHAR(50)")
        add_column_if_missing(conn, "node_types", "icon", "VARCHAR(100)", "'task'")

        conn.commit()
        print("Migration completed successfully")

if __name__ == "__main__":
    run_migration()
