import os
import sys
import uuid
from sqlalchemy.orm import Session

# Add current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.database import SessionLocal, engine
from app.models.prompt import Prompt
from app.schemas.prompt import PromptCreate, Prompt as PromptSchema
from app.internal_libs.context_lib import project_id_context

def verify():
    print("Verifying Prompts Project ID Support...")
    db = SessionLocal()
    try:
        # 1. Test Schema Validation
        project_id = uuid.uuid4()
        entity_id = uuid.uuid4()
        
        prompt_in = PromptCreate(
            entity_id=entity_id,
            entity_type="test",
            content={"text": "Hello world"},
            datatype="text",
            project_id=project_id
        )
        print(f"Schema validation successful. project_id: {prompt_in.project_id}")
        
        # 2. Test Model Creation with project_id
        db_prompt = Prompt(**prompt_in.model_dump())
        db.add(db_prompt)
        db.commit()
        db.refresh(db_prompt)
        
        print(f"Successfully saved prompt with project_id: {db_prompt.project_id}")
        assert db_prompt.project_id == project_id, "Project ID mismatch!"
        
        # 3. Test Schema Out (PromptSchema)
        out_schema = PromptSchema.model_validate(db_prompt)
        print(f"Exported schema project_id: {out_schema.project_id}")
        assert out_schema.project_id == project_id, "Exported Project ID mismatch!"
        
        # 4. Cleanup
        db.delete(db_prompt)
        db.commit()
        print("Verification completed successfully!")

    except Exception as e:
        print(f"Verification failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    verify()
