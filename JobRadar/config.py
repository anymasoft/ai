"""
JobRadar v0 - Конфигурация
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Telegram API
TELEGRAM_API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")
TELEGRAM_PHONE = os.getenv("TELEGRAM_PHONE", "")  # Номер телефона для User Client

# Bot Token для управления (inline-кнопки)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_ID = int(os.getenv("TELEGRAM_ADMIN_ID", "0"))

# Целевой канал для публикации найденных постов
TARGET_CHANNEL_ID = int(os.getenv("TARGET_CHANNEL_ID", "0"))  # например: -1003022594210

# Базы данных
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'jobradar.db').replace(os.sep, '/')}"

# Monitoring
POLLING_INTERVAL_SECONDS = 10  # Проверка каждые 10 сек (как в LeadScanner)
MAX_MESSAGES_PER_CHECK = 100  # Макс сообщений за одну проверку

# Logs
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Payment and CORS
PAYMENT_RETURN_URL = os.getenv("PAYMENT_RETURN_URL", "http://localhost:8000/dashboard#billing")

CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_STR.split(",")]
