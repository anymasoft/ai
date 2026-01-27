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
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH

from database import SessionLocal, init_db
from models import Task, Lead
from telegram_auth import save_session_to_db, get_telegram_client
import monitor

app = FastAPI()

# ============== Глобальное хранилище pending клиентов ==============
# {phone: TelegramClient}
pending_auth_clients: dict[str, TelegramClient] = {}

# ============== Флаг управления мониторингом ==============
monitoring_enabled = True

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
    from database import get_db_path
    from config import DATABASE_URL
    print("\n" + "="*70)
    print("🎯 FastAPI приложение JobRadar запускается...")
    print("="*70)
    print(f"📍 DATABASE_URL: {DATABASE_URL}")
    print(f"📍 Абсолютный путь к БД: {get_db_path()}")
    print("="*70 + "\n")
    init_db()

    # Инициализация Telegram клиента
    try:
        await monitor.init_telegram_client()
        print("✅ Telegram клиент инициализирован\n")
    except Exception as e:
        print(f"❌ Ошибка инициализации Telegram клиента: {e}\n")

    # Запуск мониторинга каналов (старый контур)
    asyncio.create_task(monitor.monitoring_loop())
    print("✅ Запущен мониторинг каналов (monitoring_loop)\n")

    # Запуск мониторинга задач (новый контур)
    asyncio.create_task(monitor.monitoring_loop_tasks())
    print("✅ Запущен мониторинг задач (monitoring_loop_tasks)\n")

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
    forward_channel: Optional[str] = ""

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    sources: Optional[str] = None
    include_keywords: Optional[str] = None
    exclude_keywords: Optional[str] = None
    forward_channel: Optional[str] = None

class TaskResponse(BaseModel):
    id: int
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
    matched_keyword: Optional[str]
    found_at: datetime

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
        forward_channel=task.forward_channel,
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
    if task.forward_channel is not None:
        db_task.forward_channel = task.forward_channel

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

# ============== API для Leads ==============

@app.get("/api/leads", response_model=List[LeadResponse])
async def get_all_leads(db: Session = Depends(get_db)):
    """Получить все найденные лиды"""
    leads = db.query(Lead).order_by(Lead.found_at.desc()).all()
    return leads

@app.get("/api/leads/task/{task_id}", response_model=List[LeadResponse])
async def get_task_leads(task_id: int, db: Session = Depends(get_db)):
    """Получить лиды для конкретной задачи"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    leads = db.query(Lead).filter(Lead.task_id == task_id).order_by(Lead.found_at.desc()).all()
    return leads

@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: int, db: Session = Depends(get_db)):
    """Получить информацию о конкретном лиде"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")
    return lead

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
        print(f"\n📱 === /api/auth/start ===")
        print(f"📱 Phone: {phone}")

        # Создать клиента с пустой StringSession
        client = TelegramClient(StringSession(), TELEGRAM_API_ID, TELEGRAM_API_HASH)
        await client.connect()
        await client.send_code_request(phone)

        # Сохранить клиента в памяти
        pending_auth_clients[phone] = client
        print(f"✅ Клиент создан и сохранён")
        print(f"📋 PENDING: {list(pending_auth_clients.keys())}")
        print(f"✅ === /api/auth/start успешен ===\n")

        return {"ok": True}
    except Exception as e:
        print(f"❌ Ошибка при /api/auth/start: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/submit-code")
async def auth_submit_code(request: AuthCodeRequest):
    """
    ШАГ 2: Отправить код верификации.
    Вернуть информацию требуется ли пароль 2FA.
    """
    try:
        phone = normalize_phone(request.phone)
        print(f"\n🔐 === /api/auth/submit-code ===")
        print(f"📱 Phone: {phone}")
        print(f"🔐 Code: {request.code}")

        client = pending_auth_clients.get(phone)
        if not client:
            print(f"❌ Клиент для {phone} не найден в памяти")
            print(f"📋 PENDING: {list(pending_auth_clients.keys())}")
            raise Exception("Сессия авторизации истекла. Начните заново.")

        try:
            await client.sign_in(phone=phone, code=request.code)
            pending_auth_clients[phone] = client
            print(f"✅ Код верификации принят")
            print(f"📋 PENDING: {list(pending_auth_clients.keys())}")
            print(f"✅ === /api/auth/submit-code успешен ===\n")
            return {"requires_password": False}

        except SessionPasswordNeededError:
            pending_auth_clients[phone] = client
            print(f"⚠️ Требуется пароль 2FA")
            print(f"📋 PENDING: {list(pending_auth_clients.keys())}")
            print(f"⚠️ === /api/auth/submit-code требует пароль ===\n")
            return {"requires_password": True}

    except Exception as e:
        print(f"❌ Ошибка при /api/auth/submit-code: {str(e)}")
        print(f"❌ === /api/auth/submit-code ошибка ===\n")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/submit-password")
