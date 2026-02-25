import sqlite3
import os

DB_PATH = "/Users/Shared/Work/Web/web-node-system/backend/test.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(node_types)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'icon' not in columns:
            print("Adding 'icon' column to node_types...")
            cursor.execute("ALTER TABLE node_types ADD COLUMN icon VARCHAR(100) DEFAULT 'task'")
            conn.commit()
            print("Successfully added 'icon' column.")
        else:
            print("'icon' column already exists.")
            
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
