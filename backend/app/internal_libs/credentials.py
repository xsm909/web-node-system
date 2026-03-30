from typing import Optional
from ..core.database import SessionLocal
from ..models.credential import Credential
from ..models.ai_provider import AiProvider

def get_credential_by_model(model_name: str) -> Optional[str]:
    """
    Retrieve a credential value strictly by AI model name from the database.
    Used by AI internal libraries.
    1. Resolves via AI Model Registry (AiProvider)
    2. Always ensures the credential is not expired.
    """
    db = SessionLocal()
    try:
        # Resolve via model name in AiProvider
        providers = db.query(AiProvider).all()
        for p in providers:
            if p.models and isinstance(p.models, dict) and "models" in p.models:
                if model_name in p.models["models"]:
                    # Found the model in this provider
                    credential = db.query(Credential).filter(
                        Credential.key == p.api_key,
                        Credential.expired == False
                    ).first()
                    if credential:
                        return credential.value
        return None
    finally:
        db.close()

def get_credential_by_key(key: str) -> Optional[str]:
    """
    Legacy/Generic lookup by credential key.
    """
    db = SessionLocal()
    try:
        credential = db.query(Credential).filter(
            Credential.key == key,
            Credential.expired == False
        ).first()
        if credential:
            return credential.value
        return None
    finally:
        db.close()

def GetAPIFromCredetionalByKey(key: str) -> Optional[str]:
    """Alias as requested by user."""
    return get_credential_by_key(key)
