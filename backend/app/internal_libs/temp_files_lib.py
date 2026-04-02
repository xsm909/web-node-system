import os
import time
import uuid
from typing import Union, Dict, Any
from .logger_lib import system_log

# Define the temporary storage directory relative to this file
TEMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "resources", "temp_storage"))

def ensure_temp_dir():
    """Ensures the temporary storage directory exists."""
    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR, exist_ok=True)

def cleanup_old_files():
    """Removes files older than 24 hours from the temporary storage."""
    ensure_temp_dir()
    now = time.time()
    cutoff = now - (24 * 3600)  # 24 hours in seconds
    
    try:
        for filename in os.listdir(TEMP_DIR):
            file_path = os.path.join(TEMP_DIR, filename)
            if os.path.isfile(file_path):
                # Check if file is older than 24 hours
                if os.path.getmtime(file_path) < cutoff:
                    try:
                        os.remove(file_path)
                        system_log(f"Cleaned up old temp file: {filename}", level="system")
                    except Exception as e:
                        system_log(f"Error removing temp file {filename}: {str(e)}", level="error")
    except Exception as e:
        system_log(f"Error during temp storage cleanup: {str(e)}", level="error")

def save(data: Union[str, bytes], file_type: str = "txt", filename: str = None) -> Dict[str, Any]:
    """
    Saves data to a temporary file and returns its path and success status.
    Automatically triggers cleanup of old files.
    
    file_type: e.g. 'txt', 'json', 'csv', 'png', etc.
    filename: optional name, if not provided a unique one will be generated.
    """
    ensure_temp_dir()
    cleanup_old_files()
    
    try:
        if filename is None:
            # Generate a unique filename if not provided
            filename = f"temp_{uuid.uuid4().hex}"
            
        # Ensure it has the correct extension based on file_type
        # if file_type doesn't start with a dot, add one
        ext = file_type if file_type.startswith(".") else f".{file_type}"
        if not filename.endswith(ext):
            filename = f"{filename}{ext}"
        
        # Guard against directory traversal
        filename = os.path.basename(filename)
        file_path = os.path.join(TEMP_DIR, filename)
        
        # Determine write mode based on data type
        if isinstance(data, (bytes, bytearray)):
            mode = "wb"
        else:
            mode = "w"
            if not isinstance(data, str):
                # Convert non-string/non-bytes to string (e.g., dict, list)
                import json
                try:
                    data = json.dumps(data, indent=2, default=str)
                except:
                    data = str(data)
        
        with open(file_path, mode) as f:
            f.write(data)
            
        system_log(f"Saved temp file: {filename}", level="system")
        return {
            "path": file_path,
            "success": True,
            "filename": filename
        }
    except Exception as e:
        system_log(f"Error saving temp file: {str(e)}", level="error")
        return {
            "path": "",
            "success": False,
            "error": str(e)
        }

def download(filename: str) -> Dict[str, Any]:
    """
    Returns information needed to download the file from the frontend.
    Verifies if the file exists and is within the temp storage.
    """
    try:
        if not filename:
            return {"success": False, "error": "Filename is required"}
            
        # Guard against directory traversal
        filename = os.path.basename(filename)
        file_path = os.path.join(TEMP_DIR, filename)
        
        system_log(f"Attempting to download: {filename} from {file_path}", level="system")
        
        if not os.path.exists(file_path):
            system_log(f"File not found for download: {file_path}", level="error")
            return {"success": False, "error": "File not found"}
            
        import urllib.parse
        encoded_filename = urllib.parse.quote(filename)
        
        system_log(f"Generated download URL for: {filename}", level="system")
        
        # Return a relative URL that will be served by the new router
        # Note: Frontend should prepend the base API URL if needed
        return {
            "success": True,
            "filename": filename,
            "url": f"/files/download/{encoded_filename}",
            "type": "file_download"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def view(filename: str) -> Dict[str, Any]:
    """
    Returns information needed to preview a file on the frontend.
    The frontend should detect the type and open an appropriate viewer.
    """
    res = download(filename)
    if res.get("success"):
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext == "json":
            res["type"] = "json_preview"
        elif ext == "md":
            res["type"] = "markdown_preview"
        elif ext in ("txt", "log", "csv"):
            res["type"] = "text_preview"
        else:
            res["type"] = "file_download"
    return res

def _extract_text(data: Any) -> Any:
    """Extracts raw text if data is a dict with a single string value."""
    if isinstance(data, dict) and len(data) == 1:
        val = list(data.values())[0]
        if isinstance(val, str):
            return val
    return data

def show_json(data: Any) -> Dict[str, Any]:
    """Saves data as JSON and returns a json_preview command."""
    res = save(data, file_type="json")
    if res.get("success"):
        return view(res["filename"])
    return res

def show_md(data: Any) -> Dict[str, Any]:
    """Saves data as Markdown and returns a markdown_preview command."""
    res = save(_extract_text(data), file_type="md")
    if res.get("success"):
        return view(res["filename"])
    return res

def show_txt(data: Any) -> Dict[str, Any]:
    """Converts data to string, saves as TXT and returns a text_preview command."""
    res = save(str(_extract_text(data)), file_type="txt")
    if res.get("success"):
        return view(res["filename"])
    return res
