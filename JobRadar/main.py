import os
import json
import logging
from fastapi import FastAPI, HTTPException, Depends, Request, Cookie
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH

from database import SessionLocal, init_db
from models import Task, Lead, User, TelegramSession
from telegram_auth import save_session_to_db
from telegram_clients import disconnect_all_clients
import monitor

# ============== Отключить мусорные логи ==============
logging.getLogger("uvicorn.access").disabled = True
logging.getLogger("uvicorn").setLevel(logging.WARNING)

# ============== Логирование приложения ==============
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Консольный обработчик
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)

# Добавить обработчик если его еще нет
if not logger.handlers:
    logger.addHandler(console_handler)

app = FastAPI()

# ============== Глобальное хранилище pending клиентов ==============
# {phone: TelegramClient}
pending_auth_clients = {}

# ============== Флаг управления мониторингом ==============
monitoring_enabled = True

# Получить абсолютный путь к папке со скриптом
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Добавить CORS для работы fetch с API (с поддержкой cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
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
    logger.info("✅ БД инициализирована")

    # Запуск мониторинга задач (per-user Task-based leads)
    asyncio.create_task(monitor.monitoring_loop_tasks())
    logger.info("🚀 Запущен мониторинг задач")

# Shutdown event - disconnect all Telegram clients
@app.on_event("shutdown")
async def shutdown():
    await disconnect_all_clients()
    logger.info("✅ Все Telegram клиенты отключены")

# Dependency для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper для получения текущего пользователя из cookie
def get_current_user(
    user_phone: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db)
) -> User:
    """Получить текущего пользователя из cookie авторизации"""
    if not user_phone:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")

    user = db.query(User).filter(User.phone == user_phone).first()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден в БД")
    return user

# Pydantic модели для API
class TaskCreate(BaseModel):
    name: str
    status: str = "running"
    sources: str = ""
    include_keywords: str = ""
    exclude_keywords: Optional[str] = ""
    forward_channel: Optional[str] = ""
    alerts_personal: bool = True
    alerts_channel: bool = False

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    sources: Optional[str] = None
    include_keywords: Optional[str] = None
    exclude_keywords: Optional[str] = None
    forward_channel: Optional[str] = None
    alerts_personal: Optional[bool] = None
    alerts_channel: Optional[bool] = None

class TaskResponse(BaseModel):
    id: int
    user_id: int
    name: str
    status: str
    sources: str
    include_keywords: str
    exclude_keywords: Optional[str]
    forward_channel: Optional[str]
    alerts_personal: bool
    alerts_channel: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LeadResponse(BaseModel):
    id: int
    task_id: int
    text: str
    source_channel: str
    source_message_id: int
    source_url: Optional[str]
    matched_keyword: Optional[str]
    found_at: datetime
    status: str
    is_read: bool

    class Config:
        from_attributes = True

# ============== Pydantic модели для пользовательских настроек ==============

class UserSettingsRequest(BaseModel):
    alerts_personal: bool

class UserSettingsResponse(BaseModel):
    alerts_personal: bool

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
    return FileResponse(os.path.join(BASE_DIR, "templates/index.tailadmin.html"))

@app.get("/login")
async def login_page():
    return FileResponse(os.path.join(BASE_DIR, "templates/login.tailadmin.html"))

@app.post("/login")
async def login():
    return RedirectResponse(url="/dashboard", status_code=302)

@app.get("/dashboard")
async def dashboard():
    return FileResponse(os.path.join(BASE_DIR, "templates/dashboard.tailadmin.html"))

@app.get("/contact")
async def contact():
    return RedirectResponse(url="/dashboard", status_code=302)

# ============== API для Tasks ==============

