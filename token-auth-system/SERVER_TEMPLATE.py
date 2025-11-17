"""
YouTube Subtitle Translation Server - Token Authentication Model
Сервер для построчного перевода субтитров YouTube с использованием токен-авторизации
"""

from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
import sqlite3
import json
import os
import base64
import requests
import uuid
from openai import OpenAI
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # Загрузка переменных окружения из .env

app = Flask(__name__)

# Директория, где находится этот файл (token-auth-system/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Директория с файлами расширения (extension/ внутри token-auth-system/)
EXTENSION_DIR = os.path.join(BASE_DIR, 'extension')

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
            "origins": "*",  # Разрешаем все origins для API (включая localhost)
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,  # Не используем credentials
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

# OAuth конфигурация
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', 'TEMP_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', 'TEMP_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = 'http://localhost:5000/auth/callback'

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
    # Таблица переводов
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

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

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            plan TEXT NOT NULL DEFAULT 'Free',
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_token
        ON users(token)
    ''')

    conn.commit()
    conn.close()

    print("База данных инициализирована (translations.db + users.db)")

# ═══════════════════════════════════════════════════════════════════
# TOKEN AUTHENTICATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def create_or_update_user(email, plan='Free'):
    """Создает или обновляет пользователя и генерирует новый токен"""
    token = uuid.uuid4().hex

    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO users (email, token, plan)
        VALUES (?, ?, ?)
    ''', (email, token, plan))

    conn.commit()
    conn.close()

    print(f"[TOKEN AUTH] Создан/обновлен пользователь {email}, токен: {token[:8]}...")
    return token

def get_user_by_token(token):
    """Получает данные пользователя по токену"""
    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT email, plan
        FROM users
        WHERE token = ?
    ''', (token,))

    result = cursor.fetchone()
    conn.close()

    if result:
        return {'email': result[0], 'plan': result[1]}
    return None

def update_user_plan(email, plan):
    """Обновляет тариф пользователя"""
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

    if affected > 0:
        print(f"[TOKEN AUTH] Обновлён план для {email}: {plan}")
    return affected > 0

# ═══════════════════════════════════════════════════════════════════
# TRANSLATION CACHE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def check_line_cache(video_id, line_number, lang='ru'):
    """Проверяет наличие перевода строки в кеше"""
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

def save_line_to_cache(video_id, line_number, original_text, translated_text, lang='ru'):
    """Сохраняет перевод одной строки в кеш"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO translations
        (video_id, line_number, original_text, translated_text, lang)
        VALUES (?, ?, ?, ?, ?)
    ''', (video_id, line_number, original_text, translated_text, lang))

    conn.commit()
    conn.close()

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
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_to_translate}
            ],
            temperature=0.3,
            max_tokens=200
        )

        translated_text = response.choices[0].message.content.strip()
        translated_text = translated_text.replace('[current]', '').strip()

        return translated_text

    except Exception as e:
        print(f"Ошибка при переводе через GPT: {e}")
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

    if video_id is None or line_number is None or not text:
        return jsonify({'error': 'Missing videoId, lineNumber or text'}), 400

    # Проверяем кеш
    cached_translation = check_line_cache(video_id, line_number, lang)

    if cached_translation:
        print(f"[Cache HIT] Video {video_id}, line {line_number}")
        return jsonify({
            'videoId'   : video_id,
            'lineNumber': line_number,
            'text'      : cached_translation,
            'cached'    : True
        })

    # Переводим через GPT
    print(f"[Translating] Video {video_id}, line {line_number}")
    translated_text = translate_line_with_gpt(text, prev_context, lang)

    if not translated_text:
        return jsonify({'error': 'Translation failed'}), 500

    # Сохраняем в кеш
    save_line_to_cache(video_id, line_number, text, translated_text, lang)

    return jsonify({
        'videoId'   : video_id,
        'lineNumber': line_number,
        'text'      : translated_text,
        'cached'    : False
    })

@app.route('/api/plan', methods=['GET', 'OPTIONS'])
def api_plan():
    """API для получения тарифного плана по токену"""

    if request.method == 'OPTIONS':
        return '', 200

    # Читаем Authorization header
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        print("[API /api/plan] Отсутствует или неверный Authorization header")
        return jsonify({"error": "unauthorized"}), 401

    # Извлекаем токен
    token = auth_header.split(' ')[1]
    print(f"[API /api/plan] Получен токен: {token[:8]}...")

    # Проверяем токен в БД
    user = get_user_by_token(token)

    if not user:
        print(f"[API /api/plan] Токен не найден в БД")
        return jsonify({"error": "unauthorized"}), 401

    print(f"[API /api/plan] Токен валиден: {user['email']}, план: {user['plan']}")
    return jsonify({
        "status": "ok",
        "email" : user['email'],
        "plan"  : user['plan']
    })

