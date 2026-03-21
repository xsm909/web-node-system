
import uuid
from app.core.database import SessionLocal
from app.models.workflow import Workflow
from app.models.node import NodeType
from app.models.schema import Record
from app.models import LockData
from app.core.locks import raise_if_locked

def test_internal_locks():
    db = SessionLocal()
    try:
        # 1. Test Workflow Lock
        wf = db.query(Workflow).first()
        if wf:
            wf_id = wf.id
            print(f"Testing internal lock for Workflow {wf_id}")
            
            # Lock it
            lock = db.query(LockData).filter(LockData.entity_id == wf_id, LockData.entity_type == "workflows").first()
            if not lock:
                lock = LockData(entity_id=wf_id, entity_type="workflows")
                db.add(lock)
                db.commit()
            
            print("Trying raise_if_locked for locked workflow...")
            try:
                raise_if_locked(db, wf_id, "workflows")
                print("FAILED: raise_if_locked did not raise for locked workflow")
            except Exception as e:
                print(f"SUCCESS: Caught expected exception: {e}")
        else:
            print("No workflows found to test.")

        # 2. Test NodeType Lock
        node = db.query(NodeType).first()
        if node:
            node_id = node.id
            print(f"Testing internal lock for NodeType {node_id}")
            
            lock = db.query(LockData).filter(LockData.entity_id == node_id, LockData.entity_type == "node_types").first()
            if not lock:
                lock = LockData(entity_id=node_id, entity_type="node_types")
                db.add(lock)
                db.commit()
                
            try:
                raise_if_locked(db, node_id, "node_types")
                print("FAILED: raise_if_locked did not raise for locked node_type")
            except Exception as e:
                print(f"SUCCESS: Caught expected exception: {e}")
        else:
            print("No node_types found to test.")

        # 3. Test Record Lock
        rec = db.query(Record).first()
        if rec:
            rec_id = rec.id
            print(f"Testing internal lock for Record {rec_id}")
            
            lock = db.query(LockData).filter(LockData.entity_id == rec_id, LockData.entity_type == "records").first()
            if not lock:
                lock = LockData(entity_id=rec_id, entity_type="records")
                db.add(lock)
                db.commit()
                
            try:
                raise_if_locked(db, rec_id, "records")
                print("FAILED: raise_if_locked did not raise for locked record")
            except Exception as e:
                print(f"SUCCESS: Caught expected exception: {e}")
        else:
            print("No records found to test.")

    finally:
        db.close()

if __name__ == "__main__":
    test_internal_locks()
