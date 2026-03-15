import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load .env to get the correct DATABASE_URL
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        # 1. Ensure the table exists (using the updated SQL schema)
        print("Ensuring 'response' table exists...")
        sql_path = os.path.join(os.path.dirname(__file__), "docker", "response.sql")
        if os.path.exists(sql_path):
            with open(sql_path, "r") as f:
                sql = f.read()
            # For SQLite, we might need to be careful with postgres-specific types like regclass
            # but the SQL file is already updated. Let's try to execute it as IF NOT EXISTS.
            try:
                # Basic cleaning for SQLite compatibility if needed, 
                # but better to just try it since it's "IF NOT EXISTS"
                # SQLAlchemy handles some of this.
                conn.execute(text(sql))
            except Exception as e:
                print(f"Note: Error creating table (might be PG specific syntax): {e}")
                # Fallback: manually create it if it's missing and the big SQL failed
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS response (
                        id UUID PRIMARY KEY,
                        entity_id UUID NOT NULL,
                        entity_type VARCHAR NOT NULL,
                        reference_id UUID,
                        reference_type VARCHAR,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        category VARCHAR,
                        context JSON,
                        context_type VARCHAR(25),
                        meta JSON,
                        raw TEXT
                    );
                """))
        
        # 2. Ensure 'raw' column exists (for cases where table existed but was old)
        print("Ensuring 'raw' column exists...")
        if "sqlite" in DATABASE_URL:
            # SQLite doesn't support IF NOT EXISTS in ALTER TABLE officially in all versions, 
            # so we check if it exists first.
            res = conn.execute(text("PRAGMA table_info(response)"))
            columns = [row[1] for row in res.fetchall()]
            if "raw" not in columns:
                conn.execute(text("ALTER TABLE response ADD COLUMN raw TEXT"))
                print("Added 'raw' column to SQLite table.")
            else:
                print("'raw' column already exists in SQLite table.")
        else:
            conn.execute(text("ALTER TABLE response ADD COLUMN IF NOT EXISTS raw TEXT;"))
            print("Migration completed successfully (PG/MySQL).")

if __name__ == "__main__":
    migrate()
