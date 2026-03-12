import sys
import os
from sqlalchemy import create_engine, text

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.config import DATABASE_URL
from app.models.agent_hint import AgentHint
from app.core.database import Base

engine = create_engine(DATABASE_URL)

def run_migration():
    print(f"Connecting to database at {DATABASE_URL}...")
    with engine.connect() as conn:
        print("Creating agent_hints table if it doesn't exist...")
        # We can use SQLAlchemy's create_all but only for this specific table's metadata
        AgentHint.__table__.create(bind=engine, checkfirst=True)
        conn.commit()
        print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
