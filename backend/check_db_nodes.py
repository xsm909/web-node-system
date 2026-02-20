import sqlite3
import json
import os

# Database Path
DB_PATH = "/Users/Shared/Work/Web/web-node-system/backend/test.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

query = "SELECT id, name, parameters, code FROM node_types WHERE name LIKE '%echo%'"
cursor.execute(query)

rows = cursor.fetchall()
if not rows:
    print("No echo nodes found.")
else:
    for row in rows:
        print(f"ID: {row[0]}")
        print(f"Name: {row[1]}")
        params = json.loads(row[2]) if row[2] else []
        print(f"Parameters: {json.dumps(params, indent=2)}")
        print(f"Code Sample:\n{row[3][:500]}...")
        print("-" * 20)

conn.close()
