from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
import os

# Инициализация FastAPI приложения
app = FastAPI(title="JobRadar")

# Путь к папке с шаблонами
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Подключение папки static (для будущего использования)
if os.path.exists(os.path.join(BASE_DIR, "static")):
    app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


# Маршруты

@app.get("/")
async def index(request: Request):
    """Лендинг с кнопкой авторизации"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/login")
async def login():
    """Фейковая авторизация - редирект на дашборд"""
    return RedirectResponse(url="/dashboard", status_code=303)


@app.get("/dashboard")
async def dashboard(request: Request):
    """Дашборд"""
    return templates.TemplateResponse("dashboard.html", {"request": request})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
