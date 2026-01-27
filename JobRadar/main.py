import os
import json
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncio

from database import SessionLocal, init_db
from models import Task
from telegram_auth import start_auth_flow, submit_code, submit_password, save_session, cancel_auth

app = FastAPI()

# Получить абсолютный путь к папке со скриптом
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Добавить CORS для работы fetch с API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключить папку static с абсолютным путём
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Инициализация БД при запуске
@app.on_event("startup")
async def startup():
    init_db()

# Dependency для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic модели для API
class TaskCreate(BaseModel):
    name: str
    status: str = "running"
    sources: str = ""
    include_keywords: str = ""
    exclude_keywords: Optional[str] = ""
    alerts_telegram: bool = True
    alerts_email: bool = False
    alerts_webhook: bool = False

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    sources: Optional[str] = None
    include_keywords: Optional[str] = None
    exclude_keywords: Optional[str] = None
    alerts_telegram: Optional[bool] = None
    alerts_email: Optional[bool] = None
    alerts_webhook: Optional[bool] = None

class TaskResponse(BaseModel):
    id: int
    name: str
    status: str
    sources: str
    include_keywords: str
    exclude_keywords: Optional[str]
    alerts_telegram: bool
    alerts_email: bool
    alerts_webhook: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============== Pydantic модели для Telegram авторизации ==============

class AuthStartRequest(BaseModel):
    phone: str

class AuthCodeRequest(BaseModel):
    phone: str
    code: str

class AuthPasswordRequest(BaseModel):
    phone: str
    password: str

# ============== API Endpoints ==============

@app.get("/")
async def index():
    return FileResponse(os.path.join(BASE_DIR, "templates/index.html"))

@app.get("/login")
async def login_page():
    return FileResponse(os.path.join(BASE_DIR, "templates/login.html"))

@app.post("/login")
async def login():
    return RedirectResponse(url="/dashboard", status_code=302)

@app.get("/dashboard")
async def dashboard():
    return FileResponse(os.path.join(BASE_DIR, "templates/dashboard.html"))

@app.get("/contact")
async def contact():
    return RedirectResponse(url="/dashboard", status_code=302)

# ============== API для Tasks ==============

@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(db: Session = Depends(get_db)):
    """Получить все задачи"""
    tasks = db.query(Task).all()
    return tasks

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: Session = Depends(get_db)):
    """Получить одну задачу по ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return task

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Создать новую задачу"""
    db_task = Task(
        name=task.name,
        status=task.status,
        sources=task.sources,
        include_keywords=task.include_keywords,
        exclude_keywords=task.exclude_keywords,
        alerts_telegram=task.alerts_telegram,
        alerts_email=task.alerts_email,
        alerts_webhook=task.alerts_webhook,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    """Обновить задачу"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    if task.name is not None:
        db_task.name = task.name
    if task.status is not None:
        db_task.status = task.status
    if task.sources is not None:
        db_task.sources = task.sources
    if task.include_keywords is not None:
        db_task.include_keywords = task.include_keywords
    if task.exclude_keywords is not None:
        db_task.exclude_keywords = task.exclude_keywords
    if task.alerts_telegram is not None:
        db_task.alerts_telegram = task.alerts_telegram
    if task.alerts_email is not None:
        db_task.alerts_email = task.alerts_email
    if task.alerts_webhook is not None:
        db_task.alerts_webhook = task.alerts_webhook

    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Удалить задачу"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    db.delete(db_task)
    db.commit()
    return {"message": "Задача удалена"}

# ============== API для статистики ==============

@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Получить статистику для дашборда"""
    tasks_count = db.query(Task).count()
    active_tasks = db.query(Task).filter(Task.status == "running").count()

    # Подсчитать источники и ключевые слова
    total_sources = 0
    total_keywords = 0

    for task in db.query(Task).all():
        if task.sources:
            sources_list = [s.strip() for s in task.sources.split(',') if s.strip()]
            total_sources += len(sources_list)
        if task.include_keywords:
            keywords_list = [k.strip() for k in task.include_keywords.split(',') if k.strip()]
            total_keywords += len(keywords_list)

    return {
        "active_tasks": active_tasks,
        "total_tasks": tasks_count,
        "total_sources": total_sources,
        "total_keywords": total_keywords,
        "total_matches": 0,  # Заполнится позже из SourceMessage
    }

# ============== API для Telegram авторизации ==============

@app.post("/api/auth/start")
async def auth_start(request: AuthStartRequest):
    """Начать процесс авторизации в Telegram"""
    try:
        result = await start_auth_flow(request.phone)
        return {"success": result, "message": "Код отправлен на номер"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/submit-code")
async def auth_submit_code(request: AuthCodeRequest):
    """Отправить код верификации"""
    try:
        result = await submit_code(request.phone, request.code)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/submit-password")
async def auth_submit_password(request: AuthPasswordRequest):
    """Отправить пароль 2FA"""
    try:
        result = await submit_password(request.phone, request.password)
        return {"success": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/save")
async def auth_save(request: AuthStartRequest):
    """Сохранить сессию в БД"""
    try:
        result = await save_session(request.phone)
        return {"success": result, "message": "Сессия успешно сохранена"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/cancel")
async def auth_cancel():
    """Отменить текущий процесс авторизации"""
    try:
        await cancel_auth()
        return {"success": True, "message": "Авторизация отменена"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
