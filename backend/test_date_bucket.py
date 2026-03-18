import sys
import os
from datetime import datetime
import pytz

# Add current directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.core.database import engine
from sqlalchemy import text

def test_date_bucket():
    test_cases = [
        ("hour", "2024-01-15 10:35:00+00", "2024-01-15 10:00:00+00"),
        ("day", "2024-01-15 10:35:00+00", "2024-01-15 00:00:00+00"),
        ("month", "2024-01-15 10:35:00+00", "2024-01-01 00:00:00+00"),
        ("15 days", "2024-01-10 10:35:00+00", "2024-01-01 00:00:00+00"),
        ("15 days", "2024-01-20 10:35:00+00", "2024-01-16 00:00:00+00"),
    ]

    with engine.connect() as conn:
        print("Verifying date_bucket_floor function...")
        for mode, ts_str, expected_str in test_cases:
            query = text("SELECT date_bucket_floor(:ts, :mode)")
            result = conn.execute(query, {"ts": ts_str, "mode": mode}).scalar()
            
            # Convert expected_str to datetime for comparison
            expected = datetime.fromisoformat(expected_str.replace(" ", "T"))
            
            if result == expected:
                print(f"✅ PASS: mode='{mode}', input='{ts_str}', expected='{expected_str}', got='{result}'")
            else:
                print(f"❌ FAIL: mode='{mode}', input='{ts_str}', expected='{expected_str}', got='{result}'")
                sys.exit(1)

if __name__ == "__main__":
    try:
        test_date_bucket()
        print("\nAll tests passed successfully!")
    except Exception as e:
        print(f"Error during verification: {e}")
        # If the function doesn't exist yet, we might need to trigger the lifespan
        print("Note: If the function was just added to main.py, you may need to restart the backend service to trigger the initialization.")
