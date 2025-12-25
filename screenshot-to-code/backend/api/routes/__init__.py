"""API routes."""

from .health import router as health_router
from .formats import router as formats_router
from .generate import router as generate_router
from .generations import router as generations_router
from .limits import router as limits_router
from .stream import router as stream_router
from .feedback import router as feedback_router
from .billing import router as billing_router
from .user import router as user_router
from .admin.messages import router as admin_messages_router
from .admin.users import router as admin_users_router
from .admin.payments import router as admin_payments_router

__all__ = [
    "health_router",
    "formats_router",
    "generate_router",
    "generations_router",
    "limits_router",
    "stream_router",
    "feedback_router",
    "billing_router",
    "user_router",
    "admin_messages_router",
    "admin_users_router",
    "admin_payments_router",
]
