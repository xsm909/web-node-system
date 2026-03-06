import os
from sqlalchemy import create_engine, text

# Fallback to the docker-compose defined URL if not set
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@db:5432/workflow_db")

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        print("Starting PostgreSQL AI Task migration...")
        
        # 1. Fetch current tasks
        res = conn.execute(text("SELECT id, category FROM ai_tasks"))
        old_tasks = res.fetchall()
        
        # 2. Fetch Data types to map categories to IDs
        res = conn.execute(text("SELECT id, type FROM data_types"))
        data_types = {row.type: row.id for row in res.fetchall()}
        print("Found data types:", data_types)
        
        if not data_types:
            DEFAULT_DT = 1 
        else:
            DEFAULT_DT = next(iter(data_types.values()))
            
        # 3. Add data_type_id column (allow null initially to populate)
        print("Adding data_type_id column...")
        try:
            conn.execute(text("ALTER TABLE ai_tasks ADD COLUMN data_type_id INTEGER"))
        except Exception as e:
            print("Column might already exist:", e)
            
        # 4. Update existing rows
        print("Migrating records...")
        for old_t in old_tasks:
            dt_id = data_types.get(old_t.category, DEFAULT_DT)
            conn.execute(text(
                "UPDATE ai_tasks SET data_type_id = :dt_id WHERE id = :id"
            ), {"dt_id": dt_id, "id": old_t.id})
            
        # 5. Make column NOT NULL and add foreign key
        print("Finalizing constraints...")
        # Since postgres lacks easy conditional constraints in script, just execute standard DDL
        conn.execute(text("ALTER TABLE ai_tasks ALTER COLUMN data_type_id SET NOT NULL"))
        try:
            conn.execute(text(
                "ALTER TABLE ai_tasks ADD CONSTRAINT fk_ai_task_data_type "
                "FOREIGN KEY (data_type_id) REFERENCES data_types (id)"
            ))
        except Exception as e:
            print("FK might exist:", e)
            
        # 6. Drop the old category column
        print("Dropping category column...")
        try:
            conn.execute(text("ALTER TABLE ai_tasks DROP COLUMN category"))
        except Exception as e:
            print("Warning category column drop failed:", e)
        
        # Recreate indexes if needed (Alembic or native Postgres handles this easily, but let's just create it)
        try:
            conn.execute(text("CREATE INDEX idx_ai_task_data_type_id ON ai_tasks (data_type_id)"))
        except Exception:
            pass

        print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
