from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def index():
    return FileResponse("templates/index.html")

@app.post("/login")
async def login():
    return RedirectResponse(url="/dashboard", status_code=302)

@app.get("/dashboard")
async def dashboard():
    return FileResponse("templates/dashboard.html")
