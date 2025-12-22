# Useful for debugging purposes when you don't want to waste GPT4-Vision credits
# Setting to True will stream a mock response instead of calling the OpenAI API
# TODO: Should only be set to true when value is 'True', not any abitrary truthy value
import os

NUM_VARIANTS = 4

# 🔧 OPTIMIZATION: Only generate ACTIVE variants to save tokens
# Variant 1 (index 0): gpt-4o-mini - DISABLED
# Variant 2 (index 1): gpt-4.1-mini - DISABLED
# Variant 3 (index 2): gpt-4.1 (prod) or gpt-4.1-mini (dev) - ACTIVE
# Variant 4 (index 3): gpt-5-mini - DISABLED
ACTIVE_VARIANT_INDEX = 2  # Variant 3 is the only active one

# Determine model for active variant based on NODE_ENV
# PROD: gpt-4.1 (full model)
# DEV: gpt-4.1-mini (cheaper for testing)
NODE_ENV = os.environ.get("NODE_ENV", "development")
if NODE_ENV == "production":
    VARIANT_3_MODEL = "gpt-4.1"  # Production: use full model
else:
    VARIANT_3_MODEL = "gpt-4.1-mini"  # Development/other: use cheaper model

# LLM-related
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", None)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", None)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", None)
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", None)

# Image generation (optional)
REPLICATE_API_KEY = os.environ.get("REPLICATE_API_KEY", None)

# Debugging-related

SHOULD_MOCK_AI_RESPONSE = os.environ.get("MOCK", "").lower() in ("true", "1", "yes")
IS_DEBUG_ENABLED = os.environ.get("IS_DEBUG_ENABLED", "").lower() in ("true", "1", "yes")
DEBUG_DIR = os.environ.get("DEBUG_DIR", "")

# Set to True when running in production (on the hosted version)
# Used as a feature flag to enable or disable certain features
IS_PROD = os.environ.get("IS_PROD", "").lower() in ("true", "1", "yes")
