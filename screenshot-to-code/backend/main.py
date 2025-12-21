# Load environment variables first
from dotenv import load_dotenv

load_dotenv()


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from routes import screenshot, generate_code, home, evals

app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)

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

# Mount static files for generated assets (images extracted from screenshots)
public_dir = Path(__file__).parent.parent / "public"
public_dir.mkdir(exist_ok=True)
try:
    app.mount("/", StaticFiles(directory=str(public_dir), html=False), name="static")
except Exception as e:
    print(f"⚠️ Warning: Could not mount public directory: {e}")
