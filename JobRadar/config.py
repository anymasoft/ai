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

# Базы данных
DATABASE_URL = "sqlite:///./jobradar.db"

# Monitoring
POLLING_INTERVAL_SECONDS = 10  # Проверка каждые 10 сек (как в LeadScanner)
MAX_MESSAGES_PER_CHECK = 100  # Макс сообщений за одну проверку

# Logs
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