@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить все задачи текущего пользователя"""
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    return tasks

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить одну задачу по ID"""
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return task

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Создать новую задачу"""
    # ВАЖНО: новые задачи ВСЕГДА создаются в статусе "paused", игнорируя input от клиента
    db_task = Task(
        user_id=current_user.id,
        name=task.name,
        status="paused",  # ВСЕГДА paused, никогда не running
        sources=task.sources,
        include_keywords=task.include_keywords,
        exclude_keywords=task.exclude_keywords,
        forward_channel=task.forward_channel,
        alerts_personal=task.alerts_personal,
        alerts_channel=task.alerts_channel,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, task: TaskUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Обновить задачу"""
    db_task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
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
    if task.forward_channel is not None:
        db_task.forward_channel = task.forward_channel
    if task.alerts_personal is not None:
        db_task.alerts_personal = task.alerts_personal
    if task.alerts_channel is not None:
        db_task.alerts_channel = task.alerts_channel

    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Удалить задачу"""
    db_task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    db.delete(db_task)
    db.commit()
    return {"message": "Задача удалена"}

# ============== API для Leads ==============

@app.get("/api/leads")
async def get_all_leads(
    page: int = 1,
    limit: int = 20,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить найденные лиды текущего пользователя с пагинацией и опциональной фильтрацией по статусу"""
    # Запросить limit + 1 для определения наличия ещё записей
    query = (
        db.query(Lead)
        .join(Task)
        .filter(Task.user_id == current_user.id)
    )

    # Если передан status - фильтруем по нему
    if status and status != "":
        query = query.filter(Lead.status == status)

    leads = (
        query
        .order_by(Lead.found_at.desc())
        .offset((page - 1) * limit)
        .limit(limit + 1)
        .all()
    )

    # Если получили больше чем limit - есть ещё записи
    has_more = len(leads) > limit

    # Вернуть только limit записей
    return {
        "leads": leads[:limit],
        "has_more": has_more
    }

