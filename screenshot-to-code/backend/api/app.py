"""FastAPI app with API routes."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import (
    health_router,
    formats_router,
    generate_router,
    generations_router,
    limits_router,
    stream_router,
    feedback_router,
    admin_messages_router,
    admin_users_router,
    admin_payments_router,
)

# Initialize database on import
from api.init_db import init_api_tables

init_api_tables()


def create_api_app() -> FastAPI:
    """Create FastAPI application with API routes."""

    app = FastAPI(
        title="Screenshot-to-Code API",
        description="Generate code from screenshots and URLs",
        version="1.0.0",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # TODO: restrict in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add routes
    app.include_router(health_router)
    app.include_router(formats_router)
    app.include_router(generate_router)
    app.include_router(generations_router)
    app.include_router(limits_router)
    app.include_router(stream_router)
    app.include_router(feedback_router)
    app.include_router(admin_messages_router)
    app.include_router(admin_users_router)
    app.include_router(admin_payments_router)

    return app


# For running with: uvicorn api.app:app
app = create_api_app()
