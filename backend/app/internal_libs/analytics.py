import re
import uuid
from typing import Any
from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..models.client_metadata import ClientMetadata
from ..models.data_type import DataType

def process_analytics_request(client_id: str, task_text: str) -> str:
    
    """
    Counts company mention and replaces {@metadata@CompanyName} placeholders
    with actual metadata from the database.
    
    Args:
        clientid: UUID of the client (owner_id).
        request: The input string containing placeholders.
        
    Returns:
        The processed string with metadata substituted.
    """
    print ('lqwdjklalskdj----------')
    # 1. Find all {@metadata@NAME} placeholders
    pattern = r'\{@metadata@([^}]+)\}'
    placeholders = re.findall(pattern, task_text)
    
    if not placeholders:
        return request
    
    # 2. Setup database session
    db: Session = SessionLocal()
    
    try:
        # Convert clientid to UUID if it's a string
        client_uuid = uuid.UUID(client_id) if isinstance(client_id, str) else client_id
        
        result_text = task_text
        
        # 3. Process each unique placeholder
        for name in set(placeholders):
            # Find the DataType for this name
            data_type = db.query(DataType).filter(DataType.type == name).first()
            if not data_type:
                # If data type not found, replace placeholder with empty string
                result_text = result_text.replace(f'{{@metadata@{name}}}', "")
                continue
                
            # Find the ClientMetadata for this client and data type
            client_metadata = db.query(ClientMetadata).filter(
                ClientMetadata.owner_id == client_uuid,
                ClientMetadata.data_type_id == data_type.id
            ).first()
            
            replacement_value = ""
            if client_metadata and client_metadata.meta_data:
                md = client_metadata.meta_data
                
                # Handle different formats of metadata content
                if "values" in md and isinstance(md["values"], list):
                    # It's an array of items
                    replacement_value = " or ".join(str(v) for v in md["values"])
                elif "value" in md:
                    # It's a single value (possibly multiline)
                    val = str(md["value"])
                    if "\n" in val:
                        replacement_value = " or ".join(line.strip() for line in val.split("\n") if line.strip())
                    else:
                        replacement_value = val
                else:
                    # Fallback for unexpected JSON structure
                    replacement_value = str(md)
            
            # Replace all occurrences of this placeholder
            result_text = result_text.replace(f'{{@metadata@{name}}}', replacement_value)
            
        return result_text
        
    finally:
        db.close()
