"""
Live HTTP API test - tests exactly what the frontend calls.
"""
import sys
sys.path.insert(0, '.')
import requests

BASE_URL = "http://localhost:8000"

def login(username, password):
    r = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    if r.status_code != 200:
        print(f"  LOGIN FAILED: {r.status_code} {r.text}")
        return None
    return r.json().get("access_token")

def api_get(token, path):
    r = requests.get(f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {token}"})
    return r.status_code, r.json() if r.ok else r.text

def test_user(username, password):
    print(f"\n=== Testing as {username} ===")
    token = login(username, password)
    if not token:
        return
    print(f"  Login OK")
    
    status, users = api_get(token, "/workflows/users")
    print(f"  GET /workflows/users => {status}, got {len(users) if isinstance(users, list) else users}")
    
    # Test own workflows
    status, me = api_get(token, "/auth/me")
    if status == 200:
        uid = me["id"]
        status2, wfs = api_get(token, f"/workflows/users/{uid}/workflows")
        print(f"  GET /workflows/users/{uid}/workflows => {status2}, got {len(wfs) if isinstance(wfs, list) else wfs}")
    
    status, common = api_get(token, "/workflows/common")
    print(f"  GET /workflows/common => {status}, got {len(common) if isinstance(common, list) else common}")
    
    # Try to create a workflow
    create_r = requests.post(f"{BASE_URL}/workflows/workflows",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": f"Test from {username}", "owner_id": "personal", "category": "personal"}
    )
    print(f"  POST /workflows/workflows (owner_id='personal') => {create_r.status_code}: {create_r.text[:200]}")
    
    if status == 200 and me:
        uid = me["id"]
        create_r2 = requests.post(f"{BASE_URL}/workflows/workflows",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": f"Test2 from {username}", "owner_id": uid, "category": "personal"}
        )
        print(f"  POST /workflows/workflows (owner_id='{uid}') => {create_r2.status_code}: {create_r2.text[:200]}")

if __name__ == "__main__":
    test_user("admin", "admin123")
    test_user("manager1", "manager123")
    test_user("client1", "client123")
