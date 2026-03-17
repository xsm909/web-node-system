from app.core.database import engine
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.report import Report
import json

def migrate():
    with engine.connect() as conn:
        print("Migrating 'reports' table...")
        
        # 1. Rename 'query' to 'code' if it exists
        try:
            conn.execute(text("ALTER TABLE reports RENAME COLUMN query TO code;"))
            conn.commit()
            print("Successfully renamed 'query' to 'code'.")
        except Exception as e:
            print(f"Column 'query' might not exist or already renamed: {e}")
            
        # 2. Add 'schema_json' column if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE reports ADD COLUMN schema_json JSONB DEFAULT '{}'::jsonb;"))
            conn.commit()
            print("Successfully added 'schema_json' column.")
        except Exception as e:
            print(f"Column 'schema_json' might already exist: {e}")

    # 3. Migrate existing data: wrap SQL into Python function
    print("Migrating existing report data to Python logic...")
    try:
        with Session(engine) as session:
            reports = session.query(Report).all()
            for r in reports:
                # If code doesn't look like Python function, wrap it
                if "def GenerateReport" not in r.code:
                    sql_query = r.code.replace("'", "\\'")
                    new_code = f"def ParametersProcessing(parameters, mode):\n    return parameters, True\n\ndef GenerateReport(parameters):\n    # Auto-migrated from SQL\n    data = libs.database_query('''{r.code}''', parameters)\n    return data, True"
                    r.code = new_code
                    print(f"Wrapped report '{r.name}' into Python logic.")
            session.commit()
            print("Successfully migrated report data.")
    except Exception as e:
        print(f"Error migrating report data: {e}")

if __name__ == "__main__":
    migrate()
