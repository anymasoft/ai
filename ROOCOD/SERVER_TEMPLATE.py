"""
YouTube Subtitle Translation Server - Token Authentication Model
Сервер для построчного перевода субтитров YouTube с использованием токен-авторизации
"""

from flask import Flask, request, jsonify, send_from_directory, redirect, make_response
from flask_cors import CORS
import sqlite3
import json
import os
import base64
import requests
import uuid
import time
import threading
import queue
from openai import OpenAI
from datetime import datetime
from dotenv import load_dotenv
from yookassa import Configuration, Payment

import time
import random

RETRYABLE_ERRORS = (429, 500, 502, 503, 504)

def gpt_request_with_retry(func, max_attempts=5, base_delay=0.5):
    """
    Универсальный retry для GPT-запросов.
    func — лямбда, внутри которой вызывается openai client.
    """
    for attempt in range(1, max_attempts + 1):
        try:
            return func()

        except Exception as e:
            # Определяем код ошибки если есть
            msg = str(e).lower()
            should_retry = False

            for code in RETRYABLE_ERRORS:
                if str(code) in msg:
                    should_retry = True
                    break

            if not should_retry:
                # Неретрайбл ошибка → выбрасываем сразу
                raise

            if attempt == max_attempts:
                # Последняя попытка → отдаём ошибку
                raise

            # Экспоненциальная задержка
            delay = base_delay * (2 ** (attempt - 1))

            # Для распределения нагрузки — немного шума
            delay += random.uniform(0, 0.2)

            print(f"[GPT RETRY] Attempt {attempt} failed. Retrying in {delay:.2f}s... Error: {e}")

            time.sleep(delay)


load_dotenv()  # Загрузка переменных окружения из .env

app = Flask(__name__)

# Безопасный глобальный DB-lock
_db_lock = threading.Lock()

def safe_db_execute(fn):
    with _db_lock:
        return fn()

# Директория, где находится этот файл (token-auth-system/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Директория с файлами расширения (extension/ внутри token-auth-system/)
EXTENSION_DIR = os.path.join(BASE_DIR, 'extension')

# Директория с файлами веб-интерфейса (web/ - для сайта, отдельно от расширения)
WEB_DIR = os.path.join(BASE_DIR, 'web')

# Директория с файлами админ-панели
ADMIN_DIR = os.path.join(BASE_DIR, 'admin')

# Email администратора
ADMIN_EMAIL = 'nazarov.soft@gmail.com'

