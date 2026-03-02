import os
import time
from sqlalchemy import create_engine, text

# Use the docker-compose database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/workflow_db")

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        try:
            # Drop the old unique constraint on name
            # In PostgreSQL, the default name for a unique constraint on 'name' is often node_types_name_key
            conn.execute(text("ALTER TABLE node_types DROP CONSTRAINT IF EXISTS node_types_name_key;"))
            print("Dropped old unique constraint 'node_types_name_key'.")
        except Exception as e:
            print(f"Error dropping old constraint (might not exist): {e}")

        try:
            # Add the new composite unique constraint
            conn.execute(text("ALTER TABLE node_types ADD CONSTRAINT uix_node_type_name_category UNIQUE (name, category);"))
            print("Added new unique constraint 'uix_node_type_name_category'.")
        except Exception as e:
            print(f"Error adding new constraint (might already exist): {e}")

        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