@app.get("/api/leads/task/{task_id}", response_model=List[LeadResponse])
async def get_task_leads(task_id: int, status: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить лиды для конкретной задачи текущего пользователя с опциональной фильтрацией по статусу"""
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    query = db.query(Lead).filter(Lead.task_id == task_id)

    # Если передан status - фильтруем по нему
    if status and status != "":
        query = query.filter(Lead.status == status)

    leads = query.order_by(Lead.found_at.desc()).all()
    return leads

@app.get("/api/leads/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить количество новых лидов (status='new')"""
    unread = (
        db.query(Lead)
        .join(Task)
        .filter(Task.user_id == current_user.id)
        .filter(Lead.status == "new")
        .count()
    )
    return {"count": unread}

@app.get("/api/leads/new/count")
async def get_new_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить количество новых лидов (status='new')"""
    count = (
        db.query(Lead)
        .join(Task)
        .filter(Task.user_id == current_user.id)
        .filter(Lead.status == "new")
        .count()
    )
    return {"count": count}

@app.get("/api/leads/new", response_model=dict)
async def get_new_leads(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить последние 5 новых лидов (status='new')"""
    leads = (
        db.query(Lead)
        .join(Task)
        .filter(Task.user_id == current_user.id)
        .filter(Lead.status == "new")
        .order_by(Lead.found_at.desc())
        .limit(5)
        .all()
    )
    return {"leads": [LeadResponse.from_orm(l) for l in leads]}

@app.post("/api/leads/mark-read")
async def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Пометить все лиды текущего пользователя как просмотренные"""
    # Получить ID задач пользователя
    task_ids = db.query(Task.id).filter(Task.user_id == current_user.id).all()
    task_ids = [t[0] for t in task_ids]

    # Обновить лиды - использовать status="viewed" вместо is_read
    if task_ids:
        db.query(Lead).filter(
            Lead.task_id.in_(task_ids),
            Lead.status == "new"
        ).update({Lead.status: "viewed"})
        db.commit()

    return {"ok": True}

@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить информацию о конкретном лиде"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    # Проверить что лид принадлежит пользователю
    task = db.query(Task).filter(Task.id == lead.task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return lead

@app.put("/api/leads/{lead_id}/viewed")
async def mark_lead_viewed(lead_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Пометить лид как просмотренный"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    # Проверить что лид принадлежит пользователю
    task = db.query(Task).filter(Task.id == lead.task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    lead.status = "viewed"
    db.commit()
    db.refresh(lead)
    return lead

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Удалить лид"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    # Проверить что лид принадлежит пользователю
    task = db.query(Task).filter(Task.id == lead.task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Логируем удаление лида
    lead_preview = (lead.text or "")[:80].replace("\n", " ")
    logger.info(f"🗑 ЛИД УДАЛЕН | lead_id={lead_id} | task={task.name} | {lead_preview}...")

    db.delete(lead)
    db.commit()
    return {"ok": True}

# ============== API для пользовательских настроек ==============

@app.get("/api/user/settings", response_model=UserSettingsResponse)
async def get_user_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить пользовательские настройки"""
    print("USER_SETTINGS_GET_CALLED")

    # Найти сессию пользователя
    telegram_session = db.query(TelegramSession).filter(TelegramSession.user_id == current_user.id).first()
    print("SESSION_FOUND", bool(telegram_session))

    # Если сессии нет, возвращаем дефолт
    if not telegram_session:
        print("RETURNING_DEFAULT alerts_personal=True")
        return UserSettingsResponse(alerts_personal=True)

    # Возвращаем сохраненное значение
    print(f"RETURNING alerts_personal={telegram_session.alerts_personal}")
    return UserSettingsResponse(alerts_personal=telegram_session.alerts_personal)

@app.put("/api/user/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    request: UserSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить пользовательские настройки"""
    print("USER_SETTINGS_PUT_CALLED")
    print(f"REQUEST_BODY: alerts_personal={request.alerts_personal}")

    # Найти сессию пользователя
    telegram_session = db.query(TelegramSession).filter(TelegramSession.user_id == current_user.id).first()
    print("SESSION_FOUND", bool(telegram_session))

    # Если сессии нет, ошибка
    if not telegram_session:
        raise HTTPException(status_code=400, detail="Telegram сессия не найдена. Сначала авторизуйтесь.")

    # Обновить настройку
    print("BEFORE alerts_personal =", telegram_session.alerts_personal)
    telegram_session.alerts_personal = request.alerts_personal
    print("AFTER alerts_personal =", telegram_session.alerts_personal)

    db.commit()
    print("COMMIT_DONE")

    # Обновить объект из БД для полной уверенности
    db.refresh(telegram_session)
    print("DB_VALUE alerts_personal =", telegram_session.alerts_personal)

    # Вернуть обновленное значение
    return UserSettingsResponse(alerts_personal=telegram_session.alerts_personal)

# ============== API для статистики ==============

@app.get("/api/stats")
async def get_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить статистику для дашборда"""
    tasks_count = db.query(Task).filter(Task.user_id == current_user.id).count()
    active_tasks = db.query(Task).filter(Task.user_id == current_user.id, Task.status == "running").count()

    # Подсчитать источники и ключевые слова
    total_sources = 0
    total_keywords = 0

    for task in db.query(Task).filter(Task.user_id == current_user.id).all():
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

def normalize_phone(phone: str) -> str:
    """Нормализовать номер телефона"""
    return phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")


@app.post("/api/auth/start")
async def auth_start(request: AuthStartRequest):
    """
    ШАГ 1: Начать процесс авторизации в Telegram.
    Создать клиента и отправить код.
    """
    try:
        phone = normalize_phone(request.phone)

        # Создать клиента с пустой StringSession
        client = TelegramClient(StringSession(), TELEGRAM_API_ID, TELEGRAM_API_HASH)
        await client.connect()
        await client.send_code_request(phone)

        # Сохранить клиента в памяти
        pending_auth_clients[phone] = client

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/submit-code")
async def auth_submit_code(request: AuthCodeRequest):
    """
    ШАГ 2: Отправить код верификации.
    Вернуть информацию требуется ли пароль 2FA.
    """
    try:
        phone = normalize_phone(request.phone)

        client = pending_auth_clients.get(phone)
        if not client:
            raise Exception("Сессия авторизации истекла. Начните заново.")

        try:
            await client.sign_in(phone=phone, code=request.code)
            pending_auth_clients[phone] = client
            return {"requires_password": False}

        except SessionPasswordNeededError:
            pending_auth_clients[phone] = client
            return {"requires_password": True}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/submit-password")
async def auth_submit_password(request: AuthPasswordRequest):
    """
    ШАГ 3: Отправить пароль 2FA (если требуется).
    """
    try:
        phone = normalize_phone(request.phone)

        client = pending_auth_clients.get(phone)
        if not client:
            raise Exception("Сессия авторизации истекла.")

        try:
            await client.sign_in(password=request.password)
        except Exception as e:
            raise

        pending_auth_clients[phone] = client

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/save")
async def auth_save(request: AuthStartRequest):
    """
    ШАГ 4: Сохранить сессию в SQLite БД.
    Получить StringSession и сохранить в таблице telegram_sessions.
    """
    try:
        phone = normalize_phone(request.phone)

        client = pending_auth_clients.get(phone)
        if not client:
            raise Exception(f"Клиент авторизации не найден.")

        try:
            # Получить информацию о пользователе
            me = await client.get_me()
            user_info = {
                "phone": phone,
                "first_name": me.first_name or "",
                "last_name": me.last_name or "",
                "username": me.username or "",
                "id": me.id
            }
        except Exception as e:
            raise

        try:
            # Получить строку сессии
            session_string = client.session.save()
        except Exception as e:
            raise

        try:
            # Сохранить в БД с telegram_user_id
            success = await save_session_to_db(phone, session_string, me.id)
            if not success:
                raise Exception("Ошибка при сохранении в БД")
        except Exception as e:
            raise

        try:
            # Удалить из памяти и отключить
            del pending_auth_clients[phone]
            await client.disconnect()
        except Exception as e:
            pass

        # Создаём ответ с установкой cookie авторизации
        response = JSONResponse({"ok": True, "user": user_info})
        response.set_cookie(
            key="user_phone",
            value=phone,
            max_age=10*365*24*60*60,  # 10 лет (практически бессрочно, удаление только при logout)
            path="/",  # КРИТИЧНО: доступна для всех путей
            httponly=True,
            samesite="lax",
            secure=False  # Локальная разработка (http, не https)
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/logout")
async def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Выйти из аккаунта.

    Логика:
    1. Получить current_user (через cookie)
    2. Отключить активный TelegramClient (если есть)
    3. Удалить TelegramSession из БД
    4. Очистить cookie авторизации
    """
    try:
        # 1. Отключить TelegramClient пользователя
        from telegram_clients import disconnect_user_client
        await disconnect_user_client(current_user.id)
        logger.info(f"[LOGOUT] user_id={current_user.id} - TelegramClient отключен")

        # 2. Удалить TelegramSession из БД
        deleted_count = db.query(TelegramSession).filter(
            TelegramSession.user_id == current_user.id
        ).delete(synchronize_session=False)
        db.commit()

        logger.info(f"[LOGOUT] user_id={current_user.id} - удалено TelegramSession записей: {deleted_count}")
        print(f"LOGOUT user_id={current_user.id}")
        print(f"TelegramSession deleted (count={deleted_count})")

        # 3. Создать ответ и очистить cookie
        response = JSONResponse({"ok": True, "message": "Выход выполнен"})
        response.delete_cookie(key="user_phone", path="/")
        return response

    except Exception as e:
        logger.error(f"Ошибка при logout user_id={current_user.id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