# CORS: разрешаем доступ для YouTube и Chrome расширений
CORS(
    app,
    resources={
        r"/translate-line": {
            "origins": ["https://www.youtube.com", "https://youtube.com"],
            "methods": ["POST", "OPTIONS"],
            "allow_headers": ["Content-Type"],
            "max_age": 3600
        },
        r"/api/*": {
            "origins": ["https://api.beem.ink", "chrome-extension://*"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,  # Для cookies на сайте
            "max_age": 3600
        },
        r"/auth*": {
            "origins": ["https://api.beem.ink", "chrome-extension://*"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 3600
        },
        r"/create-payment/*": {
            "origins": ["https://api.beem.ink", "chrome-extension://*"],
            "methods": ["POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 3600
        },
        r"/switch-plan/*": {
            "origins": ["https://api.beem.ink", "chrome-extension://*"],
            "methods": ["POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 3600
        },
        r"/admin*": {
            "origins": ["https://api.beem.ink"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 3600
        },
        r"/health": {
            "origins": "*",
            "methods": ["GET"]
        },
        r"/stats": {
            "origins": "*",
            "methods": ["GET"]
        }
    }
)

# Конфигурация
DATABASE = os.path.join(BASE_DIR, 'translations.db')
USERS_DB = os.path.join(BASE_DIR, 'users.db')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-api-key-here')
client = OpenAI(api_key=OPENAI_API_KEY)

# Ограничение параллельных запросов к GPT
GPT_MAX_CONCURRENT_REQUESTS = int(os.getenv('GPT_MAX_CONCURRENT_REQUESTS', '3'))
_gpt_semaphore = threading.BoundedSemaphore(GPT_MAX_CONCURRENT_REQUESTS)

# Очередь для асинхронных задач
translation_queue = queue.Queue()

# OAuth конфигурация
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', 'TEMP_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', 'TEMP_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = 'https://api.beem.ink/auth/callback'

# Yookassa конфигурация
YOOKASSA_SHOP_ID = os.getenv('YOOKASSA_SHOP_ID')
YOOKASSA_API_KEY = os.getenv('YOOKASSA_API_KEY')
YOOKASSA_RETURN_URL_BASE = os.getenv('YOOKASSA_RETURN_URL_BASE', 'https://api.beem.ink')

# Инициализация Yookassa
if YOOKASSA_SHOP_ID and YOOKASSA_API_KEY:
    Configuration.account_id = YOOKASSA_SHOP_ID
    Configuration.secret_key = YOOKASSA_API_KEY

# Цены планов (в рублях)
PLAN_PRICES = {
    'Pro': 900,      # 9$  ≈ 900₽
    'Premium': 1900  # 19$ ≈ 1900₽
}

# Фоновый воркер для обработки задач из очереди
def translation_worker():
    while True:
        task = translation_queue.get()
        if task is None:
            break
        fn, args, kwargs = task
        try:
            fn(*args, **kwargs)
        except Exception as e:
            print("Queue task failed:", e)
        translation_queue.task_done()

worker_thread = threading.Thread(target=translation_worker, daemon=True)
worker_thread.start()


# Утилиты для OAuth
def decode_jwt(jwt_token):
    """Декодирует JWT токен (без проверки подписи)"""
    try:
        header, payload, signature = jwt_token.split(".")
        padded = payload + "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(padded)
        return json.loads(decoded)
    except Exception as e:
        print(f"Ошибка декодирования JWT: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════
# DATABASE INITIALIZATION - Users table with token authentication
# ═══════════════════════════════════════════════════════════════════

def init_db():
    """Создает таблицу для хранения переводов и пользователей"""
    def _local():
        # Таблица переводов
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA temp_store=MEMORY;")
        cursor.execute("PRAGMA cache_size=-32000;")  # 32MB

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                original_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                lang TEXT NOT NULL DEFAULT 'ru',
                timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(video_id, line_number, lang)
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_video_line
            ON translations(video_id, line_number, lang)
        ''')

        conn.commit()
        conn.close()

        # Таблица пользователей с токенами
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()

        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA temp_store=MEMORY;")
        cursor.execute("PRAGMA cache_size=-32000;")  # 32MB

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'Free',
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                plan_expires_at INTEGER
            )
        ''')

        # Добавляем колонку plan_expires_at если её нет (для старых БД)
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'plan_expires_at' not in columns:
            cursor.execute('ALTER TABLE users ADD COLUMN plan_expires_at INTEGER')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_token
            ON users(token)
        ''')

        # Таблица обратной связи (feedback)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                plan TEXT DEFAULT 'Free',
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_feedback_email
            ON feedback(email)
        ''')

        # Таблица для хранения истории платежей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                plan TEXT NOT NULL,
                payment_id TEXT,
                status TEXT NOT NULL,
                timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                raw TEXT
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_payments_email
            ON payments(email)
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_payments_timestamp
            ON payments(timestamp)
        ''')

        cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_id
            ON payments(payment_id)
        ''')

        conn.commit()
        conn.close()

    safe_db_execute(_local)


# ═══════════════════════════════════════════════════════════════════
# TOKEN AUTHENTICATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def create_or_update_user(email, plan='Free'):
    """Создает или обновляет пользователя.
    Если пользователь существует - возвращает СУЩЕСТВУЮЩИЙ токен и сохраняет текущий план.
    Если не существует - создает нового с новым токеном."""

    def _local():
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()

        # Проверяем, существует ли пользователь с таким email
        cursor.execute('SELECT token, plan FROM users WHERE email = ?', (email,))
        existing_user = cursor.fetchone()

        if existing_user:
            # Пользователь существует - возвращаем существующий токен и НЕ меняем план
            existing_token = existing_user[0]
            conn.close()
            return existing_token
        else:
            # Пользователь новый - создаем новый токен
            token = uuid.uuid4().hex

            cursor.execute('''
                INSERT INTO users (email, token, plan)
                VALUES (?, ?, ?)
            ''', (email, token, plan))

            conn.commit()
            conn.close()

            return token

    return safe_db_execute(_local)


def get_user_by_token(token):
    """Получает данные пользователя по токену.
    Здесь же выполняется автосброс просроченного плана на Free."""

    def _local():
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT email, plan, plan_expires_at
            FROM users
            WHERE token = ?
        ''', (token,))

        result = cursor.fetchone()
        if not result:
            conn.close()
            return None

        email, plan, plan_expires_at = result
        current_time = int(time.time())

        # Автосброс просроченного платного плана на Free
        if plan != 'Free' and plan_expires_at and current_time > plan_expires_at:
            cursor.execute(
                'UPDATE users SET plan = "Free", plan_expires_at = NULL WHERE email = ?',
                (email,)
            )
            conn.commit()
            plan = 'Free'

        conn.close()
        return {'email': email, 'plan': plan}

    return safe_db_execute(_local)


def update_user_plan(email, plan):
    """Обновляет тариф пользователя"""

    def _local():
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE users
            SET plan = ?
            WHERE email = ?
        ''', (plan, email))

        conn.commit()
        affected = cursor.rowcount
        conn.close()

        return affected > 0

    return safe_db_execute(_local)


# ═══════════════════════════════════════════════════════════════════
# TRANSLATION CACHE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def check_line_cache(video_id, line_number, lang='ru'):
    """Проверяет наличие перевода строки в кеше"""

    def _local():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT translated_text
            FROM translations
            WHERE video_id = ? AND line_number = ? AND lang = ?
        ''', (video_id, line_number, lang))

        result = cursor.fetchone()
        conn.close()

        if result:
            return result[0]
        return None

    return safe_db_execute(_local)


def save_line_to_cache(video_id, line_number, original_text, translated_text, lang='ru'):
    """Сохраняет перевод одной строки в кеш"""

    def _local():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO translations
            (video_id, line_number, original_text, translated_text, lang)
            VALUES (?, ?, ?, ?, ?)
        ''', (video_id, line_number, original_text, translated_text, lang))

        conn.commit()
        conn.close()

    safe_db_execute(_local)


# Маппинг языковых кодов на полные названия
LANGUAGE_NAMES = {
    'ru': 'Russian',
    'en': 'English',
    'es': 'Spanish',
    'de': 'German',
    'fr': 'French',
    'ja': 'Japanese',
    'zh': 'Chinese',
    'it': 'Italian',
    'pt': 'Portuguese'
}


# Перевод одной строки через GPT-4o-mini с контекстом
def translate_line_with_gpt(text, prev_context=None, lang='ru'):
    """Переводит одну строку субтитров с учетом предыдущего контекста"""

    # Получаем полное название языка
    target_language = LANGUAGE_NAMES.get(lang, 'Russian')

    # Формируем промпт с контекстом
    if prev_context and len(prev_context) > 0:
        context_text = '\n'.join([f"[prev] {line}" for line in prev_context[-2:]])
        text_to_translate = f"{context_text}\n[current] {text}"
    else:
        text_to_translate = f"[current] {text}"

    system_prompt = f"""
    You are a professional subtitle translator for YouTube videos.
    Your task is to translate from English into {target_language}.

    MAIN TASK:
    Translate ONLY the [current] line using the [prev] lines as context for accuracy.

    CORE RULES:
    ✔ NATURAL SPEECH — The translation must sound like fluent, natural {target_language}, not a literal dictionary-style translation.
    ✔ FIX RECOGNITION ERRORS — Correct obvious speech-to-text errors found in [current].
    ✔ USE CONTEXT — Analyze [prev] to:
       • understand the continuation of the idea
       • determine speaker gender (if relevant)
       • resolve ambiguous words correctly
       • translate pronouns based on previous lines
       • maintain consistency of style and terminology

    SPECIAL HANDLING:
    • Proper names: preserve the original spelling (e.g. "John" → "Джон" if Russian target)
    • Technical terms: use commonly accepted equivalents in {target_language}
    • Slang/expression: translate into natural conversational equivalents
    • Sound effects: keep them in square brackets (e.g. [music], [applause])
    • Unclear fragments: replace with a meaningful continuation based on context

    TECHNICAL REQUIREMENTS:
    • Keep timing implications and natural pauses of speech
    • NEVER add explanations, comments, notes, or prefixes
    • NEVER translate or output the [prev] lines — they are ONLY for context
    • NEVER output anything except the translation of the [current] line

    OUTPUT FORMAT:
    Return ONLY the clean translated text of the [current] line.
    No quotes, no brackets (except sound effects), no metadata, no formatting.

    EXAMPLE OF CORRECT OUTPUT:
    Привет, как дела? Я рад тебя видеть!
    """

    try:
        # Ограничиваем количество одновременных GPT-запросов семафором
        with _gpt_semaphore:
            response = gpt_request_with_retry(lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text_to_translate}
                ],
                temperature=0.3,
                max_tokens=200
            ))

            translated_text = response.choices[0].message.content.strip()
            translated_text = translated_text.replace('[current]', '').strip()

            return translated_text

    except Exception as e:
        print(f"Ошибка при переводе через GPT: {e}")
        return None


