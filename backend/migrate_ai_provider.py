import os
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
from app.models import AiProvider # ensure model is registered

def migrate():
    print("Creating ai_providers table (if not exists)...")
    AiProvider.metadata.create_all(bind=engine)
    print("Migration finished!")

if __name__ == "__main__":
    migrate()
