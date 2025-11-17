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
            "origins": ["https://www.youtube.com", "https://youtube.com", "chrome-extension://*"],
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
DATABASE = 'translations.db'
USERS_DB = 'users.db'
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

        # Возвращаем HTML с postMessage для расширения
        # ВАЖНО: отправляем и token, и email в расширение
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <script>
            console.log('[OAuth Callback] Страница загружена');
            console.log('[OAuth Callback] Token:', '{token[:8]}...');
            console.log('[OAuth Callback] Email:', '{email}');

            // Отправляем токен и email в расширение через postMessage
            if (window.opener) {{
                try {{
                    const message = {{
                        type: 'AUTH_SUCCESS',
                        token: '{token}',
                        email: '{email}'
                    }};

                    console.log('[OAuth Callback] Отправляем postMessage в window.opener:', message);
                    window.opener.postMessage(message, '*');
                    console.log('[OAuth Callback] postMessage отправлен успешно');
                }} catch(e) {{
                    console.error('[OAuth Callback] Ошибка postMessage:', e);
                }}

                // Закрываем popup через 2 секунды (даем время на обработку)
                setTimeout(function() {{
                    console.log('[OAuth Callback] Закрываем окно...');
                    window.close();
                }}, 2000);
            }} else {{
                // Если не popup - показываем сообщение
                console.log('[OAuth Callback] window.opener не найден - не popup окно');
                document.body.innerHTML = '<h2>Авторизация успешна!</h2><p>Email: {email}</p><p>Токен: {token[:8]}...</p><p>Вы можете закрыть это окно.</p>';
            }}
        </script>
        </head>
        <body>
        <p>Авторизация успешна! Окно закроется автоматически...</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Email: {email}</p>
        </body>
        </html>
        """

    except requests.exceptions.RequestException as e:
        print(f"Ошибка при обмене кода на токены: {e}")
        return f"<h1>Ошибка</h1><p>Не удалось обменять код на токены: {e}</p>", 500

@app.route('/pricing')
def pricing():
    """Страница с тарифными планами"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Video Reader AI - Pricing</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f5f5f5;
        }
        h1 {
            text-align: center;
            color: #1f1f1f;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #6b6b6b;
            margin-bottom: 40px;
        }
        .plans-container {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .plan-card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            width: 300px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        .plan-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .plan-card.featured {
            border: 2px solid #3b82f6;
            transform: scale(1.05);
        }
        .plan-name {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #1f1f1f;
        }
        .plan-price {
            font-size: 36px;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 20px;
        }
        .plan-price span {
            font-size: 16px;
            color: #6b6b6b;
            font-weight: 400;
        }
        .plan-features {
            list-style: none;
            padding: 0;
            margin: 20px 0;
        }
        .plan-features li {
            padding: 8px 0;
            color: #1f1f1f;
        }
        .plan-features li:before {
            content: "✓ ";
            color: #3b82f6;
            font-weight: bold;
            margin-right: 8px;
        }
        .plan-button {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        .plan-button.primary {
            background: #3b82f6;
            color: white;
        }
        .plan-button.primary:hover {
            background: #2563eb;
        }
        .plan-button.secondary {
            background: #e5e7eb;
            color: #1f1f1f;
        }
        .plan-button.secondary:hover {
            background: #d1d5db;
        }
        .back-link {
            text-align: center;
            margin-top: 40px;
        }
        .back-link a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
    </head>
    <body>
        <h1>🎬 Video Reader AI - Pricing</h1>
        <p class="subtitle">Choose the plan that's right for you</p>

        <div class="plans-container">
            <div class="plan-card">
                <div class="plan-name">Free</div>
                <div class="plan-price">$0<span>/month</span></div>
                <ul class="plan-features">
                    <li>10 videos per month</li>
                    <li>Basic translations</li>
                    <li>SRT export</li>
                </ul>
                <button class="plan-button secondary">Current Plan</button>
            </div>

            <div class="plan-card featured">
                <div class="plan-name">Pro</div>
                <div class="plan-price">$9<span>/month</span></div>
                <ul class="plan-features">
                    <li>100 videos per month</li>
                    <li>Advanced translations</li>
                    <li>All export formats</li>
                    <li>Priority support</li>
                </ul>
                <button class="plan-button primary">Upgrade to Pro</button>
            </div>

            <div class="plan-card">
                <div class="plan-name">Premium</div>
                <div class="plan-price">$29<span>/month</span></div>
                <ul class="plan-features">
                    <li>Unlimited videos</li>
                    <li>AI-powered translations</li>
                    <li>All export formats</li>
                    <li>Priority support</li>
                    <li>API access</li>
                </ul>
                <button class="plan-button primary">Upgrade to Premium</button>
            </div>
        </div>

        <div class="back-link">
            <a href="javascript:window.close()">← Close this window</a>
        </div>
    </body>
    </html>
    """

if __name__ == '__main__':
    # Инициализируем БД при запуске
    init_db()

    print("=" * 60)
    print("YouTube Subtitle Translation Server (Token Auth)")
    print("=" * 60)
    print("Сервер запущен на http://localhost:5000")
    print("Endpoints:")
    print("  POST /translate-line   - перевод одной строки субтитров")
    print("  GET  /api/plan         - получение плана по Bearer токену")
    print("  GET  /health           - проверка работоспособности")
    print("  GET  /stats            - статистика кеша")
    print("  GET  /auth/callback    - OAuth callback (генерация токена)")
    print("  GET  /pricing          - страница тарифных планов")
    print("=" * 60)

    # Запускаем сервер
    app.run(debug=True, host='0.0.0.0', port=5000)