# Батч-перевод через GPT-4o-mini
def translate_batch_with_gpt(texts, lang='ru'):
    """Переводит батч строк субтитров через GPT"""
    
    # Получаем полное название языка
    target_language = LANGUAGE_NAMES.get(lang, 'Russian')
    
    system_prompt = f"""
    You are a professional subtitle translator for YouTube videos.
    Your task is to translate each element of the array from English into {target_language}.

    CORE RULES:
    ✔ NATURAL SPEECH — Each translation must sound like fluent, natural {target_language}, not literal dictionary-style translations.
    ✔ FIX RECOGNITION ERRORS — Correct obvious speech-to-text errors found in the original text.
    ✔ PRESERVE MEANING — Maintain the exact meaning, style, and length of each original line.
    ✔ INDEPENDENT TRANSLATIONS — Translate each line as a separate entity. Do not combine lines. Do not shorten. Do not group.

    SPECIAL HANDLING:
    • Proper names: preserve the original spelling (e.g. "John" → "Джон" if Russian target)
    • Technical terms: use commonly accepted equivalents in {target_language}
    • Slang/expression: translate into natural conversational equivalents
    • Sound effects: keep them in square brackets (e.g. [music], [applause])
    • Unclear fragments: replace with meaningful continuations based on context

    TECHNICAL REQUIREMENTS:
    • Keep timing implications and natural pauses of speech
    • NEVER add explanations, comments, notes, or prefixes
    • NEVER output anything except the array of translations
    • Return EXACTLY the same number of translations as input lines

    OUTPUT FORMAT:
    Return ONLY a JSON object with key "translations" containing an array of translations in the same order as input.
    Example: {{"translations": ["Привет, как дела?", "Я рад тебя видеть!"]}}
    """

    try:
        user_content = json.dumps(texts, ensure_ascii=False)
        
        # Ограничиваем количество одновременных запросов к GPT семафором
        with _gpt_semaphore:
            response = gpt_request_with_retry(lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.3,
                max_tokens=1000
            ))

            translated_text = response.choices[0].message.content.strip()
            
            # Парсим JSON ответ
            try:
                result = json.loads(translated_text)
                if isinstance(result, dict) and 'translations' in result:
                    translations = result['translations']
                    if isinstance(translations, list) and len(translations) == len(texts):
                        return translations
                    else:
                        print(f"Ошибка: GPT вернул неверный формат. Ожидалось {len(texts)} переводов, получено {len(translations)}")
                        return None
                else:
                    print(f"Ошибка: GPT не вернул JSON с ключом 'translations': {translated_text}")
                    return None
            except json.JSONDecodeError:
                print(f"Ошибка парсинга JSON от GPT: {translated_text}")
                return None

    except Exception as e:
        print(f"Ошибка при батч-переводе через GPT: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.route('/translate-line', methods=['POST', 'OPTIONS'])
def translate_line():
    """Endpoint для перевода одной строки субтитров"""

    if request.method == 'OPTIONS':
        return '', 200

    data = request.json
    video_id = data.get('videoId')
    line_number = data.get('lineNumber')
    text = data.get('text')
    prev_context = data.get('prevContext', [])
    lang = data.get('lang', 'ru')
    total_lines = data.get('totalLines', 0)  # Общее количество строк

    if video_id is None or line_number is None or not text:
        return jsonify({'error': 'Missing videoId, lineNumber or text'}), 400

    # ═══════════════════════════════════════════════════════════════════
    # PLAN DETECTION & LIMITS - определяем план и лимиты
    # ═══════════════════════════════════════════════════════════════════

    # Пытаемся получить токен из Authorization header
    user_plan = 'Free'
    user_email = None

    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = get_user_by_token(token)
        if user:
            user_plan = user['plan']
            user_email = user['email']

    # Вычисляем лимит для Free плана (30% строк)
    max_free_line = -1
    if total_lines > 0:
        max_free_line = int(total_lines * 0.3) - 1  # 30% строк (индексация с 0)

    # ПОДРОБНОЕ ЛОГИРОВАНИЕ ЛИМИТОВ
    current_progress = line_number + 1  # +1 т.к. индексация с 0
    percent_done = (current_progress / total_lines * 100) if total_lines > 0 else 0

    # Проверяем лимит для Free плана
    if user_plan == 'Free' and total_lines > 0 and line_number > max_free_line:
        return jsonify({
            'videoId': video_id,
            'lineNumber': line_number,
            'text': '',
            'cached': False,
            'limited': True,
            'export_allowed': False,
            'plan': user_plan,
            'stop': True  # Сигнал клиенту остановить перевод
        })

    # ═══════════════════════════════════════════════════════════════════
    # TRANSLATION - переводим строку (ПОЛНОСТЬЮ, без обрезки)
    # ═══════════════════════════════════════════════════════════════════

    # Проверяем кеш
    cached_translation = check_line_cache(video_id, line_number, lang)

    if cached_translation:
        return jsonify({
            'videoId'   : video_id,
            'lineNumber': line_number,
            'text'      : cached_translation,
            'cached'    : True,
            'limited'   : user_plan == 'Free',
            'export_allowed': user_plan in ['Premium', ],
            'plan'      : user_plan,
            'stop'      : False
        })

    # Переводим через GPT
    translated_text = translate_line_with_gpt(text, prev_context, lang)

    if not translated_text:
        return jsonify({'error': 'Translation failed'}), 500

    # Сохраняем в кеш ПОЛНЫЙ перевод (без обрезки)
    save_line_to_cache(video_id, line_number, text, translated_text, lang)

    return jsonify({
        'videoId'   : video_id,
        'lineNumber': line_number,
        'text'      : translated_text,
        'cached'    : False,
        'limited'   : user_plan == 'Free',
        'export_allowed': user_plan in ['Premium', ],
        'plan'      : user_plan,
        'stop'      : False
    })


@app.route('/translate-batch', methods=['POST', 'OPTIONS'])
def translate_batch():
    """Endpoint для батч-перевода субтитров"""

    if request.method == 'OPTIONS':
        return '', 200

    data = request.json
    video_id = data.get('videoId')
    lang = data.get('lang', 'ru')
    total_lines = data.get('totalLines', 0)
    items = data.get('items', [])

    if not video_id or not items:
        return jsonify({'error': 'Missing videoId or items'}), 400

    # ═══════════════════════════════════════════════════════════════════
    # PLAN DETECTION & LIMITS - определяем план и лимиты
    # ═══════════════════════════════════════════════════════════════════

    # Пытаемся получить токен из Authorization header
    user_plan = 'Free'
    user_email = None

    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = get_user_by_token(token)
        if user:
            user_plan = user['plan']
            user_email = user['email']

    # Вычисляем лимит для Free плана (30% строк)
    max_free_line = -1
    if total_lines > 0:
        max_free_line = int(total_lines * 0.3) - 1  # 30% строк (индексация с 0)

    # Проверяем лимит для Free плана
    limited = False
    stop = False
    if user_plan == 'Free' and total_lines > 0:
        # Проверяем, есть ли хоть одна строка за лимитом
        for item in items:
            line_number = item.get('lineNumber', 0)
            if line_number > max_free_line:
                limited = True
                stop = True
                break

    # ═══════════════════════════════════════════════════════════════════
    # TRANSLATION - переводим батч строк
    # ═══════════════════════════════════════════════════════════════════

    # Собираем строки для перевода и проверяем кеш
    texts_to_translate = []
    cached_items = []
    uncached_items = []
    uncached_indices = []

    for i, item in enumerate(items):
        line_number = item.get('lineNumber', i)
        text = item.get('text', '')

        # Валидация lineNumber
        if not isinstance(line_number, int) or line_number < 0:
            continue  # Пропускаем некорректные номера строк

        if total_lines > 0 and line_number >= total_lines:
            continue  # Пропускаем строки за пределами диапазона

        # Проверяем кеш
        cached_translation = check_line_cache(video_id, line_number, lang)
        if cached_translation:
            cached_items.append({
                'lineNumber': line_number,
                'text': cached_translation,
                'cached': True
            })
        else:
            texts_to_translate.append(text)
            uncached_items.append(item)
            uncached_indices.append(i)

    # Если все строки в кеше - возвращаем результат
    if len(texts_to_translate) == 0:
        return jsonify({
            'videoId': video_id,
            'items': cached_items,
            'plan': user_plan,
            'export_allowed': user_plan in ['Premium'],
            'limited': limited,
            'stop': stop
        })

    # Переводим через GPT
    translations = translate_batch_with_gpt(texts_to_translate, lang)

    if not translations:
        return jsonify({'error': 'Batch translation failed'}), 500

    # Формируем полный результат
    result_items = []
    
    # Добавляем кешированные элементы
    result_items.extend(cached_items)
    
    # Добавляем переведенные элементы
    for i, (item, translation) in enumerate(zip(uncached_items, translations)):
        line_number = item.get('lineNumber', uncached_indices[i])
        text = item.get('text', '')
        
        # Сохраняем в кеш
        save_line_to_cache(video_id, line_number, text, translation, lang)
        
        result_items.append({
            'lineNumber': line_number,
            'text': translation,
            'cached': False
        })

    # Сортируем по lineNumber для корректного порядка
    result_items.sort(key=lambda x: x['lineNumber'])

    return jsonify({
        'videoId': video_id,
        'items': result_items,
        'plan': user_plan,
        'export_allowed': user_plan in ['Premium'],
        'limited': limited,
        'stop': stop
    })


@app.route('/api/plan', methods=['GET', 'OPTIONS'])
def api_plan():
    """API для получения тарифного плана
    Проверяет ЛИБО Authorization header (для расширения), ЛИБО cookie (для сайта)"""

    if request.method == 'OPTIONS':
        return '', 200

    token = None

    # Сначала проверяем Authorization header (расширение)
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    else:
        # Если нет header, проверяем cookie (сайт)
        cookie_token = request.cookies.get('auth_token')
        if cookie_token:
            token = cookie_token

    # Если токен не найден ни в header, ни в cookie
    if not token:
        return jsonify({"error": "unauthorized"}), 401

    # Проверяем токен в БД (здесь же сработает автосброс по сроку)
    user = get_user_by_token(token)

    if not user:
        return jsonify({"error": "unauthorized"}), 401

    return jsonify({
        "status": "ok",
        "email": user['email'],
        "plan": user['plan']
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})


@app.route('/stats', methods=['GET'])
def stats():
    """Статистика по кешу"""
    def _local():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM translations')
        total = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(DISTINCT video_id) FROM translations')
        unique_videos = cursor.fetchone()[0]

        conn.close()
        return total, unique_videos

    total, unique_videos = safe_db_execute(_local)

    return jsonify({
        'total_lines': total,
        'unique_videos': unique_videos
    })


# ═══════════════════════════════════════════════════════════════════
# OAUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.route('/auth/callback')
def oauth_callback():
    """OAuth callback - обработка кода от Google"""
    code = request.args.get('code')

    if not code:
        return "<h1>Ошибка</h1><p>Код авторизации не получен.</p>", 400

    # Обмениваем code на токены
    token_url = 'https://oauth2.googleapis.com/token'
    token_data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code'
    }

    try:
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        tokens = response.json()

        id_token = tokens.get('id_token')
        if not id_token:
            return "<h1>Ошибка</h1><p>id_token не получен.</p>", 500

        # Декодируем JWT
        payload = decode_jwt(id_token)
        if not payload:
            return "<h1>Ошибка</h1><p>Не удалось декодировать id_token.</p>", 500

        # Получаем email
        email = payload.get('email', 'Email не найден')

        # Создаём токен для пользователя
        token = create_or_update_user(email, plan='Free')

        # Возвращаем HTML с postMessage для расширения И устанавливаем cookie для браузера
        html_response = f"""
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <script>
            if (window.opener) {{
                // Это popup от расширения или auth.html - отправляем postMessage
                try {{
                    window.opener.postMessage({{
                        type: 'AUTH_SUCCESS',
                        token: '{token}',
                        email: '{email}'
                    }}, '*');
                    console.log('postMessage отправлен успешно');
                }} catch (e) {{
                    console.error('postMessage failed:', e);
                }}

                setTimeout(function() {{
                    window.close();
                }}, 1000);
            }} else {{
                // Это обычный браузер без расширения - показываем сообщение
                document.getElementById('message').textContent = 'Авторизация успешна! Вы можете закрыть это окно.';
            }}
        </script>
        </head>
        <body>
        <p id="message">Авторизация успешна! Перенаправление...</p>
        </body>
        </html>
        """

        return html_response

    except requests.exceptions.RequestException as e:
        print(f"Ошибка при обмене кода на токены: {e}")
        return f"<h1>Ошибка</h1><p>Не удалось обменять код на токены: {e}</p>", 500


