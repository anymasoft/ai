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

# Глобальное хранилище для сессий авторизации (по номерам телефонов)
_auth_sessions = {}  # {phone: {"client": client, "stage": "...", "created_at": ...}}


async def start_auth_flow(phone: str):
    """Начинает процесс авторизации. Возвращает True если нужно введение кода."""
    phone = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Создать временную сессию (пустую StringSession)
    auth_client = TelegramClient(StringSession(), TELEGRAM_API_ID, TELEGRAM_API_HASH)

    try:
        # Подключиться и запросить код
        await auth_client.connect()
        await auth_client.send_code_request(phone)

        # Сохранить клиента и состояние
        _auth_sessions[phone] = {
            "client": auth_client,
            "stage": "waiting_code",
        }

        print(f"✅ Авторизация инициирована для {phone}")
        return True
    except Exception as e:
        print(f"❌ Ошибка инициирования авторизации: {str(e)}")
        raise Exception(f"Ошибка инициирования авторизации: {str(e)}")


async def submit_code(phone: str, code: str):
    """Отправляет код верификации. Возвращает True если успешно, или требует пароль."""
    phone = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    if phone not in _auth_sessions:
        raise Exception("Сессия авторизации истекла. Начните с ввода номера.")

    auth_session = _auth_sessions[phone]
    auth_client = auth_session["client"]

    try:
        await auth_client.sign_in(phone, code)
        auth_session["stage"] = "success"
        print(f"✅ Код верификации принят для {phone}")
        return {"success": True}
    except SessionPasswordNeededError:
        auth_session["stage"] = "waiting_password"
        print(f"⚠️ Требуется пароль 2FA для {phone}")
        return {"success": False, "requires_password": True}
    except Exception as e:
        print(f"❌ Ошибка при вводе кода: {str(e)}")
        raise Exception(f"Неверный код: {str(e)}")


async def submit_password(phone: str, password: str):
    """Отправляет пароль 2FA. Завершает авторизацию."""
    phone = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    if phone not in _auth_sessions:
        raise Exception("Сессия авторизации истекла.")

    auth_session = _auth_sessions[phone]
    auth_client = auth_session["client"]

    try:
        await auth_client.sign_in(password=password)
        auth_session["stage"] = "success"
        print(f"✅ Пароль 2FA принят для {phone}")
        return True
    except Exception as e:
        print(f"❌ Ошибка при вводе пароля: {str(e)}")
        raise Exception(f"Неверный пароль: {str(e)}")


async def save_session(phone: str):
    """Сохраняет сессию в БД после успешной авторизации."""
    print(f"\n📥 === НАЧАЛО save_session для {phone} ===")

    phone = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    print(f"📱 Нормализованный номер: {phone}")
    print(f"📋 Текущие сессии в памяти: {list(_auth_sessions.keys())}")

    if phone not in _auth_sessions:
        print(f"❌ Сессия для {phone} не найдена в _auth_sessions")
        raise Exception("Авторизация не завершена. Сессия не найдена.")

    auth_session = _auth_sessions[phone]
    print(f"📊 Статус сессии: {auth_session.get('stage')}")

    if auth_session.get("stage") != "success":
        print(f"❌ Неправильный статус: {auth_session.get('stage')}")
        raise Exception(f"Авторизация не завершена. Стадия: {auth_session.get('stage')}")

    auth_client = auth_session["client"]
    print(f"🔌 Клиент получен: {auth_client}")

    db = None
    try:
        # Получить строку сессии из StringSession
        print(f"💾 Попытка получить session_string...")
        session_string = auth_client.session.save()
        print(f"✅ Session string получена, длина: {len(session_string)}")

        db = SessionLocal()
        print(f"🗄️ БД подключена")

        # Проверить, есть ли уже сессия для этого номера
        existing = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
        if existing:
            print(f"🔄 Сессия найдена, обновляю...")
            existing.session_data = session_string.encode('utf-8')
            existing.is_authorized = True
        else:
            print(f"✨ Создаю новую сессию...")
            new_session = TelegramSession(
                phone=phone, session_data=session_string.encode('utf-8'), is_authorized=True
            )
            db.add(new_session)

        print(f"💾 Коммитю в БД...")
        db.commit()
        print(f"✅ Коммит успешен")

        db.close()
        print(f"🗄️ БД закрыта")

        print(f"✅ Сессия сохранена в БД для {phone}")

        # Очистить из памяти
        del _auth_sessions[phone]
        print(f"🗑️ Сессия удалена из памяти")
        print(f"📤 === КОНЕЦ save_session (УСПЕХ) ===\n")

        return True
    except Exception as e:
        print(f"❌ ОШИБКА В save_session: {type(e).__name__}: {str(e)}")
        import traceback
        print(traceback.format_exc())
        if db:
            db.close()
        print(f"📤 === КОНЕЦ save_session (ОШИБКА) ===\n")
        raise Exception(f"Ошибка сохранения сессии: {str(e)}")


async def get_telegram_client(phone: str):
    """Получить клиента для указанного номера (из сохранённой сессии)."""
    phone = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

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
        print(f"❌ Ошибка восстановления сессии: {e}")
        return None


async def cancel_auth(phone: str = None):
    """Отменить текущий процесс авторизации."""
    if phone:
        phone = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if phone in _auth_sessions:
            auth_session = _auth_sessions[phone]
            try:
                await auth_session["client"].disconnect()
            except:
                pass
            del _auth_sessions[phone]
            print(f"✅ Авторизация отменена для {phone}")
    else:
        # Отменить все сессии авторизации
        for phone_key in list(_auth_sessions.keys()):
            try:
                await _auth_sessions[phone_key]["client"].disconnect()
            except:
                pass
            del _auth_sessions[phone_key]
        print("✅ Все сессии авторизации отменены")
