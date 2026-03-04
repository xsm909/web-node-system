import requests
import uuid

API_URL = "http://localhost:8000"

def test_manager_assignment():
    print("Logging in as admin...")
    resp = requests.post(f"{API_URL}/auth/token", data={"username": "admin", "password": "admin123"})
    if resp.status_code != 200:
        print("Login failed:", resp.text)
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- Listing managers ---")
    resp = requests.get(f"{API_URL}/admin/managers", headers=headers)
    print("Managers Status:", resp.status_code)
    managers = resp.json()
    print("Managers:", [m["username"] for m in managers])

    # Find manager1 and client1
    manager1 = next((m for m in managers if m["username"] == "manager1"), None)
    
    resp = requests.get(f"{API_URL}/admin/users", headers=headers)
    users = resp.json()
    client1 = next((u for u in users if u["username"] == "client1"), None)

    if not manager1 or not client1:
        print("Error: manager1 or client1 not found. Please run seed script.")
        return

    manager_id = manager1["id"]
    client_id = client1["id"]

    print(f"\n--- Assigning manager1 ({manager_id}) to client1 ({client_id}) ---")
    resp = requests.post(f"{API_URL}/admin/users/{manager_id}/assign/{client_id}", headers=headers)
    print("Assign Status:", resp.status_code)
    print("Assign Response:", resp.json())

    print("\n--- Verifying assignment in user list ---")
    resp = requests.get(f"{API_URL}/admin/users", headers=headers)
    users = resp.json()
    verified_client = next((u for u in users if u["id"] == client_id), None)
    if verified_client:
        assigned_managers = verified_client.get("assigned_managers", [])
        manager_usernames = [m["username"] for m in assigned_managers]
        print(f"Client1 assigned managers: {manager_usernames}")
        if "manager1" in manager_usernames:
            print("SUCCESS: Manager assigned correctly.")
        else:
            print("FAILED: Manager not found in assigned_managers list.")
    else:
        print("FAILED: Client not found.")

    print(f"\n--- Unassigning manager1 from client1 ---")
    resp = requests.delete(f"{API_URL}/admin/users/manager-assignment/{manager_id}/{client_id}", headers=headers)
    print("Unassign Status:", resp.status_code)
    print("Unassign Response:", resp.json())

    print("\n--- Verifying unassignment ---")
    resp = requests.get(f"{API_URL}/admin/users", headers=headers)
    users = resp.json()
    verified_client = next((u for u in users if u["id"] == client_id), None)
    if verified_client:
        assigned_managers = verified_client.get("assigned_managers", [])
        print(f"Client1 assigned managers count: {len(assigned_managers)}")
        if len(assigned_managers) == 0:
            print("SUCCESS: Manager unassigned correctly.")
        else:
            print("FAILED: Manager still assigned.")

if __name__ == "__main__":
    test_manager_assignment()