@app.route('/auth')
def auth():
    """Страница авторизации для расширения"""
    return send_from_directory(EXTENSION_DIR, 'auth.html')


@app.route('/auth-site')
def auth_site():
    """OAuth авторизация для сайта (pricing) - редирект на Google OAuth"""
    oauth_url = (
        'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={GOOGLE_CLIENT_ID}'
        '&response_type=code'
        '&redirect_uri=https://api.beem.ink/auth-site/callback'
        '&scope=openid email profile'
        '&prompt=select_account'
    )
    return redirect(oauth_url)


@app.route('/auth-site/callback')
def auth_site_callback():
    """OAuth callback для сайта - устанавливает cookie и редирект на /pricing"""
    code = request.args.get('code')

    if not code:
        return "<h1>Ошибка</h1><p>Код авторизации не получен.</p>", 400

    # Обмениваем code на токены
    token_url = 'https://oauth2.googleapis.com/token'
    token_data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': 'https://api.beem.ink/auth-site/callback',
        'grant_type': 'authorization_code'
    }

    try:
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        tokens = response.json()

        id_token = tokens.get('id_token')
        if not id_token:
            return "<h1>Ошибка</h1><p>id_token не получен.</p>", 500

        # Декодируем JWT
        payload = decode_jwt(id_token)
        if not payload:
            return "<h1>Ошибка</h1><p>Не удалось декодировать id_token.</p>", 500

        # Получаем email
        email = payload.get('email', 'Email не найден')

        # Создаём или получаем токен для пользователя
        token = create_or_update_user(email, plan='Free')

        # HTML с postMessage для закрытия popup и обновления родительского окна
        html = """
        <!DOCTYPE html>
        <html>
        <head><title>Authorization Success</title></head>
        <body>
          <script>
            window.opener.postMessage({ type: 'SITE_AUTH_SUCCESS' }, '*');
            window.close();
          </script>
        </body>
        </html>
        """

        # Создаём response с HTML
        resp = make_response(html)

        # Устанавливаем cookie с токеном (на 30 дней)
        resp.set_cookie('auth_token', token, max_age=60*60*24*30, httponly=False, samesite='Lax')
        resp.set_cookie('auth_email', email, max_age=60*60*24*30, httponly=False, samesite='Lax')

        return resp

    except requests.exceptions.RequestException as e:
        print(f"Ошибка при обмене кода на токены: {e}")
        return f"<h1>Ошибка</h1><p>Не удалось обменять код на токены: {e}</p>", 500


