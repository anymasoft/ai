import os
from datetime import datetime, timedelta

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:7001")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

GOOGLE_OAUTH_REDIRECT_URI = f"{BACKEND_URL}/api/auth/callback/google"
GOOGLE_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token"
GOOGLE_OAUTH_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Session configuration
SESSION_EXPIRATION_DAYS = 30

GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
]

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
