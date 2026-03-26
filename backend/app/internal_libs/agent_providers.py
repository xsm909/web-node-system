from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class AgentProvider(ABC):
    """
    Abstract base class for AI providers used by the Agent.
    """
    def __init__(self, model: str, api_key: str, base_url: Optional[str] = None):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url

    @abstractmethod
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> str:
        """
        Generates a response from the AI model.
        """
        pass

def get_provider_class(model_name: str):
    """
    Factory to get the correct provider class based on model name.
    """
    model_lower = model_name.lower()
    
    if "gemini" in model_lower:
        from .gemini.gemini_lib import GeminiAgentProvider
        return GeminiAgentProvider
    elif "sonar" in model_lower or "llama" in model_lower:
        from .perplexity.perplexity_lib import PerplexityAgentProvider
        return PerplexityAgentProvider
    elif "grok" in model_lower:
        from .grok.grok_lib import GrokAgentProvider
        return GrokAgentProvider
    else:
        from .openai.openai_lib import OpenAIAgentProvider
        return OpenAIAgentProvider