@app.route('/auth-site/logout')
def auth_site_logout():
    """Logout для сайта - удаляет cookies и редирект на /pricing"""

    # Создаём response с редиректом на /pricing
    resp = make_response(redirect('/pricing'))

    # Удаляем cookies
    resp.set_cookie('auth_token', '', expires=0, path='/')
    resp.set_cookie('auth_email', '', expires=0, path='/')

    return resp


@app.route('/pricing')
def pricing():
    """Страница с тарифными планами (работает через cookies для сайта)"""
    return send_from_directory(WEB_DIR, 'pricing.html')


@app.route('/pricing.css')
def pricing_css():
    """CSS для страницы pricing"""
    return send_from_directory(WEB_DIR, 'pricing.css', mimetype='text/css')


@app.route('/pricing.js')
def pricing_js():
    """JS для страницы pricing"""
    return send_from_directory(WEB_DIR, 'pricing.js', mimetype='application/javascript')


@app.route('/auth.css')
def auth_css():
    """CSS для страницы авторизации"""
    return send_from_directory(EXTENSION_DIR, 'auth.css', mimetype='text/css')


@app.route('/auth.js')
def auth_js():
    """JS для страницы авторизации (открывает OAuth popup)"""
    return send_from_directory(EXTENSION_DIR, 'auth.js', mimetype='application/javascript')


@app.route('/styles.css')
def styles_css():
    """Общие стили для расширения"""
    return send_from_directory(EXTENSION_DIR, 'styles.css', mimetype='text/css')


@app.route('/background.js')
def background_js():
    """Service worker для Chrome расширения"""
    return send_from_directory(EXTENSION_DIR, 'background.js', mimetype='application/javascript')


@app.route('/content.js')
def content_js():
    """Content script для Chrome расширения"""
    return send_from_directory(EXTENSION_DIR, 'content.js', mimetype='application/javascript')


@app.route('/flags.js')
def flags_js():
    """Флаги для расширения"""
    return send_from_directory(EXTENSION_DIR, 'flags.js', mimetype='application/javascript')


@app.route('/manifest.json')
def manifest():
    """Манифест Chrome расширения"""
    return send_from_directory(EXTENSION_DIR, 'manifest.json', mimetype='application/json')


