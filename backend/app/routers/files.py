from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
import os
from ..internal_libs import temp_files_lib
from ..core.security import get_current_user
from ..models.user import User

router = APIRouter(prefix="/files", tags=["files"])

@router.get("/download/{filename}")
def download_temp_file(filename: str):
    """
    Serves a temporary file for download.
    """
    # Guard against directory traversal
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(temp_files_lib.TEMP_DIR, safe_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found or expired")
    
    # Return the file as a response
    return FileResponse(
        path=file_path,
        filename=safe_filename,
        media_type='application/octet-stream'
    )
