import json
from app.core.database import SessionLocal
from app.models.schema import Schema

def seed_schemas():
    db = SessionLocal()
    try:
        # Check if company-info already exists
        existing = db.query(Schema).filter(Schema.key == "company-info").first()
        if existing:
            print("Schema 'company-info' already exists.")
            return

        # We use a valid public JSON Schema for an address. 
        # Note: schema.org URLs generally return HTML/JSON-LD, not raw JSON Schema.
        # So we use the official json-schema.org example to ensure $ref resolution works correctly.
        company_schema_content = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "title": "Company Information",
            "properties": {
                "company_name": {
                    "type": "string",
                    "title": "Company Name"
                },
                "industry": {
                    "type": "string",
                    "title": "Industry"
                },
                "address": {
                    "$ref": "https://json-schema.org/learn/examples/address.schema.json",
                    "title": "Headquarters Address"
                }
            },
            "required": ["company_name", "address"]
        }

        new_schema = Schema(
            key="company-info",
            content=company_schema_content,
            is_system=False
        )
        db.add(new_schema)
        db.commit()
        print("Successfully seeded 'company-info' schema.")

    except Exception as e:
        print(f"Error seeding schema: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_schemas()