async def auth_submit_password(request: AuthPasswordRequest):
    """
    ШАГ 3: Отправить пароль 2FA (если требуется).
    """
    try:
        phone = normalize_phone(request.phone)
        print(f"\n🔑 === /api/auth/submit-password ===")
        print(f"📱 Phone: {phone}")
        print(f"🔐 Password: {'*' * len(request.password)}")

        client = pending_auth_clients.get(phone)
        if not client:
            print(f"❌ Клиент для {phone} не найден в памяти")
            print(f"📋 PENDING: {list(pending_auth_clients.keys())}")
            raise Exception("Сессия авторизации истекла.")

        print(f"📱 Клиент найден, статус подключения: {client.is_connected()}")

        try:
            await client.sign_in(password=request.password)
            print(f"✅ Пароль 2FA принят")
        except Exception as e:
            print(f"❌ Ошибка при вводе пароля: {str(e)}")
            raise

        # Убедиться, что клиент всё ещё подключен
        print(f"📱 После sign_in статус подключения: {client.is_connected()}")

        pending_auth_clients[phone] = client
        print(f"📋 PENDING: {list(pending_auth_clients.keys())}")
        print(f"✅ === /api/auth/submit-password успешен ===\n")

        return {"ok": True}
    except Exception as e:
        print(f"❌ Ошибка при /api/auth/submit-password: {str(e)}")
        print(f"❌ === /api/auth/submit-password ошибка ===\n")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/save")
async def auth_save(request: AuthStartRequest):
    """
    ШАГ 4: Сохранить сессию в SQLite БД.
    Получить StringSession и сохранить в таблице telegram_sessions.
    """
    try:
        phone = normalize_phone(request.phone)
        print(f"\n💾 === /api/auth/save ===")
        print(f"📱 Phone: {phone}")
        print(f"📋 PENDING KEYS: {list(pending_auth_clients.keys())}")

        client = pending_auth_clients.get(phone)
        if not client:
            print(f"❌ Клиент для {phone} не найден в памяти")
            print(f"📋 AVAILABLE KEYS: {list(pending_auth_clients.keys())}")
            raise Exception(f"Клиент авторизации не найден. Доступные ключи: {list(pending_auth_clients.keys())}")

        print(f"✅ Клиент найден в памяти")

        try:
            # Получить информацию о пользователе
            print(f"👤 Получаю информацию о пользователе...")
            me = await client.get_me()
            user_info = {
                "phone": phone,
                "first_name": me.first_name or "",
                "last_name": me.last_name or "",
                "username": me.username or "",
                "id": me.id
            }
            print(f"✅ Информация о пользователе: {user_info['first_name']} {user_info['last_name']} (ID: {me.id})")
        except Exception as e:
            print(f"❌ Ошибка получения информации о пользователе: {str(e)}")
            raise

        try:
            # Получить строку сессии
            session_string = client.session.save()
            print(f"✅ Session string получена, длина: {len(session_string)}")
        except Exception as e:
            print(f"❌ Ошибка получения session string: {str(e)}")
            raise

        try:
            # Сохранить в БД с telegram_user_id
            success = await save_session_to_db(phone, session_string, me.id)
            if not success:
                raise Exception("Ошибка при сохранении в БД")
            print(f"✅ Сессия сохранена в БД с telegram_user_id={me.id}")
        except Exception as e:
            print(f"❌ Ошибка сохранения в БД: {str(e)}")
            raise

        try:
            # Удалить из памяти и отключить
            del pending_auth_clients[phone]
            await client.disconnect()
            print(f"✅ Клиент удалён из памяти и отключен")
        except Exception as e:
            print(f"⚠️ Ошибка при отключении клиента (не критично): {str(e)}")

        print(f"📋 REMAINING PENDING: {list(pending_auth_clients.keys())}")
        print(f"✅ === /api/auth/save успешен ===\n")

        return {"ok": True, "user": user_info}
    except Exception as e:
        print(f"❌ Ошибка при /api/auth/save: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"❌ === /api/auth/save ошибка ===\n")
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