@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Обслуживание статических файлов (логотипы и т.д.)"""
    return send_from_directory(os.path.join(EXTENSION_DIR, 'assets'), filename)


@app.route('/switch-plan/<plan>', methods=['POST', 'OPTIONS'])
def switch_plan(plan):
    """Переключение тарифного плана (работает ТОЛЬКО через cookie для сайта)"""
    if request.method == 'OPTIONS':
        return '', 200

    # Проверяем валидность плана
    if plan not in ['Free', 'Pro', 'Premium']:
        return jsonify({"error": "invalid_plan"}), 400

    # Получаем токен из cookie
    token = request.cookies.get('auth_token')

    if not token:
        return jsonify({"error": "unauthorized"}), 401

    # Проверяем токен и обновляем план
    user = get_user_by_token(token)

    if not user:
        return jsonify({"error": "unauthorized"}), 401

    # Обновляем план в БД
    def _local():
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET plan = ? WHERE token = ?', (plan, token))
        conn.commit()
        conn.close()
    
    safe_db_execute(_local)

    return jsonify({
        "status": "ok",
        "plan": plan,
        "email": user['email']
    })


@app.route('/api/update-plan', methods=['POST', 'OPTIONS'])
def api_update_plan():
    """API для обновления тарифного плана пользователя"""

    if request.method == 'OPTIONS':
        return '', 200

    # Читаем Authorization header
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "unauthorized"}), 401

    # Извлекаем токен
    token = auth_header.split(' ')[1]

    # Проверяем токен в БД
    user = get_user_by_token(token)

    if not user:
        return jsonify({"error": "unauthorized"}), 401

    # Читаем новый план из body
    data = request.json
    new_plan = data.get('plan')

    if not new_plan or new_plan not in ['Free', 'Pro', 'Premium']:
        return jsonify({"error": "invalid_plan"}), 400

    # Обновляем план в БД
    success = update_user_plan(user['email'], new_plan)

    if success:
        return jsonify({
            "status": "ok",
            "email": user['email'],
            "plan": new_plan
        })
    else:
        return jsonify({"error": "update_failed"}), 500


@app.route('/api/feedback', methods=['POST', 'OPTIONS'])
def api_feedback():
    """API для приема обратной связи от пользователей"""
    if request.method == 'OPTIONS':
        return '', 200

    data = request.json
    email = data.get('email')
    message = data.get('message')
    plan = data.get('plan', 'Free')  # Получаем план из запроса, по умолчанию 'Free'

    if not email or not message:
        return jsonify({"error": "missing_fields"}), 400

    # Сохраняем feedback в базу данных
    try:
        def _local():
            conn = sqlite3.connect(USERS_DB)
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO feedback (email, message, plan)
                VALUES (?, ?, ?)
            ''', (email, message, plan))

            conn.commit()
            conn.close()

        safe_db_execute(_local)

        return jsonify({"status": "ok", "message": "Feedback received"})
    except Exception as e:
        print(f"Ошибка сохранения feedback: {e}")
        return jsonify({"error": "server_error"}), 500


@app.route('/checkout/pro')
def checkout_pro():
    """Страница оформления подписки Pro"""
    return send_from_directory(WEB_DIR, 'checkout_pro.html')


@app.route('/checkout/premium')
def checkout_premium():
    """Страница оформления подписки Premium"""
    return send_from_directory(WEB_DIR, 'checkout_premium.html')


# ═══════════════════════════════════════════════════════════════════
# YOOKASSA PAYMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.route('/create-payment/<plan>', methods=['POST', 'OPTIONS'])
def create_payment(plan):
    """Создание платежа через Yookassa"""
    if request.method == 'OPTIONS':
        return '', 200

    # Проверяем валидность плана
    if plan not in ['Pro', 'Premium']:
        return jsonify({"error": "invalid_plan"}), 400

    # Получаем токен из cookie
    token = request.cookies.get('auth_token')
    if not token:
        return jsonify({"error": "unauthorized"}), 401

    # Проверяем пользователя
    user = get_user_by_token(token)
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    # Проверяем конфигурацию Yookassa
    if not YOOKASSA_SHOP_ID or not YOOKASSA_API_KEY:
        return jsonify({"error": "payment_not_configured"}), 500

    try:
        # Получаем цену плана
        amount = PLAN_PRICES.get(plan)
        if not amount:
            return jsonify({"error": "invalid_plan"}), 400

        # Создаем уникальный idempotence key
        idempotence_key = str(uuid.uuid4())

        # Создаем платеж в Yookassa
        payment = Payment.create({
            "amount": {
                "value": str(amount),
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": f"{YOOKASSA_RETURN_URL_BASE}/payment-success?payment_id={{payment_id}}&email={user['email']}&plan={plan}"
            },
            "capture": True,
            "description": f"Подписка Video Reader AI - {plan}",
            "metadata": {
                "email": user['email'],
                "plan": plan,
                "token": token
            }
        }, idempotence_key)

        print(f"[PAYMENT] Создан платёж: ID={payment.id}, email={user['email']}, plan={plan}")

        # Возвращаем URL для редиректа
        return jsonify({
            "status": "ok",
            "payment_id": payment.id,
            "confirmation_url": payment.confirmation.confirmation_url
        })

    except Exception as e:
        print(f"Ошибка создания платежа: {e}")
        return jsonify({"error": "payment_creation_failed", "message": str(e)}), 500


@app.route('/payment-webhook', methods=['POST'])
def payment_webhook():
    """Webhook для обработки уведомлений от Yookassa"""
    try:
        # Получаем данные уведомления
        event_json = request.json

        # ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ для отладки
        print(f"\n{'='*60}")
        print(f"[WEBHOOK] Получено уведомление от Yookassa")
        print(f"[WEBHOOK] Полные данные: {json.dumps(event_json, indent=2, ensure_ascii=False)}")
        print(f"{'='*60}\n")

        # Проверяем тип события
        event_type = event_json.get('event')
        print(f"[WEBHOOK] Тип события: {event_type}")

        if event_type == 'payment.succeeded':
            payment_info = event_json.get('object')

            if not payment_info:
                print(f"[WEBHOOK] ❌ Отсутствует объект payment_info")
                return '', 200

            # Получаем метаданные платежа
            metadata = payment_info.get('metadata', {})
            email = metadata.get('email')
            plan = metadata.get('plan')

            print(f"[WEBHOOK] Email из metadata: {email}")
            print(f"[WEBHOOK] Plan из metadata: {plan}")

            if email and plan and plan in ['Pro', 'Premium']:
                def _local():
                    conn = sqlite3.connect(USERS_DB)
                    cursor = conn.cursor()

                    # Проверяем дублирующий payment_id
                    payment_id = payment_info.get('id', '')
                    cursor.execute(
                        'SELECT COUNT(*) FROM payments WHERE payment_id = ? LIMIT 1',
                        (payment_id,)
                    )
                    payment_exists = cursor.fetchone()[0] > 0

                    if payment_exists:
                        print(f"[WEBHOOK] ⚠️ Duplicate payment_id {payment_id}, skipping")
                        conn.close()
                        return

                    # Устанавливаем срок действия плана: +30 дней
                    plan_expires_at = int(time.time()) + (30 * 24 * 60 * 60)

                    # Проверяем, существует ли пользователь
                    cursor.execute('SELECT email, plan FROM users WHERE email = ?', (email,))
                    user_before = cursor.fetchone()
                    print(f"[WEBHOOK] Пользователь ДО обновления: {user_before}")

                    cursor.execute(
                        'UPDATE users SET plan = ?, plan_expires_at = ? WHERE email = ?',
                        (plan, plan_expires_at, email)
                    )
                    updated_rows = cursor.rowcount  # Сохраняем количество обновлённых строк

                    # Записываем платёж в историю payments
                    status = payment_info.get('status', 'succeeded')
                    raw_data = json.dumps(payment_info)

                    try:
                        cursor.execute('''
                            INSERT INTO payments (email, plan, payment_id, status, raw)
                            VALUES (?, ?, ?, ?, ?)
                        ''', (email, plan, payment_id, status, raw_data))

                        conn.commit()
                    except sqlite3.IntegrityError:
                        # Дубликат payment_id - пропускаем запись
                        print(f"[WEBHOOK] ⚠️ IntegrityError: Duplicate payment_id {payment_id}, skipping INSERT")
                        conn.rollback()

                    # Проверяем после обновления
                    cursor.execute('SELECT email, plan, plan_expires_at FROM users WHERE email = ?', (email,))
                    user_after = cursor.fetchone()
                    print(f"[WEBHOOK] Пользователь ПОСЛЕ обновления: {user_after}")
                    print(f"[WEBHOOK] Обновлено строк: {updated_rows}")

                    conn.close()

                    if updated_rows > 0:
                        print(f"[WEBHOOK] ✅ Платеж успешно обработан: {email} -> {plan}")
                    else:
                        print(f"[WEBHOOK] ⚠️ Пользователь не найден в БД: {email}")

                safe_db_execute(_local)
            else:
                print(f"[WEBHOOK] ⚠️ Недостаточно данных для обновления:")
                print(f"  - email: {email}")
                print(f"  - plan: {plan}")
                print(f"  - plan valid: {plan in ['Pro', 'Premium'] if plan else False}")

        return '', 200

    except Exception as e:
        print(f"[WEBHOOK] ❌ Ошибка обработки webhook: {e}")
        import traceback
        traceback.print_exc()
        return '', 200  # Возвращаем 200, чтобы Yookassa не повторял запрос


@app.route('/payment-success')
def payment_success():
    """Страница успешной оплаты - проверяем статус и обновляем план"""
    try:
        # Получаем параметры из URL
        payment_id = request.args.get('payment_id')
        email = request.args.get('email')
        plan = request.args.get('plan')

        print(f"\n[PAYMENT-SUCCESS] Пользователь вернулся с оплаты:")
        print(f"  payment_id: {payment_id}")
        print(f"  email: {email}")
        print(f"  plan: {plan}")

        # Если есть все параметры - проверяем статус платежа и обновляем план
        if payment_id and email and plan and YOOKASSA_SHOP_ID and YOOKASSA_API_KEY:
            try:
                # Получаем информацию о платеже от Yookassa
                payment_info = Payment.find_one(payment_id)
                payment_status = payment_info.status

                print(f"[PAYMENT-SUCCESS] Статус платежа: {payment_status}")

                if payment_status == 'succeeded':
                    # Платёж успешен - обновляем план в БД
                    def _local():
                        conn = sqlite3.connect(USERS_DB)
                        cursor = conn.cursor()

                        cursor.execute('SELECT email, plan FROM users WHERE email = ?', (email,))
                        user_before = cursor.fetchone()
                        print(f"[PAYMENT-SUCCESS] Пользователь ДО: {user_before}")

                        plan_expires_at = int(time.time()) + (30 * 24 * 60 * 60)
                        cursor.execute(
                            'UPDATE users SET plan = ?, plan_expires_at = ? WHERE email = ?',
                            (plan, plan_expires_at, email)
                        )
                        updated_rows = cursor.rowcount
                        conn.commit()

                        cursor.execute('SELECT email, plan, plan_expires_at FROM users WHERE email = ?', (email,))
                        user_after = cursor.fetchone()
                        print(f"[PAYMENT-SUCCESS] Пользователь ПОСЛЕ: {user_after}")
                        print(f"[PAYMENT-SUCCESS] ✅ План обновлён: {email} -> {plan}")

                        conn.close()

                    safe_db_execute(_local)

            except Exception as e:
                print(f"[PAYMENT-SUCCESS] ⚠️ Ошибка проверки статуса: {e}")
                # Продолжаем показывать success страницу даже при ошибке

    except Exception as e:
        print(f"[PAYMENT-SUCCESS] ❌ Ошибка обработки: {e}")

    # Показываем страницу успеха
    html = """
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Оплата успешна</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center p-6">
        <div class="bg-white border border-gray-200 rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 mb-4">Оплата успешна!</h1>
            <p class="text-gray-600 mb-8">Ваша подписка активирована. Спасибо за покупку!</p>
            <button
                onclick="window.location='https://api.beem.ink/pricing'"
                class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold text-white">
                Вернуться к тарифам
            </button>
        </div>
    </body>
    </html>
    """
    return html


@app.route('/payment-cancel')
def payment_cancel():
    """Страница отмены оплаты"""
    html = """
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Оплата отменена</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center p-6">
        <div class="bg-white border border-gray-200 rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 mb-4">Оплата отменена</h1>
            <p class="text-gray-600 mb-8">Вы можете вернуться к выбору тарифа</p>
            <button
                onclick="window.location='https://api.beem.ink/pricing'"
                class="w-full py-3 rounded-xl bg-gray-600 hover:bg-gray-700 transition font-semibold text-white">
                Вернуться к тарифам
            </button>
        </div>
    </body>
    </html>
    """
    return html


# ═══════════════════════════════════════════════════════════════════
# ADMIN PANEL ROUTES - только для nazarov.soft@gmail.com
# ═══════════════════════════════════════════════════════════════════

def check_admin_access():
    """Проверяет, имеет ли пользователь права администратора"""
    auth_token = request.cookies.get('auth_token')
    if not auth_token:
        return False, None

    user = get_user_by_token(auth_token)
    if not user or user.get('email') != ADMIN_EMAIL:
        return False, user

    return True, user


@app.route('/admin')
def admin_panel():
    """Главная страница админ-панели"""
    is_admin, user = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    return send_from_directory(ADMIN_DIR, 'admin.html')


@app.route('/admin/auth-check')
def admin_auth_check():
    """Проверка прав доступа к админке"""
    is_admin, user = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied", "isAdmin": False}), 403

    return jsonify({
        "isAdmin": True,
        "email": user.get('email'),
        "plan": user.get('plan')
    })


@app.route('/admin/users')
def admin_users():
    """Получение списка пользователей с пагинацией"""
    is_admin, _ = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    # Параметры пагинации
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    offset = (page - 1) * per_page

    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()

    # Получаем общее количество пользователей
    cursor.execute('SELECT COUNT(*) FROM users')
    total = cursor.fetchone()[0]

    # Получаем пользователей с пагинацией
    cursor.execute('''
        SELECT email, plan, created_at, plan_expires_at
        FROM users
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ''', (per_page, offset))

    users = []
    current_time = int(time.time())
    for row in cursor.fetchall():
        email, plan, created_at, plan_expires_at = row
        is_expired = (plan != 'Free' and plan_expires_at and current_time > plan_expires_at)
        users.append({
            'email': email,
            'plan': plan,
            'created_at': created_at,
            'plan_expires_at': plan_expires_at,
            'isExpired': is_expired
        })

    conn.close()

    return jsonify({
        'users': users,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


@app.route('/admin/payments')
def admin_payments():
    """Получение списка платежей с пагинацией"""
    is_admin, _ = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    # Параметры пагинации
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    offset = (page - 1) * per_page

    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()

    # Получаем общее количество платежей
    cursor.execute('SELECT COUNT(*) FROM payments')
    total = cursor.fetchone()[0]

    # Получаем платежи с пагинацией
    cursor.execute('''
        SELECT id, email, plan, payment_id, status, timestamp
        FROM payments
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
    ''', (per_page, offset))

    payments = []
    for row in cursor.fetchall():
        payments.append({
            'id': row[0],
            'email': row[1],
            'plan': row[2],
            'payment_id': row[3],
            'status': row[4],
            'timestamp': row[5]
        })

    conn.close()

    return jsonify({
        'payments': payments,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


@app.route('/admin/feedback')
def admin_feedback():
    """Получение списка обратной связи с пагинацией"""
    is_admin, _ = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    # Параметры пагинации
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    offset = (page - 1) * per_page

    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()

    # Получаем общее количество сообщений
    cursor.execute('SELECT COUNT(*) FROM feedback')
    total = cursor.fetchone()[0]

    # Получаем сообщения с пагинацией
    cursor.execute('''
        SELECT id, email, message, plan, timestamp
        FROM feedback
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
    ''', (per_page, offset))

    feedback = []
    for row in cursor.fetchall():
        feedback.append({
            'id': row[0],
            'email': row[1],
            'message': row[2],
            'plan': row[3],
            'timestamp': row[4]
        })

    conn.close()

    return jsonify({
        'feedback': feedback,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


@app.route('/admin/translations')
def admin_translations():
    """Получение кеша переводов по video_id"""
    is_admin, _ = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    video_id = request.args.get('video_id', '')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    offset = (page - 1) * per_page

    def _local():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        if video_id:
            # Фильтр по video_id
            cursor.execute('SELECT COUNT(*) FROM translations WHERE video_id = ?', (video_id,))
            total = cursor.fetchone()[0]

            cursor.execute('''
                SELECT id, video_id, line_number, original_text, translated_text, lang, timestamp
                FROM translations
                WHERE video_id = ?
                ORDER BY line_number
                LIMIT ? OFFSET ?
            ''', (video_id, per_page, offset))
        else:
            # Все переводы
            cursor.execute('SELECT COUNT(*) FROM translations')
            total = cursor.fetchone()[0]

            cursor.execute('''
                SELECT id, video_id, line_number, original_text, translated_text, lang, timestamp
                FROM translations
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            ''', (per_page, offset))

        translations = []
        for row in cursor.fetchall():
            translations.append({
                'id': row[0],
                'video_id': row[1],
                'line_number': row[2],
                'original_text': row[3],
                'translated_text': row[4],
                'lang': row[5],
                'timestamp': row[6]
            })

        conn.close()
        return translations, total

    translations, total = safe_db_execute(_local)

    return jsonify({
        'translations': translations,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


@app.route('/admin/update-plan', methods=['POST'])
def admin_update_plan():
    """Обновление плана пользователя (только для админа)"""
    is_admin, _ = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    data = request.json
    email = data.get('email')
    new_plan = data.get('plan')

    if not email or not new_plan:
        return jsonify({"error": "missing_fields"}), 400

    if new_plan not in ['Free', 'Pro', 'Premium']:
        return jsonify({"error": "invalid_plan"}), 400

    # Обновляем план
    success = update_user_plan(email, new_plan)

    if success:
        return jsonify({"success": True, "email": email, "plan": new_plan})
    else:
        return jsonify({"error": "update_failed"}), 500


@app.route('/admin/<path:filename>')
def admin_static(filename):
    """Отдача статических файлов админки (JS, CSS)"""
    is_admin, _ = check_admin_access()

    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    return send_from_directory(ADMIN_DIR, filename)

@app.route('/admin/translations/delete', methods=['POST'])
def admin_delete_translation():
    is_admin, _ = check_admin_access()
    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    data = request.json
    row_id = data.get("id")

    if not row_id:
        return jsonify({"error": "missing_id"}), 400

    def _local():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM translations WHERE id = ?", (row_id,))
        conn.commit()
        conn.close()

    safe_db_execute(_local)
    return jsonify({"status": "ok"})

@app.route('/admin/translations/clear', methods=['POST'])
def admin_clear_translations():
    is_admin, _ = check_admin_access()
    if not is_admin:
        return jsonify({"error": "access_denied"}), 403

    data = request.json or {}
    video_id = data.get("video_id")

    def _local():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        if video_id:
            cursor.execute("DELETE FROM translations WHERE video_id = ?", (video_id,))
        else:
            cursor.execute("DELETE FROM translations")

        conn.commit()
        conn.close()

    safe_db_execute(_local)
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
