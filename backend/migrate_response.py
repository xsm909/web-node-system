import os
from sqlalchemy import create_engine, text

# Fallback to the docker-compose defined URL if not set
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@localhost:5432/workflow_db")

def migrate():
    engine = create_engine(DATABASE_URL)
    
    # Read the SQL file
    sql_path = os.path.join(os.path.dirname(__file__), "docker", "response.sql")
    with open(sql_path, "r") as f:
        sql = f.read()
    
    with engine.begin() as conn:
        print("Starting PostgreSQL response table migration...")
        
        # Split by semicolon to execute one by one if necessary, 
        # or just execute the whole block if it's safe.
        # SQLAlchemy's engine.begin() handles blocks well.
        conn.execute(text(sql))
        
        print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
