import sqlite3
import json
import os

# Database Path
DB_PATH = "/Users/Shared/Work/Web/web-node-system/backend/test.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

query = "SELECT name FROM node_types"
cursor.execute(query)

rows = cursor.fetchall()
for row in rows:
    print(f"Node Type: {row[0]}")

conn.close()
