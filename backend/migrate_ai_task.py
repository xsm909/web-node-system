import sqlite3
import os

db_path = "/Users/Shared/Work/Web/web-node-system/backend/test.db"

def migrate():
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Fetch current tasks to grab their values
    cursor.execute("SELECT id, category FROM ai_tasks")
    tasks = cursor.fetchall()
    
    # 2. Recreate ai_tasks table with data_type_id
    # Get current schema definition
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='ai_tasks'")
    schema = cursor.fetchone()[0]
    
    # We will just do a standard SQLite table copy dance
    print("Creating new table structure...")
    
    cursor.execute("""
        CREATE TABLE ai_tasks_new (
            id CHAR(32) NOT NULL,
            owner_id VARCHAR(50) NOT NULL,
            data_type_id INTEGER NOT NULL,
            ai_model VARCHAR(50) DEFAULT 'any' NOT NULL,
            created_by CHAR(32),
            updated_by CHAR(32),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            task JSON,
            PRIMARY KEY (id),
            FOREIGN KEY(data_type_id) REFERENCES data_types (id)
        )
    """)
    
    # Fetch Data types to map categories to IDs
    cursor.execute("SELECT id, type FROM data_types")
    data_types = {row['type']: row['id'] for row in cursor.fetchall()}
    
    print("Found data types:", data_types)
    DEFAULT_DT = next(iter(data_types.values())) if data_types else 1 # fallback
    
    print("Migrating records...")
    # Copy data over
    cursor.execute("SELECT * FROM ai_tasks")
    old_tasks = cursor.fetchall()
    
    for t in old_tasks:
        dt_id = data_types.get(t['category'], DEFAULT_DT)
        
        cursor.execute("""
            INSERT INTO ai_tasks_new 
            (id, owner_id, data_type_id, ai_model, created_by, updated_by, created_at, updated_at, task) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            t['id'], t['owner_id'], dt_id, t['ai_model'], 
            t['created_by'], t['updated_by'], t['created_at'], t['updated_at'], t['task']
        ))
        
    print("Renaming tables...")
    cursor.execute("DROP TABLE ai_tasks")
    cursor.execute("ALTER TABLE ai_tasks_new RENAME TO ai_tasks")
    
    # Recreate useful indexes (SQLite drops indexes when dropping tables)
    cursor.execute("CREATE INDEX idx_ai_task_owner_id ON ai_tasks (owner_id)")
    cursor.execute("CREATE INDEX idx_ai_task_data_type_id ON ai_tasks (data_type_id)")
    cursor.execute("CREATE INDEX idx_ai_task_created_by ON ai_tasks (created_by)")
    
    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
