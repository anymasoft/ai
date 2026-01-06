# Load environment variables first
from dotenv import load_dotenv

load_dotenv()


import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routes import screenshot, generate_code, home, evals, history
from db import init_db
from gen_queue.generation_queue import init_queue
from gen_queue.worker import start_worker
import time

# Import API routes
from api.routes import (
    health_router,
    formats_router,
    generate_router,
    generations_router,
    limits_router,
    stream_router,
    feedback_router,
    billing_router,
    user_router,
    admin_messages_router,
    admin_users_router,
    admin_payments_router,
)
from api.routes.oauth import router as oauth_router
from api.routes.auth import router as auth_router
from config import ALLOWED_ORIGINS

# Initialize database - SINGLE DATABASE for UI + API + ADMIN
init_db()

# Initialize queue
init_queue()

# Global worker task
worker_task: asyncio.Task = None

# Global shutdown flag - KILL SWITCH для Ctrl+C
app_shutting_down = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    global worker_task, app_shutting_down

    # Startup
    print("[APP] Starting application...")
    print("[APP] Starting generation worker...")
    worker_task = asyncio.create_task(start_worker())

    yield

    # Shutdown - SET KILL SWITCH FIRST
    app_shutting_down = True
    print("[APP] Shutting down application...")
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            # Expected - task was cancelled
            pass
        except Exception as e:
            # Worker exited with error - log but don't crash shutdown
            print(f"[APP] Worker error during shutdown: {e}")
    print("[APP] Generation worker stopped")


app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None, lifespan=lifespan)

# Configure CORS settings from db_config
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests with timing."""
    start_time = time.time()

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Log
    print(f"[HTTP] {request.method} {request.url.path} -> {response.status_code} ({duration:.3f}s)")

    return response

# Add UI routes
app.include_router(generate_code.router)
app.include_router(screenshot.router)
app.include_router(home.router)
app.include_router(evals.router)
app.include_router(history.router)

# Add API routes
app.include_router(health_router)
app.include_router(formats_router)
app.include_router(generate_router)
app.include_router(generations_router)
app.include_router(limits_router)
app.include_router(stream_router)
app.include_router(feedback_router)
app.include_router(billing_router)
app.include_router(user_router)
app.include_router(admin_messages_router)
app.include_router(admin_users_router)
app.include_router(admin_payments_router)

# Add OAuth routes
app.include_router(oauth_router)
app.include_router(auth_router)
