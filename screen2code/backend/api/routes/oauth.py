import secrets
from datetime import datetime

from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse

from api.oauth.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_AUTH_URL,
    GOOGLE_OAUTH_SCOPES,
)

router = APIRouter(prefix="/api/oauth", tags=["oauth"])

# Временное хранилище state (в production нужен Redis)
oauth_states = {}


@router.get("/google")
async def initiate_google_oauth(redirect_to: str = Query(default="/playground")):
    """
    GET /api/oauth/google

    Инициирует Google OAuth flow.
    Генерирует authorization URL и редиректит пользователя на Google.

    Query params:
        redirect_to: URL для редиректа после успешной аутентификации (default: /playground)

    Эквивалент: NextAuth signIn("google") в YouTubeAnalytics
    """
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "redirect_to": redirect_to,
        "created_at": datetime.now(),
    }

    auth_url = (
        f"{GOOGLE_OAUTH_AUTH_URL}?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_OAUTH_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={'+'.join(GOOGLE_OAUTH_SCOPES)}&"
        f"access_type=offline&"
        f"state={state}"
    )

    return RedirectResponse(url=auth_url)
