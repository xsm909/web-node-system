import jsonschema
from sqlalchemy.orm import Session
from ..models.schema import Schema, ExternalSchemaCache
from .cache_manager import fetch_and_cache_external_schema

class DatabaseRefResolver(jsonschema.RefResolver):
    """
    Custom RefResolver that uses our database (both local schemas and external cache)
    to resolve $ref links transparently.
    """
    def __init__(self, db: Session, base_uri: str, referrer: dict):
        super().__init__(base_uri=base_uri, referrer=referrer)
        self.db = db

    def resolve_remote(self, uri: str):
        # 1. Check if it's an internal schema key (e.g. "client-profile")
        # Internal schemas usually don't have http(s) setup so we might just use urn: or key directly
        # If uri belongs to local registry:
        internal_schema = self.db.query(Schema).filter(Schema.key == uri).first()
        if internal_schema:
            return internal_schema.content

        # 2. Check if it is cached externally
        cached = self.db.query(ExternalSchemaCache).filter(ExternalSchemaCache.url == uri).first()
        if cached:
            return cached.content
            
        # 3. If we enforce Lazy Refresh manually, we should ideally not fetch here unless necessary.
        # But if the schema is entirely missing, we might have to fetch synchronously (jsonschema resolve_remote is sync)
        # Note: in a true async environment, this sync call is blocking. The cache should be primed before validation.
        import requests
        try:
            response = requests.get(uri, headers={'Accept': 'application/json'}, timeout=5)
            response.raise_for_status()
            data = response.json()
            # Optimistically cache it synchronously
            new_cache = ExternalSchemaCache(url=uri, content=data, etag=response.headers.get("etag"))
            self.db.add(new_cache)
            self.db.commit()
            return data
        except Exception as e:
            raise jsonschema.exceptions.RefResolutionError(f"Failed to resolve {uri}: {str(e)}")


def validate_json_data(db: Session, schema: dict, data: dict):
    """
    Validates a data payload against a given JSON schema, resolving refs from the local database.
    """
    resolver = DatabaseRefResolver(db=db, base_uri="", referrer=schema)
    try:
        jsonschema.validate(instance=data, schema=schema, resolver=resolver)
        return True, None
    except jsonschema.exceptions.ValidationError as e:
        return False, e.message
    except jsonschema.exceptions.SchemaError as e:
        return False, f"Invalid schema structure: {e.message}"
    except Exception as e:
        return False, str(e)
