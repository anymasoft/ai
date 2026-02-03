import os
import json
import logging
import uuid
import secrets
import random
from fastapi import FastAPI, HTTPException, Depends, Request, Cookie
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio
from dateutil import parser as dateutil_parser
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_ADMIN_ID, PAYMENT_RETURN_URL, CORS_ORIGINS

# YooKassa
try:
    from yookassa import Configuration, Payment as YooKassaPayment
    YOOKASSA_AVAILABLE = True
except ImportError:
    YOOKASSA_AVAILABLE = False
    logger_startup = logging.getLogger(__name__)
    logger_startup.warning("⚠️ YooKassa SDK не установлена. Установите: pip install yookassa")

from database import SessionLocal, init_db
from models import Task, Lead, User, TelegramSession, Payment
from telegram_auth import save_session_to_db
from telegram_clients import disconnect_all_clients, disconnect_user_client
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

# ============== Конфигурация YooKassa ==============
if YOOKASSA_AVAILABLE:
    YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID")
    YOOKASSA_API_KEY = os.getenv("YOOKASSA_API_KEY")

    if YOOKASSA_SHOP_ID and YOOKASSA_API_KEY:
        Configuration.account_id = YOOKASSA_SHOP_ID
        Configuration.secret_key = YOOKASSA_API_KEY
        logger = logging.getLogger(__name__)
        logger.info("✅ YooKassa конфигурирована")
    else:
        logger = logging.getLogger(__name__)
        logger.warning("⚠️ YOOKASSA_SHOP_ID или YOOKASSA_API_KEY не установлены")

# ============== Лимиты тарифных планов ==============
MAX_CHANNELS_PER_TASK = 10

TASK_LIMITS_BY_PLAN = {
    "trial": 1,
    "start": 1,
    "pro": 3,
    "business": 6
}

def count_channels_in_task(sources: Optional[str]) -> int:
    """Посчитать количество каналов в sources (разделены , или \\n)"""
    if not sources or not sources.strip():
        return 0

    # Пробуем оба формата разделения
    if "," in sources:
        channels = [s.strip() for s in sources.split(",") if s.strip()]
    else:
        channels = [s.strip() for s in sources.split("\n") if s.strip()]

    return len(channels)

def get_task_limit_for_plan(plan: str) -> int:
    """Получить лимит задач для тарифного плана"""
    return TASK_LIMITS_BY_PLAN.get(plan, TASK_LIMITS_BY_PLAN["trial"])

def count_user_tasks(user_id: int, db: Session) -> int:
    """Посчитать количество активных задач пользователя"""
    return db.query(Task).filter(Task.user_id == user_id).count()

def check_and_apply_expiration(user: User, db: Session) -> bool:
    """
    Проверить истечение тарифа пользователя и применить downgrade если нужно.

    Возвращает True если план был изменён, False если всё в порядке.
    """
    now = datetime.utcnow()
    was_changed = False

    # Проверка 1: Trial истёк?
    if user.plan == "trial":
        if user.trial_expires_at:
            # Если это строка, парсим вручную
            if isinstance(user.trial_expires_at, str):
                try:
                    expires_dt = dateutil_parser.parse(user.trial_expires_at)
                except:
                    expires_dt = datetime.fromisoformat(user.trial_expires_at.replace('Z', '+00:00'))
            else:
                expires_dt = user.trial_expires_at

            if expires_dt < now:
                user.plan = "expired"
                logger.info(f"[TRIAL_EXPIRED] user_id={user.id} trial_expires_at={user.trial_expires_at}")
                was_changed = True

    # Проверка 2: Платный тариф истёк?
    elif user.plan in ("start", "pro", "business"):
        if user.paid_until:
            # Если это строка, парсим вручную
            if isinstance(user.paid_until, str):
                try:
                    paid_dt = dateutil_parser.parse(user.paid_until)
                except:
                    paid_dt = datetime.fromisoformat(user.paid_until.replace('Z', '+00:00'))
            else:
                paid_dt = user.paid_until

            if paid_dt < now:
                user.plan = "expired"
                logger.info(f"[PAID_EXPIRED] user_id={user.id} paid_plan={user.plan} paid_until={user.paid_until}")
                was_changed = True

    if was_changed:
        db.commit()

    return was_changed

