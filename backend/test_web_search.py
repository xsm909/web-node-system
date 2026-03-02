import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app.internal_libs.openai_lib
# mock api key
app.internal_libs.openai_lib._get_api_key = lambda: "sk-proj-dummy-key"

from app.internal_libs.openai_lib import perform_web_search

print("Starting search...")
try:
    res = perform_web_search("test")
    print("Result:", res)
except Exception as e:
    print("Error:", repr(e))
