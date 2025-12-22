# Load environment variables first
from dotenv import load_dotenv

load_dotenv()


import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import screenshot, generate_code, home, evals, history
from db import init_db
from gen_queue.generation_queue import init_queue
from gen_queue.worker import start_worker

# Initialize database
init_db()

# Initialize queue
init_queue()

# Global worker task
worker_task: asyncio.Task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    global worker_task

    # Startup
    print("[APP] Starting application...")
    print("[APP] Starting generation worker...")
    worker_task = asyncio.create_task(start_worker())

    yield

    # Shutdown
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

# Configure CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add routes
app.include_router(generate_code.router)
app.include_router(screenshot.router)
app.include_router(home.router)
app.include_router(evals.router)
app.include_router(history.router)
