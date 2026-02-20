from ..core.database import SessionLocal
from ..models.credential import Credential

def get_credential_by_key(key: str) -> str | None:
    """
    Retrieve a credential value by its key from the database.
    Used by internal libraries and nodes.
    """
    db = SessionLocal()
    try:
        credential = db.query(Credential).filter(Credential.key == key).first()
        if credential:
            return credential.value
        return None
    finally:
        db.close()

def GetAPIFromCredetionalByKey(key: str) -> str | None:
    """Alias as requested by user."""
    return get_credential_by_key(key)
