"""Backend configuration - single source of truth."""

from pathlib import Path

# API Configuration
API_PREFIX = "/api"
API_VERSION = "1.0"

# Database paths (absolute)
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "app.db"
API_DB_PATH = DATA_DIR / "api.db"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# CORS
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Server
HOST = "127.0.0.1"
PORT = 7001

# Logging
LOG_DB_PATH = True  # Log absolute DB path on each request
LOG_REQUESTS = True  # Log all HTTP requests
