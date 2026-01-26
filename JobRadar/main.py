import os
from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from starlette.staticfiles import StaticFiles

app = FastAPI()

# Получить абсолютный путь к папке со скриптом
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Подключить папку static с абсолютным путём
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.get("/")
async def index():
    return FileResponse(os.path.join(BASE_DIR, "templates/index.html"))

@app.post("/login")
async def login():
    return RedirectResponse(url="/dashboard", status_code=302)

@app.get("/dashboard")
async def dashboard():
    return FileResponse(os.path.join(BASE_DIR, "templates/dashboard.html"))


@app.get("/contact")
async def contact():
    return RedirectResponse(url="/dashboard", status_code=302)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
