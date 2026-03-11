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
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    print(f"Using fallback DATABASE_URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def add_column_if_missing(conn, table, column, col_type, default=None):
    try:
        conn.execute(text(f'SELECT "{column}" FROM {table} LIMIT 1'))
        print(f"{table}.{column} already exists")
    except Exception:
        # In PostgreSQL, we must rollback if a query fails
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"Adding {table}.{column}")
        alter_query = f'ALTER TABLE {table} ADD COLUMN "{column}" {col_type}'
        if default is not None:
            alter_query += f" DEFAULT {default}"
        conn.execute(text(alter_query))
        try:
            conn.commit()
        except Exception:
            pass

def run_migration():
    with engine.connect() as conn:
        print("Starting migration for records.order...")
        
        # Add order column to records table
        add_column_if_missing(conn, "records", "order", "INTEGER", "0")
        
        conn.commit()
        print("Migration completed successfully")

if __name__ == "__main__":
    run_migration()
