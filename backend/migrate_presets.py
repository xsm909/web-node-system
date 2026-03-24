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

def run_migration():
    with engine.begin() as conn:
        print("Starting presets table migration...")
        
        # Create presets table
        # id - UUID (stored as CHAR(36) in SQLite)
        # entity_type - varchar(50)
        # name - varchar(50)
        # category - varchar(75)
        # preset_data - text (for JSON)
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS presets (
                id CHAR(36) PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                name VARCHAR(50) NOT NULL,
                category VARCHAR(75),
                preset_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Add index on entity_type
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_presets_entity_type ON presets (entity_type)"))
        
        print("Table 'presets' created or already exists.")
        print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
