import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@localhost:5432/workflow_db")

def verify():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Checking if 'response' table exists...")
        res = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'response'
            );
        """))
        exists = res.scalar()
        if not exists:
            print("Error: 'response' table does not exist!")
            exit(1)
        print("Table 'response' exists.")
        
        print("\nChecking columns:")
        res = conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'response'
            ORDER BY ordinal_position;
        """))
        for row in res.fetchall():
            print(f"- {row.column_name}: {row.data_type} (Nullable: {row.is_nullable})")
            
        # Verify regclass columns specifically
        print("\nVerifying specific types:")
        res = conn.execute(text("""
            SELECT column_name, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'response' AND (column_name = 'entity_type' OR column_name = 'reference_type');
        """))
        for row in res.fetchall():
            print(f"- {row.column_name} UDT: {row.udt_name}")

        print("\nVerification completed.")

if __name__ == "__main__":
    verify()
