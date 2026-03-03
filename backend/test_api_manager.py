import requests

API_URL = "http://localhost:8000"

def test_api():
    print("Logging in as manager1...")
    resp = requests.post(f"{API_URL}/auth/token", data={"username": "manager1", "password": "manager123"})
    if resp.status_code != 200:
        print("Login failed:", resp.text)
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n--- Getting list of common workflows ---")
    resp = requests.get(f"{API_URL}/workflows/common", headers=headers)
    print("List Status:", resp.status_code)
    common_wfs = resp.json()
    if not isinstance(common_wfs, list) or len(common_wfs) == 0:
        print("No common workflows found.")
        return
    
    first_wf = common_wfs[0]
    wf_id = first_wf["id"]
    print(f"Found common workflow: {first_wf['name']} ({wf_id})")

    print(f"\n--- Testing Run Common Workflow {wf_id} ---")
    resp = requests.post(f"{API_URL}/workflows/workflows/{wf_id}/run", json={"target_client_id": None}, headers=headers)
    print("Run Status:", resp.status_code)
    print("Run Response:", resp.text)
    
    if resp.status_code == 200:
        exec_id = resp.json().get("execution_id")
        print(f"\n--- Polling execution {exec_id} ---")
        resp = requests.get(f"{API_URL}/workflows/executions/{exec_id}", headers=headers)
        print("Poll Status:", resp.status_code)
        print("Poll Response:", resp.text)

if __name__ == "__main__":
    test_api()
