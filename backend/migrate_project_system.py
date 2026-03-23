from app.core.database import engine
from sqlalchemy import text, inspect
import uuid

def migrate():
    with engine.connect() as conn:
        dialect = engine.dialect.name
        print(f"Detected dialect: {dialect}")
        
        # 1. Create projects table
        print("Creating 'projects' table...")
        try:
            statements = []
            if dialect == 'postgresql':
                statements = [
                    """CREATE TABLE IF NOT EXISTS projects (
                        id UUID PRIMARY KEY,
                        "key" VARCHAR(75) UNIQUE NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        category VARCHAR(50) NOT NULL DEFAULT 'general'
                    );""",
                    "CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(\"key\");"
                ]
            elif dialect == 'mysql':
                 statements = [
                    """CREATE TABLE IF NOT EXISTS projects (
                        id CHAR(36) PRIMARY KEY,
                        `key` VARCHAR(75) UNIQUE NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        category VARCHAR(50) NOT NULL DEFAULT 'general'
                    );""",
                    "CREATE INDEX idx_projects_key ON projects(`key`);"
                ]
            else: # sqlite or other
                statements = [
                    """CREATE TABLE IF NOT EXISTS projects (
                        id CHAR(36) PRIMARY KEY,
                        key VARCHAR(75) UNIQUE NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        category VARCHAR(50) NOT NULL DEFAULT 'general'
                    );""",
                    "CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(key);"
                ]
            
            for stmt in statements:
                conn.execute(text(stmt))
            conn.commit()
            print("Successfully ensured 'projects' table exists.")
        except Exception as e:
            print(f"Error creating projects table: {e}")

        # 2. Add project_id to other tables
        # Map requested names to possible actual table names
        table_mapping = {
            'metadata': ['metadata', 'records'],
            'agent_hints': ['agent_hints'],
            'workflows': ['workflows'],
            'schemas': ['schemas'],
            'reports': ['reports'],
            'prompts': ['prompts'],
            'response': ['response']
        }
        
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        print(f"Existing tables: {existing_tables}")
        
        for requested_name, possible_names in table_mapping.items():
            actual_table = next((t for t in possible_names if t in existing_tables), None)
            
            if not actual_table:
                print(f"Could not find table for {requested_name} (tried {possible_names}). Skipping.")
                continue
                
            print(f"Updating table '{actual_table}' (requested: {requested_name})...")
            
            # Check if column exists
            columns = [c['name'] for c in inspector.get_columns(actual_table)]
            if 'project_id' in columns:
                print(f"Column 'project_id' already exists in '{actual_table}'.")
            else:
                try:
                    col_type = "UUID" if dialect == 'postgresql' else "CHAR(36)"
                    if dialect == 'postgresql':
                        conn.execute(text(f"ALTER TABLE {actual_table} ADD COLUMN IF NOT EXISTS project_id {col_type};"))
                    else:
                        conn.execute(text(f"ALTER TABLE {actual_table} ADD COLUMN project_id {col_type};"))
                    conn.commit()
                    print(f"Successfully added 'project_id' to '{actual_table}'.")
                except Exception as e:
                    print(f"Error adding column to '{actual_table}': {e}")
            
            # Add Foreign Key (if not SQLite)
            if dialect != 'sqlite':
                try:
                    conn.execute(text(f"ALTER TABLE {actual_table} ADD CONSTRAINT fk_{actual_table}_project_id FOREIGN KEY (project_id) REFERENCES projects(id);"))
                    conn.commit()
                    print(f"Successfully added FK to '{actual_table}'.")
                except Exception as e:
                    print(f"Error adding FK to '{actual_table}': {e}")
                
            # Add Index
            try:
                index_name = f"idx_{actual_table}_project_id"
                if dialect == 'postgresql':
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {actual_table}(project_id);"))
                else: # mysql/sqlite
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {actual_table}(project_id);"))
                conn.commit()
                print(f"Successfully ensured index exists on '{actual_table}'.")
            except Exception as e:
                print(f"Error adding index to '{actual_table}': {e}")

if __name__ == "__main__":
    migrate()
