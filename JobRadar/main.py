import os
from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Получить абсолютный путь к папке со скриптом
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Подключить папку static с абсолютным путём
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.get("/")
async def index():
    return FileResponse("templates/index.html")

@app.post("/login")
async def login():
    return RedirectResponse(url="/dashboard", status_code=302)

@app.get("/dashboard")
async def dashboard():
    return FileResponse("templates/dashboard.html")


@app.get("/contact")
async def contact():
    return RedirectResponse(url="/dashboard", status_code=302)
