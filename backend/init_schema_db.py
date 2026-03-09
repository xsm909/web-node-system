import sys
import os

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.database import engine, Base
# Import all models to ensure they are registered with Base metadata
from app.models import __all__

def init_db():
    print("Creating new tables for Schema Management System...")
    # create_all only creates tables that do not exist yet
    Base.metadata.create_all(bind=engine)
    print("Done!")

if __name__ == "__main__":
    init_db()
