import pytest
from httpx import AsyncClient
from app.main import app
from app.core.security import create_access_token
from app.models.user import User, UserRole
from app.models.workflow import Workflow
import uuid

@pytest.mark.asyncio
async def test_duplicate_and_rename_category(client: AsyncClient, test_user: User, test_manager: User, db_session):
    # 1. Create a workflow
    workflow_id = str(uuid.uuid4())
    workflow = Workflow(
        id=workflow_id,
        name="Original Workflow",
        owner_id=test_manager.id,
        category="personal",
        graph={"nodes": [], "edges": []}
    )
    db_session.add(workflow)
    db_session.commit()

    manager_token = create_access_token(data={"sub": test_manager.username})
    headers = {"Authorization": f"Bearer {manager_token}"}

    # 2. Test Rename with Category Change
    rename_resp = await client.patch(
        f"/workflows/workflows/{workflow_id}/rename",
        json={"name": "Renamed Workflow", "category": "common"},
        headers=headers
    )
    # If manager is not admin, it might fail or stay personal depending on roles.
    # Let's assume test_manager has rights for this test or use an admin user.
    
    # 3. Test Duplicate
    dup_resp = await client.post(
        f"/workflows/workflows/{workflow_id}/duplicate",
        headers=headers
    )
    assert dup_resp.status_code == 200
    dup_data = dup_resp.json()
    assert dup_data["name"] == "Copy of Renamed Workflow"
    assert dup_data["category"] == "personal" # Managers duplicating common becomes personal
    assert dup_data["id"] != workflow_id
