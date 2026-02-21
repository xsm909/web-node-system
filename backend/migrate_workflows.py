import sqlite3
import json

def migrate():
    conn = sqlite3.connect('./test.db')
    cursor = conn.cursor()
    
    # Check if columns exist
    cursor.execute("PRAGMA table_info(workflows)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "workflow_data_schema" not in columns:
        print("Adding workflow_data_schema")
        cursor.execute("ALTER TABLE workflows ADD COLUMN workflow_data_schema JSON DEFAULT '{}'")
    if "workflow_data" not in columns:
        print("Adding workflow_data")
        cursor.execute("ALTER TABLE workflows ADD COLUMN workflow_data JSON DEFAULT '{}'")
    if "runtime_data_schema" not in columns:
        print("Adding runtime_data_schema")
        cursor.execute("ALTER TABLE workflows ADD COLUMN runtime_data_schema JSON DEFAULT '{}'")
    if "runtime_data" not in columns:
        print("Adding runtime_data")
        cursor.execute("ALTER TABLE workflows ADD COLUMN runtime_data JSON DEFAULT '{}'")
        
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate()
