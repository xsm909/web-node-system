import json
from app.core.database import SessionLocal
from app.models.schema import Schema

def seed_schemas():
    db = SessionLocal()
    try:
        # Clean up existing to allow re-running and replacing
        db.query(Schema).filter(Schema.key.in_(["company-info", "goody", "competitor"])).delete(synchronize_session=False)
        db.commit()

        # 1. Create 'goody' schema
        goody_content = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "string",
            "title": "Goody (Product)"
        }
        goody_schema = Schema(
            key="goody", 
            content=goody_content, 
            category="Common|Info", 
            meta={"tags": ["common", "info"]},
            is_system=False
        )
        db.add(goody_schema)

        # 2. Create 'competitor' schema
        competitor_content = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "string",
            "title": "Competitor"
        }
        competitor_schema = Schema(
            key="competitor", 
            content=competitor_content, 
            category="Common|Info", 
            meta={"tags": ["common", "info"]},
            is_system=False
        )
        db.add(competitor_schema)

        # 3. Create 'company-info' schema referencing the others
        # ... (rest of content)
        company_schema_content = {
            # ... kept same ...
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
                },
                "goodies": {
                    "type": "array",
                    "title": "Товары (Goodies)",
                    "items": {
                        "$ref": "goody"
                    }
                },
                "competitors": {
                    "type": "array",
                    "title": "Конкуренты (Competitors)",
                    "items": {
                        "$ref": "competitor"
                    }
                }
            },
            "required": ["company_name", "address"]
        }
        
        company_schema = Schema(
            key="company-info", 
            content=company_schema_content, 
            category="Common|Info", 
            meta={"tags": ["common", "info"]},
            is_system=False
        )
        db.add(company_schema)

        db.commit()
        print("Successfully seeded 'goody', 'competitor', and 'company-info' schemas.")

    except Exception as e:
        print(f"Error seeding schema: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_schemas()
