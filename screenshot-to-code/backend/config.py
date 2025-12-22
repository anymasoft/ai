# Useful for debugging purposes when you don't want to waste GPT4-Vision credits
# Setting to True will stream a mock response instead of calling the OpenAI API
# TODO: Should only be set to true when value is 'True', not any abitrary truthy value
import os

NUM_VARIANTS = 1  # Fixed to 1 variant only

# LLM-related
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", None)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", None)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", None)
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", None)

# Code generation model (can be switched via CODEGEN_MODEL env var)
CODEGEN_MODEL = os.environ.get("CODEGEN_MODEL", "gpt-4.1-mini")
# Validate model
ALLOWED_MODELS = ["gpt-4.1-mini", "gpt-5.1-mini"]
if CODEGEN_MODEL not in ALLOWED_MODELS:
    print(f"[CONFIG] WARNING: CODEGEN_MODEL '{CODEGEN_MODEL}' not in allowed list {ALLOWED_MODELS}, falling back to default")
    CODEGEN_MODEL = "gpt-4.1-mini"

# Image generation (optional)
REPLICATE_API_KEY = os.environ.get("REPLICATE_API_KEY", None)

# Debugging-related

SHOULD_MOCK_AI_RESPONSE = bool(os.environ.get("MOCK", False))
IS_DEBUG_ENABLED = bool(os.environ.get("IS_DEBUG_ENABLED", False))
DEBUG_DIR = os.environ.get("DEBUG_DIR", "")

# Set to True when running in production (on the hosted version)
# Used as a feature flag to enable or disable certain features
IS_PROD = os.environ.get("IS_PROD", False)