@app.route('/api/user', methods=['GET', 'OPTIONS'])
def api_user():
    """API для получения информации о пользователе (для совместимости с pricing.html)"""

    if request.method == 'OPTIONS':
        return '', 200

    # Пытаемся получить токен из cookie или localStorage (через query параметр)
    token = request.cookies.get('auth_token') or request.args.get('token')

    if not token:
        print("[API /api/user] Токен не найден")
        return jsonify({"error": "unauthorized"}), 401

    user = get_user_by_token(token)

    if not user:
        print(f"[API /api/user] Токен не валиден")
        return jsonify({"error": "unauthorized"}), 401

    return jsonify({
        "email": user['email'],
        "plan": user['plan']
    })

@app.route('/api/subscription', methods=['GET', 'OPTIONS'])
def api_subscription():
    """API для получения информации о подписке (для совместимости с pricing.html)"""

    if request.method == 'OPTIONS':
        return '', 200

    # Пытаемся получить токен из cookie или localStorage (через query параметр)
    token = request.cookies.get('auth_token') or request.args.get('token')

    if not token:
        print("[API /api/subscription] Токен не найден")
        return jsonify({"error": "unauthorized"}), 401

    user = get_user_by_token(token)

    if not user:
        print(f"[API /api/subscription] Токен не валиден")
        return jsonify({"error": "unauthorized"}), 401

    return jsonify({
        "plan": user['plan'],
        "email": user['email']
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/stats', methods=['GET'])
def stats():
    """Статистика по кешу"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM translations')
    total = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(DISTINCT video_id) FROM translations')
    unique_videos = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        'total_lines'  : total,
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
        'code'         : code,
        'client_id'    : GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri' : GOOGLE_REDIRECT_URI,
        'grant_type'   : 'authorization_code'
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

        # Если это popup (есть window.opener) - используем postMessage для расширения
        # Если это обычное окно - устанавливаем cookie и редиректим на /pricing
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <script>
            if (window.opener) {{
                // Для Chrome расширения - используем postMessage
                try {{
                    window.opener.postMessage({{
                        type: 'AUTH_SUCCESS',
                        token: '{token}',
                        email: '{email}'
                    }}, '*');
                }} catch (e) {{
                    console.error('postMessage failed:', e);
                }}

                setTimeout(function() {{
                    window.close();
                }}, 1000);
            }} else {{
                // Для обычного браузера - устанавливаем cookie и редиректим
                document.cookie = 'auth_token={token}; path=/; max-age=2592000';
                document.cookie = 'auth_email={email}; path=/; max-age=2592000';

                setTimeout(function() {{
                    window.location.href = '/pricing';
                }}, 500);
            }}
        </script>
        </head>
        <body>
        <p>Авторизация успешна! Перенаправление на /pricing...</p>
        <p style="color: #666; font-size: 12px;">Email: {email}</p>
        </body>
        </html>
        """


    except requests.exceptions.RequestException as e:
        print(f"Ошибка при обмене кода на токены: {e}")
        return f"<h1>Ошибка</h1><p>Не удалось обменять код на токены: {e}</p>", 500

@app.route('/pricing')
def pricing():
    """Страница с тарифными планами"""
    print(f"[PRICING] Запрос на /pricing")
    print(f"[PRICING] EXTENSION_DIR = {EXTENSION_DIR}")
    print(f"[PRICING] Проверка файла: {os.path.exists(os.path.join(EXTENSION_DIR, 'pricing.html'))}")
    return send_from_directory(EXTENSION_DIR, 'pricing.html')

@app.route('/pricing.css')
def pricing_css():
    """CSS для страницы pricing"""
    return send_from_directory(EXTENSION_DIR, 'pricing.css', mimetype='text/css')

@app.route('/styles.css')
def styles_css():
    """CSS для расширения"""
    return send_from_directory(EXTENSION_DIR, 'styles.css', mimetype='text/css')

@app.route('/api/update-plan', methods=['POST', 'OPTIONS'])
def api_update_plan():
    """API для обновления тарифного плана пользователя"""

    if request.method == 'OPTIONS':
        return '', 200

    # Читаем Authorization header
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        print("[API /api/update-plan] Отсутствует или неверный Authorization header")
        return jsonify({"error": "unauthorized"}), 401

    # Извлекаем токен
    token = auth_header.split(' ')[1]
    print(f"[API /api/update-plan] Получен токен: {token[:8]}...")

    # Проверяем токен в БД
    user = get_user_by_token(token)

    if not user:
        print(f"[API /api/update-plan] Токен не найден в БД")
        return jsonify({"error": "unauthorized"}), 401

    # Читаем новый план из body
    data = request.json
    new_plan = data.get('plan')

    if not new_plan or new_plan not in ['Free', 'Pro', 'Premium']:
        print(f"[API /api/update-plan] Неверный план: {new_plan}")
        return jsonify({"error": "invalid_plan"}), 400

    # Обновляем план в БД
    success = update_user_plan(user['email'], new_plan)

    if success:
        print(f"[API /api/update-plan] ✅ План обновлен: {user['email']} -> {new_plan}")
        return jsonify({
            "status": "ok",
            "email": user['email'],
            "plan": new_plan
        })
    else:
        print(f"[API /api/update-plan] ❌ Ошибка обновления плана")
        return jsonify({"error": "update_failed"}), 500

@app.route('/checkout/pro')
def checkout_pro():
    """Страница оформления подписки Pro"""
    return send_from_directory(EXTENSION_DIR, 'checkout_pro.html')

@app.route('/checkout/premium')
def checkout_premium():
    """Страница оформления подписки Premium"""
    return send_from_directory(EXTENSION_DIR, 'checkout_premium.html')

@app.route('/auth')
def auth_page():
    """Страница авторизации"""
    return send_from_directory(EXTENSION_DIR, 'auth.html')

@app.route('/auth.css')
def auth_css():
    """CSS для страницы авторизации"""
    return send_from_directory(EXTENSION_DIR, 'auth.css', mimetype='text/css')

@app.route('/auth.js')
def auth_js():
    """JS для страницы авторизации (упрощенная версия для браузера)"""
    # Для браузера не нужен chrome.runtime.sendMessage - OAuth callback сам устанавливает cookie
    return """
// Google OAuth popup handler для браузера
console.log('[auth.js] Browser version loaded');

document.addEventListener('DOMContentLoaded', function() {
  const googleSignInBtn = document.getElementById('googleSignInBtn');

  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', function() {
      const CLIENT_ID = '431567664470-mq0oim46t6tstlfjllbesuar346pf2qu.apps.googleusercontent.com';
      const REDIRECT_URI = 'http://localhost:5000/auth/callback';
      const SCOPE = 'openid email profile';

      const oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
        '?client_id=' + encodeURIComponent(CLIENT_ID) +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
        '&scope=' + encodeURIComponent(SCOPE) +
        '&prompt=select_account';

      console.log('[auth.js] Redirecting to Google OAuth...');
      // Для браузера делаем обычный редирект (не popup)
      window.location.href = oauthUrl;
    });
  }
});
""", 200, {'Content-Type': 'application/javascript'}

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Статические файлы из assets/"""
    return send_from_directory(os.path.join(EXTENSION_DIR, 'assets'), filename)

@app.route('/logout')
def logout():
    """Выход из системы - очистка cookies и редирект на /auth"""
    response = redirect('/auth')
    response.set_cookie('auth_token', '', expires=0)
    response.set_cookie('auth_email', '', expires=0)
    return response

if __name__ == '__main__':
    # Инициализируем БД при запуске
    init_db()

    print("=" * 60)
    print("YouTube Subtitle Translation Server (Token Auth)")
    print("=" * 60)
    print("Сервер запущен на http://localhost:5000")
    print(f"Статические файлы: {EXTENSION_DIR}")
    print(f"База данных: {USERS_DB}")
    print()
    print("Endpoints:")
    print("  POST /translate-line      - перевод одной строки субтитров")
    print("  GET  /api/plan            - получение плана по Bearer токену")
    print("  POST /api/update-plan     - обновление плана пользователя")
    print("  GET  /health              - проверка работоспособности")
    print("  GET  /stats               - статистика кеша")
    print()
    print("OAuth:")
    print("  GET  /auth                - страница авторизации")
    print("  GET  /auth/callback       - OAuth callback (генерация токена)")
    print()
    print("Pricing:")
    print("  GET  /pricing             - страница тарифных планов")
    print("  GET  /checkout/pro        - страница оформления Pro подписки")
    print("  GET  /checkout/premium    - страница оформления Premium подписки")
    print()
    print("Статика:")
    print("  GET  /auth.css, /auth.js")
    print("  GET  /pricing.css, /styles.css")
    print("=" * 60)

    # Запускаем сервер
    app.run(debug=True, host='0.0.0.0', port=5000)
