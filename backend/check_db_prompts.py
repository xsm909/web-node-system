import sqlite3
import json
import os
from uuid import UUID

def check_prompts():
    db_path = 'backend/app.db' # Adjust if different
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM prompts ORDER BY created_at DESC LIMIT 5")
        rows = cursor.fetchall()
        print(f"Found {len(rows)} recent prompts:")
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"  Entity ID: {row['entity_id']}")
            print(f"  Reference ID: {row['reference_id']}")
            print(f"  Category: {row['category']}")
            print(f"  Datatype: {row['datatype']}")
            print(f"  Meta: {row['meta']}")
            print("-" * 20)
    except Exception as e:
        print(f"Error checking prompts: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_prompts()
