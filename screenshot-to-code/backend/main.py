# Load environment variables first
from dotenv import load_dotenv

load_dotenv()


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routes import screenshot, generate_code, home, evals, history
from db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context for app startup and shutdown."""
    # Startup
    init_db()
    print("[APP] startup complete")
    yield
    # Shutdown
    print("[APP] shutdown")


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
