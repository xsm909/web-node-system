import uuid
import json
from datetime import datetime, timezone
from app.services.executor import WorkflowExecutor
from app.core.database import SessionLocal
from app.models import Workflow, WorkflowExecution, NodeType, User, RoleEnum

def test_loop():
    db = SessionLocal()
    try:
        # 1. Setup mock user
        user = db.query(User).filter(User.username == "test_user").first()
        if not user:
            user = User(username="test_user", hashed_password="pw", role=RoleEnum.admin)
            db.add(user)
            db.commit()

        # 2. Re-seed node types (especially Loop and Echo)
        # Assuming seed() was already run or we can just find them
        loop_type = db.query(NodeType).filter(NodeType.name == "Loop").first()
        echo_type = db.query(NodeType).filter(NodeType.name == "Echo").first()
        start_type = db.query(NodeType).filter(NodeType.name == "Start").first() # If exists, otherwise manually

        if not loop_type or not echo_type:
            print("Required node types not found. Run seed script first.")
            return

        # 3. Create a test workflow
        # Start -> Loop
        # Loop (THEN2_DO) -> Echo
        # Loop (THEN1_FINISH) -> (none)
        
        workflow_id = uuid.uuid4()
        graph = {
            "nodes": [
                {
                    "id": "node_start",
                    "type": "start",
                    "position": {"x": 0, "y": 0},
                    "data": {"label": "Start", "params": {}}
                },
                {
                    "id": "node_loop",
                    "type": "action",
                    "position": {"x": 200, "y": 0},
                    "data": {
                        "label": "Loop",
                        "nodeType": "Loop",
                        "params": {
                            "loop_from": 1,
                            "loop_to": 4, # Should run 3 times: 1, 2, 3
                            "MAX_THEN": 2,
                            "THEN1_FINISH": 1,
                            "THEN2_DO": 2,
                            "NODE_TYPE": "LOOP"
                        }
                    }
                },
                {
                    "id": "node_echo",
                    "type": "action",
                    "position": {"x": 400, "y": 0},
                    "data": {
                        "label": "Echo",
                        "nodeType": "Echo",
                        "params": {"text": "Loop iteration!"}
                    }
                }
            ],
            "edges": [
                {
                    "id": "e1",
                    "source": "node_start",
                    "sourceHandle": "output",
                    "target": "node_loop",
                    "targetHandle": "top"
                },
                {
                    "id": "e2",
                    "source": "node_loop",
                    "sourceHandle": "then_2", # DO branch
                    "target": "node_echo",
                    "targetHandle": "top"
                }
            ]
        }

        wf = Workflow(
            id=workflow_id,
            name="Test Loop Workflow",
            owner_id=user.id,
            graph=graph
        )
        db.add(wf)
        db.commit()

        # 4. Create execution
        execution_id = uuid.uuid4()
        execution = WorkflowExecution(
            id=execution_id,
            workflow_id=workflow_id,
            status="pending",
            created_at=datetime.now(timezone.utc)
        )
        db.add(execution)
        db.commit()

        # 5. Execute
        print(f"Starting execution {execution_id}...")
        executor = WorkflowExecutor(execution_id)
        executor.execute()

        # 6. Verify results
        db.refresh(execution)
        print(f"Execution status: {execution.status}")
        
        # Check logs for "Echo: Loop iteration!" count
        logs = execution.logs or []
        echo_count = sum(1 for log in logs if "Echo: Loop iteration!" in log.get("message", ""))
        print(f"Echo count: {echo_count} (Expected: 3)")

        if echo_count == 3:
            print("SUCCESS: Loop executed correctly!")
        else:
            print(f"FAILURE: Expected 3 iterations, got {echo_count}")

    finally:
        db.close()

if __name__ == "__main__":
    test_loop()
