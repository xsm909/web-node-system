import sqlite3
import os

db_path = 'test.db'
backup_path = 'test.db.bak'

if not os.path.exists(backup_path):
    print(f"Error: {backup_path} not found!")
    exit(1)

# Remove broken test.db if exists
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Rebuilding database using actual schemas from backup...")

cursor.execute(f"ATTACH DATABASE '{backup_path}' AS old_db")

# Recreate tables based on exact schemas from .schema output
cursor.executescript("""
CREATE TABLE users (
    id UUID NOT NULL, 
    username VARCHAR(100) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    role VARCHAR(7) NOT NULL, 
    PRIMARY KEY (id)
);
INSERT INTO users SELECT * FROM old_db.users;

CREATE TABLE workflows (
    id UUID NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    owner_id VARCHAR(50) NOT NULL, 
    created_by UUID NOT NULL, 
    graph JSON NOT NULL, 
    status VARCHAR(7), 
    workflow_data JSON, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
    updated_at DATETIME, 
    category VARCHAR(50) DEFAULT 'personal',
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by) REFERENCES users (id)
);
-- Note: Cast owner_id to string to allow our future "common" values
INSERT INTO workflows (id, name, owner_id, created_by, graph, status, workflow_data, created_at, updated_at, category)
SELECT id, name, CAST(owner_id AS TEXT), created_by, graph, status, workflow_data, created_at, updated_at, category FROM old_db.workflows;

CREATE TABLE workflow_executions (
    id UUID NOT NULL, 
    workflow_id UUID NOT NULL, 
    status VARCHAR(7), 
    result_summary TEXT, 
    logs JSON, 
    runtime_data JSON, 
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
    finished_at DATETIME, 
    PRIMARY KEY (id), 
    FOREIGN KEY(workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
);
INSERT INTO workflow_executions SELECT * FROM old_db.workflow_executions;

CREATE TABLE node_executions (
    id UUID NOT NULL, 
    execution_id UUID NOT NULL, 
    node_id VARCHAR(100) NOT NULL, 
    status VARCHAR(7), 
    output JSON, 
    error TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(execution_id) REFERENCES workflow_executions (id) ON DELETE CASCADE
);
INSERT INTO node_executions SELECT * FROM old_db.node_executions;

CREATE TABLE node_types (
    id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    version VARCHAR(20) NOT NULL, 
    description TEXT, 
    code TEXT NOT NULL, 
    input_schema JSON NOT NULL, 
    output_schema JSON NOT NULL, 
    parameters JSON NOT NULL, 
    category VARCHAR(50), 
    icon VARCHAR(100), 
    is_async BOOLEAN, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);
INSERT INTO node_types SELECT * FROM old_db.node_types;

CREATE TABLE manager_client (
    manager_id UUID NOT NULL, 
    client_id UUID NOT NULL, 
    PRIMARY KEY (manager_id, client_id), 
    FOREIGN KEY(manager_id) REFERENCES users (id), 
    FOREIGN KEY(client_id) REFERENCES users (id)
);
INSERT INTO manager_client SELECT * FROM old_db.manager_client;

CREATE TABLE credentials (
    id UUID NOT NULL, 
    "key" VARCHAR(100) NOT NULL, 
    value TEXT NOT NULL, 
    type VARCHAR(50) NOT NULL, 
    description VARCHAR(255), 
    PRIMARY KEY (id)
);
INSERT INTO credentials SELECT * FROM old_db.credentials;

CREATE TABLE ai_results (
    uid VARCHAR(36) NOT NULL, 
    result VARCHAR, 
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
    PRIMARY KEY (uid)
);
INSERT INTO ai_results SELECT * FROM old_db.ai_results;
""")

conn.commit()
conn.close()
print("Migration completed successfully.")