def ensure_active_subscription(user: User, db: Session):
    """
    Проверить и применить expiration, затем убедиться что подписка активна.

    Если подписка истекла → HTTP 403 с понятным сообщением.
    """
    check_and_apply_expiration(user, db)

    if user.plan == "expired":
        raise HTTPException(
            status_code=403,
            detail="Подписка истекла. Пожалуйста, выберите тариф."
        )

# ============== Глобальное хранилище pending клиентов ==============
# {auth_id: {"phone": phone, "client": client, "created_at": timestamp}}
pending_auth_clients = {}

# ============== Глобальное хранилище кодов входа (повторная авторизация) ==============
# {phone: {"code": "12345", "expires_at": timestamp}}
pending_login_codes = {}

# ============== Флаг управления мониторингом ==============
monitoring_enabled = True

# Получить абсолютный путь к папке со скриптом
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Добавить CORS для работы fetch с API (с поддержкой cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
    auth_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db)
) -> User:
    """Получить текущего пользователя из cookie авторизации (auth_token)"""
    if not auth_token:
        raise HTTPException(status_code=401, detail="Пользователь не авторизован")

    user = db.query(User).filter(User.auth_token == auth_token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден или сессия истекла")
    return user

# Helper для проверки что пользователь - админ
def require_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """Проверить что текущий пользователь - админ"""
    # Найти TelegramSession пользователя
    session = db.query(TelegramSession).filter(TelegramSession.user_id == current_user.id).first()

    # Если нет сессии или нет telegram_user_id -> не админ
    if not session or not session.telegram_user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Проверить что telegram_user_id == TELEGRAM_ADMIN_ID
    if session.telegram_user_id != TELEGRAM_ADMIN_ID:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return current_user

# Pydantic модели для API
class TaskCreate(BaseModel):
    name: str
    status: str = "running"
    sources: str = ""
    include_keywords: Optional[str] = ""
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
    auth_id: str
    code: str

class AuthPasswordRequest(BaseModel):
    auth_id: str
    password: str

class AuthSaveRequest(BaseModel):
    auth_id: str

class AuthLoginTelegramRequest(BaseModel):
    phone: str
    code: str

class PaymentCreateRequest(BaseModel):
    plan: str  # "start" | "pro" | "business"

class PaymentStatusResponse(BaseModel):
    status: str  # "pending" | "succeeded" | "canceled"
    yookassa_payment_id: str

# ============== Тарифы и платежи ==============

PLAN_PRICES = {
    "start": "990.00",
    "pro": "1990.00",
    "business": "4990.00"
}

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

    # Проверка: максимум 10 каналов в одной задаче
    channels_count = count_channels_in_task(task.sources)
    if channels_count > MAX_CHANNELS_PER_TASK:
        raise HTTPException(
            status_code=400,
            detail="В одной задаче можно указать не более 10 каналов"
        )

    # Проверка: лимит задач по тарифу
    current_task_count = count_user_tasks(current_user.id, db)
    task_limit = get_task_limit_for_plan(current_user.plan)

    if current_task_count >= task_limit:
        raise HTTPException(
            status_code=403,
            detail="Лимит задач для вашего тарифа исчерпан"
        )

    # Новые задачи создаются со статусом "running" для немедленного запуска мониторинга
    db_task = Task(
        user_id=current_user.id,
        name=task.name,
        status="running",  # Статус "running" для немедленного начала мониторинга
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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

    db_task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    # Проверка: если обновляются sources, проверить лимит каналов
    if task.sources is not None:
        channels_count = count_channels_in_task(task.sources)
        if channels_count > MAX_CHANNELS_PER_TASK:
            raise HTTPException(
                status_code=400,
                detail="В одной задаче можно указать не более 10 каналов"
            )

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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
    # Проверка: подписка активна?
    ensure_active_subscription(current_user, db)

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

@app.get("/api/user/me")
async def get_user_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить информацию о текущем пользователе, включая is_admin"""
    # Проверка: обновить статус если истекло (но не бросать ошибку)
    check_and_apply_expiration(current_user, db)

    # Найти TelegramSession пользователя
    session = db.query(TelegramSession).filter(TelegramSession.user_id == current_user.id).first()

    # Определить is_admin
    is_admin = False
    if session and session.telegram_user_id and session.telegram_user_id == TELEGRAM_ADMIN_ID:
        is_admin = True

    return {
        "id": current_user.id,
        "phone": current_user.phone,
        "is_admin": is_admin,
        "has_session": session is not None,
        "disabled": current_user.disabled,
        "plan": current_user.plan,
        "trial_expires_at": current_user.trial_expires_at.isoformat() if current_user.trial_expires_at else None,
        "paid_until": current_user.paid_until.isoformat() if current_user.paid_until else None
    }

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

    Логика:
    - Если TelegramSession существует → отправить код в Telegram ЛС
    - Иначе → создать клиента и отправить Telegram SMS (старый флоу)
    """
    try:
        phone = normalize_phone(request.phone)
        db = SessionLocal()

        try:
            # 1. Проверить существует ли TelegramSession для этого phone
            telegram_session = (
                db.query(TelegramSession)
                .filter(TelegramSession.phone == phone)
                .order_by(TelegramSession.id.desc())
                .first()
            )

            # ВАРИАНТ А: TelegramSession найден → режим LOGIN_BY_TELEGRAM_MESSAGE
            if telegram_session:
                logger.info(f"[AUTH_START] phone={phone} - найдена TelegramSession, используем режим Telegram ЛС")

                try:
                    # Получить User (уже должен быть, так как TelegramSession связана с user_id)
                    user = db.query(User).filter(User.id == telegram_session.user_id).first()
                    if not user:
                        raise Exception("User не найден для TelegramSession")

                    # Получить Telegram client пользователя
                    from telegram_clients import get_user_client
                    client = await get_user_client(user.id, db)
                    if not client:
                        logger.warning(f"[AUTH_START] phone={phone} - не удалось получить TelegramClient, возвращаемся к SMS")
                        # Если клиент не получился - возвращаемся к старому флоу
                        raise Exception("TelegramClient not available, fallback to SMS")

                    # Генерировать 5-значный код
                    login_code = str(random.randint(10000, 99999))

                    # Сохранить код в памяти с TTL 300 сек и привязкой к user_id
                    pending_login_codes[phone] = {
                        "code": login_code,
                        "user_id": telegram_session.user_id,
                        "expires_at": datetime.utcnow() + timedelta(seconds=300)
                    }

                    # Отправить код в личку пользователю
                    try:
                        await client.send_message("me", f"Ваш код входа в JobRadar: {login_code}\n\nКод действителен 5 минут.")
                        logger.info(f"[AUTH_START] phone={phone} - код отправлен в Telegram ЛС")
                    except Exception as e:
                        logger.error(f"[AUTH_START] phone={phone} - ошибка отправки в Telegram: {e}")
                        del pending_login_codes[phone]
                        raise Exception("Не удалось отправить код в Telegram")

                    return {
                        "ok": True,
                        "login_via": "telegram_message"
                    }

                except Exception as e:
                    # Если что-то пошло не так - возвращаемся к старому флоу
                    logger.warning(f"[AUTH_START] phone={phone} - ошибка режима Telegram ЛС, fallback на SMS: {e}")
                    pass  # Продолжим к варианту Б

            # ВАРИАНТ Б: TelegramSession не найден или ошибка → режим Telegram SMS (старый флоу)
            logger.info(f"[AUTH_START] phone={phone} - TelegramSession не найдена, используем режим SMS")

            # Создать клиента с пустой StringSession
            client = TelegramClient(StringSession(), TELEGRAM_API_ID, TELEGRAM_API_HASH)
            await client.connect()
            await client.send_code_request(phone)

            # Генерировать уникальный auth_id
            auth_id = str(uuid.uuid4())

            # Сохранить клиента в памяти с таймстэмпом
            pending_auth_clients[auth_id] = {
                "phone": phone,
                "client": client,
                "created_at": datetime.utcnow()
            }

            return {
                "ok": True,
                "auth_id": auth_id,
                "login_via": "telegram_sms"
            }

        finally:
            db.close()

    except Exception as e:
        logger.error(f"[AUTH_START] Ошибка: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/submit-code")
async def auth_submit_code(request: AuthCodeRequest):
    """
    ШАГ 2: Отправить код верификации.
    Вернуть информацию требуется ли пароль 2FA.
    """
    try:
        auth_id = request.auth_id

        # Получить pending клиент и проверить TTL (300 сек = 5 минут)
        auth_data = pending_auth_clients.get(auth_id)
        if not auth_data:
            raise Exception("Сессия авторизации истекла. Начните заново.")

        # Проверить TTL
        if datetime.utcnow() - auth_data["created_at"] > timedelta(seconds=300):
            del pending_auth_clients[auth_id]
            raise Exception("Сессия авторизации истекла. Начните заново.")

        phone = auth_data["phone"]
        client = auth_data["client"]

        try:
            await client.sign_in(phone=phone, code=request.code)
            pending_auth_clients[auth_id]["client"] = client

            # Получить Telegram user_id для привязки к auth_id
            try:
                me = await client.get_me()
                pending_auth_clients[auth_id]["telegram_user_id"] = me.id
            except:
                pass

            return {"requires_password": False}

        except SessionPasswordNeededError:
            pending_auth_clients[auth_id]["client"] = client

            # Получить Telegram user_id для привязки к auth_id
            try:
                me = await client.get_me()
                pending_auth_clients[auth_id]["telegram_user_id"] = me.id
            except:
                pass

            return {"requires_password": True}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/submit-password")
async def auth_submit_password(request: AuthPasswordRequest):
    """
    ШАГ 3: Отправить пароль 2FA (если требуется).
    """
    try:
        auth_id = request.auth_id

        # Получить pending клиент и проверить TTL
        auth_data = pending_auth_clients.get(auth_id)
        if not auth_data:
            raise Exception("Сессия авторизации истекла.")

        # Проверить TTL
        if datetime.utcnow() - auth_data["created_at"] > timedelta(seconds=300):
            del pending_auth_clients[auth_id]
            raise Exception("Сессия авторизации истекла.")

        client = auth_data["client"]

        # Проверить что telegram_user_id совпадает (если был сохранен после кода)
        if auth_data.get("telegram_user_id"):
            try:
                me = await client.get_me()
                if me.id != auth_data.get("telegram_user_id"):
                    raise Exception("Telegram аккаунт не совпадает с авторизацией через код")
            except Exception as e:
                raise

        try:
            await client.sign_in(password=request.password)
        except Exception as e:
            raise

        pending_auth_clients[auth_id]["client"] = client

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/save")
async def auth_save(request: AuthSaveRequest):
    """
    ШАГ 4: Сохранить сессию в SQLite БД.
    Получить StringSession и сохранить в таблице telegram_sessions.
    """
    try:
        auth_id = request.auth_id

        # Получить pending клиент и проверить TTL
        auth_data = pending_auth_clients.get(auth_id)
        if not auth_data:
            raise Exception(f"Клиент авторизации не найден.")

        # Проверить TTL
        if datetime.utcnow() - auth_data["created_at"] > timedelta(seconds=300):
            del pending_auth_clients[auth_id]
            raise Exception("Сессия авторизации истекла.")

        phone = auth_data["phone"]
        client = auth_data["client"]

        try:
            # Получить информацию о пользователе
            me = await client.get_me()

            # Проверить что telegram_user_id совпадает (если был сохранен)
            if auth_data.get("telegram_user_id"):
                if me.id != auth_data.get("telegram_user_id"):
                    raise Exception("Telegram аккаунт не совпадает с авторизацией")

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
            # Сохранить в БД с telegram_user_id и telegram_username
            # Возвращает user_id при успехе или None при ошибке
            user_id = await save_session_to_db(phone, session_string, me.id, me.username)
            if user_id is None:
                raise Exception("Ошибка при сохранении в БД")
        except Exception as e:
            raise

        try:
            # Получить пользователя из БД и генерировать auth_token
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise Exception("Пользователь не найден в БД после сохранения")

                # Генерировать криптографически стойкий auth_token
                auth_token = secrets.token_urlsafe(32)
                user.auth_token = auth_token
                db.commit()

                logger.info(f"✅ auth_token сгенерирован для пользователя {phone} (user_id={user_id})")
            except Exception as e:
                db.rollback()
                raise
            finally:
                db.close()
        except Exception as e:
            raise

        try:
            # Удалить из памяти и отключить
            del pending_auth_clients[auth_id]
            await client.disconnect()
        except Exception as e:
            pass

        # Создаём ответ с установкой cookie авторизации (auth_token вместо user_phone)
        response = JSONResponse({"ok": True, "user": user_info})
        response.set_cookie(
            key="auth_token",
            value=auth_token,
            max_age=10*365*24*60*60,  # 10 лет (практически бессрочно, удаление только при logout)
            path="/",  # КРИТИЧНО: доступна для всех путей
            httponly=True,
            samesite="lax",
            secure=False  # Локальная разработка (http, не https)
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/login-by-telegram")
async def login_by_telegram(request: AuthLoginTelegramRequest):
    """
    НОВЫЙ ФЛОУ: Вход пользователя через код отправленный в Telegram ЛС.

    Используется если TelegramSession уже существует.

    Args:
        phone: Номер телефона (нормализованный)
        code: 5-значный код из Telegram ЛС

    Returns:
        JSON с auth_token для установки cookie
    """
    try:
        phone = normalize_phone(request.phone)
        code = request.code.strip()

        # 1. Проверить что код существует в памяти
        login_data = pending_login_codes.get(phone)
        if not login_data:
            logger.warning(f"[LOGIN_TELEGRAM] phone={phone} - код не найден в памяти")
            raise HTTPException(status_code=400, detail="Код не найден. Запросите новый код.")

        # 2. Проверить TTL
        if datetime.utcnow() > login_data["expires_at"]:
            del pending_login_codes[phone]
            logger.warning(f"[LOGIN_TELEGRAM] phone={phone} - код истек")
            raise HTTPException(status_code=400, detail="Код истек. Запросите новый код.")

        # 3. Сравнить код
        if code != login_data["code"]:
            logger.warning(f"[LOGIN_TELEGRAM] phone={phone} - неверный код")
            raise HTTPException(status_code=400, detail="Неверный код.")

        # 4. Найти User по phone
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.phone == phone).first()
            if not user:
                logger.error(f"[LOGIN_TELEGRAM] phone={phone} - User не найден")
                raise HTTPException(status_code=400, detail="Пользователь не найден.")

            # Проверить что user_id совпадает (защита от подмены)
            if login_data.get("user_id") != user.id:
                logger.error(f"[LOGIN_TELEGRAM] phone={phone} - user_id mismatch: expected {login_data.get('user_id')}, got {user.id}")
                raise HTTPException(status_code=403, detail="User mismatch for login code")

            # Проверить активная ли подписка
            ensure_active_subscription(user, db)

            # 5. Генерировать auth_token
            auth_token = secrets.token_urlsafe(32)
            user.auth_token = auth_token
            db.commit()

            logger.info(f"✅ [LOGIN_TELEGRAM] phone={phone} (user_id={user.id}) - вход через Telegram ЛС, auth_token сгенерирован")

            # 6. Удалить код из памяти (one-time use)
            del pending_login_codes[phone]

            # 7. Вернуть auth_token
            response = JSONResponse({"ok": True})
            response.set_cookie(
                key="auth_token",
                value=auth_token,
                max_age=10*365*24*60*60,
                path="/",
                httponly=True,
                samesite="lax",
                secure=False
            )
            return response

        finally:
            db.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN_TELEGRAM] Ошибка: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============== Admin endpoints ==============

@app.get("/admin")
async def admin_page(current_user: User = Depends(require_admin)):
    """Админ-панель"""
    return FileResponse(os.path.join(BASE_DIR, "templates/admin.html"))

@app.get("/admin/api/stats")
async def admin_stats(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Админская статистика по всей системе"""
    users_total = db.query(User).count()
    users_with_session = db.query(TelegramSession).filter(TelegramSession.telegram_user_id.isnot(None)).distinct(TelegramSession.user_id).count()
    tasks_total = db.query(Task).count()
    tasks_running = db.query(Task).filter(Task.status == "running").count()
    active_users = db.query(Task.user_id).filter(Task.status == "running").distinct().count()
    leads_total = db.query(Lead).count()

    return {
        "users_total": users_total,
        "users_with_session": users_with_session,
        "active_users": active_users,
        "tasks_total": tasks_total,
        "tasks_running": tasks_running,
        "leads_total": leads_total
    }

@app.get("/admin/api/users")
async def admin_users(
    page: int = 1,
    limit: int = 20,
    q: str = "",
    has_session: str = "all",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Список пользователей с пагинацией и фильтрами"""
    # Нормализовать поиск по username
    search_username = q.strip()
    if search_username.startswith("@"):
        search_username = search_username[1:]
    search_username = search_username.lower()

    # Базовый запрос к TelegramSession
    query = db.query(TelegramSession)

    # Фильтр has_session
    if has_session == "yes":
        query = query.filter(TelegramSession.telegram_user_id.isnot(None))
    elif has_session == "no":
        query = query.filter(TelegramSession.telegram_user_id.is_(None))

    # Поиск по username
    if search_username:
        query = query.filter(
            TelegramSession.telegram_username.ilike(f"%{search_username}%")
        )

    # Получить sessions с пагинацией (limit+1 для has_more)
    sessions = query.order_by(TelegramSession.created_at.desc()).offset((page - 1) * limit).limit(limit + 1).all()

    has_more = len(sessions) > limit
    sessions = sessions[:limit]

    # Собрать данные по каждому пользователю
    users_data = []
    for session in sessions:
        user = db.query(User).filter(User.id == session.user_id).first()
        if not user:
            continue

        tasks_total = db.query(Task).filter(Task.user_id == user.id).count()
        tasks_running = db.query(Task).filter(Task.user_id == user.id, Task.status == "running").count()
        leads_total = db.query(Lead).join(Task).filter(Task.user_id == user.id).count()

        users_data.append({
            "id": user.id,
            "telegram_username": session.telegram_username,
            "telegram_user_id": session.telegram_user_id,
            "tasks_total": tasks_total,
            "tasks_running": tasks_running,
            "leads_total": leads_total,
            "created_at": session.created_at.isoformat() if session.created_at else None
        })

    return {
        "users": users_data,
        "has_more": has_more,
        "page": page
    }

@app.get("/admin/api/users/{user_id}")
async def admin_user_detail(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Детали пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    session = db.query(TelegramSession).filter(TelegramSession.user_id == user.id).first()

    tasks = db.query(Task).filter(Task.user_id == user.id).all()
    tasks_data = [{"id": t.id, "name": t.name, "status": t.status} for t in tasks[-20:]]

    tasks_total = len(tasks)
    tasks_running = sum(1 for t in tasks if t.status == "running")
    leads_total = db.query(Lead).join(Task).filter(Task.user_id == user.id).count()

    return {
        "user": {
            "id": user.id,
            "phone": user.phone,
            "disabled": user.disabled,
            "plan": user.plan,
            "created_at": user.created_at.isoformat() if user.created_at else None
        },
        "telegram_session": {
            "telegram_user_id": session.telegram_user_id if session else None,
            "telegram_username": session.telegram_username if session else None,
            "alerts_personal": session.alerts_personal if session else None
        } if session else None,
        "counts": {
            "tasks_total": tasks_total,
            "tasks_running": tasks_running,
            "leads_total": leads_total
        },
        "last_tasks": tasks_data
    }

@app.post("/admin/api/users/{user_id}/logout-telegram")
async def admin_logout_telegram(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Отключить Telegram сессию пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Отключить TelegramClient
    await disconnect_user_client(user_id)

    # Удалить TelegramSession из БД
    db.query(TelegramSession).filter(TelegramSession.user_id == user_id).delete(synchronize_session=False)
    db.commit()

    logger.info(f"[ADMIN] user_id={user.id} - Telegram сессия отключена админом")
    return {"ok": True}

@app.post("/admin/api/users/{user_id}/disable")
async def admin_disable_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Отключить пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.disabled = True
    db.commit()

    logger.info(f"[ADMIN] user_id={user.id} - Пользователь отключен")
    return {"ok": True}

@app.post("/admin/api/users/{user_id}/enable")
async def admin_enable_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Включить пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.disabled = False
    db.commit()

    logger.info(f"[ADMIN] user_id={user.id} - Пользователь включен")
    return {"ok": True}

@app.post("/admin/api/users/{user_id}/plan")
async def admin_change_user_plan(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Изменить тарифный план пользователя"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    body = await request.json()
    plan = body.get("plan", "").lower()
    valid_plans = ["trial", "start", "pro", "business"]
    if plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Неверный план. Допустимые значения: {', '.join(valid_plans)}")

    old_plan = user.plan
    user.plan = plan
    db.commit()

    logger.info(f"[ADMIN] user_id={user.id} - Тариф изменен: {old_plan} -> {plan}")
    return {"ok": True, "old_plan": old_plan, "new_plan": plan}

@app.post("/admin/api/users/{user_id}/delete")
async def admin_delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Удалить пользователя (soft delete + logout)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # 1. Отключить пользователя
    user.disabled = True

    # 2. Отключить все его задачи
    db.query(Task).filter(Task.user_id == user.id).update({Task.status: "paused"})

    # 3. Отключить TelegramClient
    await disconnect_user_client(user_id)

    # 4. Удалить TelegramSession
    db.query(TelegramSession).filter(TelegramSession.user_id == user_id).delete(synchronize_session=False)

    db.commit()

    logger.info(f"[ADMIN] user_id={user.id} - Пользователь удален (soft delete)")
    return {"ok": True}

# ============== API для платежей ==============

@app.post("/api/payments/create")
async def create_payment(
    body: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать платеж в YooKassa"""
    # Синхронизировать статус подписки (но не блокировать, если истекла)
    check_and_apply_expiration(current_user, db)

    if not YOOKASSA_AVAILABLE:
        raise HTTPException(status_code=503, detail="YooKassa недоступна")

    # Валидация плана
    if body.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail=f"Неверный план: {body.plan}")

    amount = PLAN_PRICES[body.plan]

    try:
        # Генерировать idempotence_key для защиты от двойных платежей
        idempotence_key = str(uuid.uuid4())

        # Проверить, нет ли уже платежа с таким idempotence_key
        existing_payment = db.query(Payment).filter(
            Payment.idempotence_key == idempotence_key
        ).first()

        if existing_payment:
            # Уже есть платеж с таким ключом - вернуть его
            logger.info(f"[PAYMENT_IDEMPOTENT] user_id={current_user.id} idempotence_key={idempotence_key} (уже существует)")
            return {
                "confirmation_url": None,  # Платеж уже был создан
                "yookassa_payment_id": existing_payment.yookassa_payment_id
            }

        # Создать платеж в YooKassa (без idempotence_key - SDK не поддерживает)
        payment = YooKassaPayment.create({
            "amount": {
                "value": amount,
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": PAYMENT_RETURN_URL
            },
            "capture": True,
            "description": f"JobRadar subscription: {body.plan}",
            "metadata": {
                "user_id": current_user.id
            }
        })

        # Сохранить запись в БД
        db_payment = Payment(
            user_id=current_user.id,
            plan=body.plan,
            idempotence_key=idempotence_key,
            amount=amount,
            yookassa_payment_id=payment.id,
            status="pending"
        )
        db.add(db_payment)
        db.commit()
        db.refresh(db_payment)

        logger.info(f"[PAYMENT] user_id={current_user.id} plan={body.plan} yookassa_id={payment.id}")

        return {
            "confirmation_url": payment.confirmation.confirmation_url,
            "yookassa_payment_id": payment.id
        }

    except Exception as e:
        logger.error(f"[PAYMENT_ERROR] user_id={current_user.id} error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания платежа: {str(e)}")

@app.get("/api/payments/status/{yookassa_payment_id}")
async def get_payment_status(
    yookassa_payment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус платежа"""
    if not YOOKASSA_AVAILABLE:
        raise HTTPException(status_code=503, detail="YooKassa недоступна")

    try:
        # Получить платеж из БД
        db_payment = db.query(Payment).filter(
            Payment.yookassa_payment_id == yookassa_payment_id,
            Payment.user_id == current_user.id
        ).first()

        if not db_payment:
            raise HTTPException(status_code=404, detail="Платеж не найден")

        # Получить статус из YooKassa
        yookassa_payment = YooKassaPayment.find_one(yookassa_payment_id)

        # Обновить статус в БД
        yookassa_status = yookassa_payment.status
        if yookassa_status == "succeeded":
            # ЗАЩИТА: перед активацией проверить текущий статус в БД
            db.refresh(db_payment)

            # Если платеж уже активирован, вернуть ошибку (race condition protection)
            if db_payment.status == "succeeded":
                logger.info(f"[PAYMENT_ALREADY_ACTIVATED] user_id={current_user.id} yookassa_id={yookassa_payment_id} (повторный вызов, повторная активация запрещена)")
                return {
                    "status": "already_activated",
                    "yookassa_payment_id": yookassa_payment_id,
                    "plan": db_payment.plan
                }

            # Активировать платеж
            db_payment.status = "succeeded"
            now = datetime.utcnow()
            db_payment.activated_at = now
            db_payment.expires_at = now + timedelta(days=30)

            # Активировать тариф для пользователя
            current_user.plan = db_payment.plan

            # Установить новый период (каждый платеж даёт 30 дней с текущего момента)
            current_user.paid_until = now + timedelta(days=30)
            logger.info(f"[PAYMENT_SUCCEEDED] user_id={current_user.id} plan={db_payment.plan} paid_until={current_user.paid_until}")

        elif yookassa_status == "canceled":
            db_payment.status = "canceled"
            logger.info(f"[PAYMENT_CANCELED] user_id={current_user.id} yookassa_id={yookassa_payment_id}")

        db.commit()

        return {
            "status": db_payment.status,
            "yookassa_payment_id": yookassa_payment_id,
            "plan": db_payment.plan
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PAYMENT_STATUS_ERROR] user_id={current_user.id} error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения статуса платежа: {str(e)}")

@app.get("/api/contacts/telegram")
async def get_telegram_contact():
    """Получить ссылку на Telegram администратора"""
    from config import TELEGRAM_ADMIN_USERNAME
    return {
        "telegram_url": TELEGRAM_ADMIN_USERNAME
    }

@app.post("/api/logout")
async def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Выйти из аккаунта.

    Логика:
    1. Очистить auth_token пользователя в БД (закончить веб-сессию)
    2. Удалить cookie авторизации

    Важно: TelegramSession НЕ удаляется - она используется для мониторинга независимо от веб-сессии
    """
    try:
        # 1. Очистить auth_token пользователя в БД
        current_user.auth_token = None
        db.commit()
        logger.info(f"[LOGOUT] user_id={current_user.id} - auth_token очищен")

        # 2. Создать ответ и очистить cookie
        response = JSONResponse({"ok": True, "message": "Выход выполнен"})
        response.delete_cookie(key="auth_token", path="/")
        return response

    except Exception as e:
        logger.error(f"Ошибка при logout user_id={current_user.id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="localhost", port=8000)
