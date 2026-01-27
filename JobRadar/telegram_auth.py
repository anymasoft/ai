"""
JobRadar - Управление авторизацией и сессией Telegram
"""
import os
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH
from database import SessionLocal
from models import TelegramSession

# Глобальный клиент и состояние авторизации
_auth_client = None
_auth_state = {}  # Хранит состояние текущей авторизации


async def start_auth_flow(phone: str):
    """Начинает процесс авторизации. Возвращает True если нужно введение кода."""
    global _auth_client, _auth_state

    _auth_state = {"phone": phone, "stage": "waiting_code"}

    # Создать временную сессию (пустую StringSession)
    _auth_client = TelegramClient(StringSession(), TELEGRAM_API_ID, TELEGRAM_API_HASH)

    try:
        # Подключиться и запросить код
        await _auth_client.connect()
        await _auth_client.send_code_request(phone)
        return True
    except Exception as e:
        _auth_state = {}
        _auth_client = None
        raise Exception(f"Ошибка инициирования авторизации: {str(e)}")


async def submit_code(phone: str, code: str):
    """Отправляет код верификации. Возвращает True если успешно, или требует пароль."""
    global _auth_client, _auth_state

    if not _auth_client or _auth_state.get("phone") != phone:
        raise Exception("Сессия авторизации истекла. Начните с ввода номера.")

    try:
        await _auth_client.sign_in(phone, code)
        _auth_state["stage"] = "success"
        return {"success": True}
    except SessionPasswordNeededError:
        _auth_state["stage"] = "waiting_password"
        return {"success": False, "requires_password": True}
    except Exception as e:
        raise Exception(f"Неверный код: {str(e)}")


async def submit_password(phone: str, password: str):
    """Отправляет пароль 2FA. Завершает авторизацию."""
    global _auth_client, _auth_state

    if not _auth_client or _auth_state.get("phone") != phone:
        raise Exception("Сессия авторизации истекла.")

    try:
        await _auth_client.sign_in(password=password)
        _auth_state["stage"] = "success"
        return True
    except Exception as e:
        raise Exception(f"Неверный пароль: {str(e)}")


async def save_session(phone: str):
    """Сохраняет сессию в БД после успешной авторизации."""
    global _auth_client

    if not _auth_client or _auth_state.get("stage") != "success":
        raise Exception("Авторизация не завершена")

    try:
        # Получить строку сессии из StringSession
        session_string = _auth_client.session.save()

        db = SessionLocal()

        # Проверить, есть ли уже сессия для этого номера
        existing = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
        if existing:
            existing.session_data = session_string.encode('utf-8')
            existing.is_authorized = True
        else:
            new_session = TelegramSession(
                phone=phone, session_data=session_string.encode('utf-8'), is_authorized=True
            )
            db.add(new_session)

        db.commit()
        db.close()

        # Очистить глобальное состояние
        _auth_client = None
        _auth_state = {}

        return True
    except Exception as e:
        db.close()
        raise Exception(f"Ошибка сохранения сессии: {str(e)}")


async def get_telegram_client(phone: str):
    """Получить клиента для указанного номера (из сохранённой сессии)."""
    db = SessionLocal()
    session = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
    db.close()

    if not session or not session.is_authorized:
        return None

    try:
        # Восстановить клиента из сохранённой сессии
        session_string = session.session_data.decode('utf-8')
        client = TelegramClient(StringSession(session_string), TELEGRAM_API_ID, TELEGRAM_API_HASH)
        await client.connect()
        return client
    except Exception as e:
        print(f"Ошибка восстановления сессии: {e}")
        return None


async def cancel_auth():
    """Отменить текущий процесс авторизации."""
    global _auth_client, _auth_state

    if _auth_client:
        try:
            await _auth_client.disconnect()
        except:
            pass

    _auth_client = None
    _auth_state = {}
