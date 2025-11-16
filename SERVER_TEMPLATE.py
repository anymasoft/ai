"""
YouTube Subtitle Translation Server - Line-by-Line Architecture
Сервер для построчного перевода субтитров YouTube с использованием GPT-4o-mini
"""

from flask import Flask, request, jsonify, send_from_directory, session, redirect
from flask_cors import CORS
import sqlite3
import json
import os
import base64
import requests
from openai import OpenAI
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # Загрузка переменных окружения из .env

app = Flask(__name__)
# CORS: разрешаем все origins для расширения, credentials только для localhost
CORS(app,
     supports_credentials=True,
     origins=["http://localhost:5000"],
     resources={
         r"/translate-line": {"origins": "*", "supports_credentials": False},
         r"/health": {"origins": "*", "supports_credentials": False},
         r"/stats": {"origins": "*", "supports_credentials": False},
         r"/clear-cache": {"origins": "*", "supports_credentials": False}
     })
app.secret_key = os.getenv("APP_SECRET_KEY", "TEMP_SESSION_KEY")

# Конфигурация
DATABASE = 'translations.db'
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-api-key-here')
client = OpenAI(api_key=OPENAI_API_KEY)

# OAuth конфигурация (временные заглушки)
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

# Инициализация БД
def init_db():
    """Создает таблицу для хранения переводов построчно"""
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
    print("База данных инициализирована (line-by-line schema)")

# Проверка кеша для одной строки
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

# Сохранение одной строки в кеш
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
        context_text = '\n'.join([f"[prev] {line}" for line in prev_context[-2:]])  # Последние 1-2 строки
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
    • Proper names: preserve the original spelling (e.g. “John” → “Джон” if Russian target)
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
            max_tokens=200  # Для одной строки достаточно
        )

        translated_text = response.choices[0].message.content.strip()

        # Убираем возможные артефакты вроде "[current]" если GPT их вернул
        translated_text = translated_text.replace('[current]', '').strip()

        return translated_text

    except Exception as e:
        print(f"Ошибка при переводе через GPT: {e}")
        return None

@app.route('/translate-line', methods=['POST'])
def translate_line():
    """Endpoint для перевода одной строки субтитров"""

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

@app.route('/clear-cache', methods=['POST'])
def clear_cache():
    """Очистка кеша для конкретного видео"""
    data = request.json
    video_id = data.get('videoId')

    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('DELETE FROM translations WHERE video_id = ?', (video_id,))
    deleted = cursor.rowcount

    conn.commit()
    conn.close()

    return jsonify({
        'videoId'     : video_id,
        'deletedLines': deleted
    })

@app.route('/auth')
def auth_page():
    """Страница авторизации"""
    return send_from_directory('extension', 'auth.html')

@app.route('/auth.css')
def auth_css():
    """CSS для страницы авторизации"""
    return send_from_directory('extension', 'auth.css')

@app.route('/logo.png')
def auth_logo():
    """Логотип для страницы авторизации"""
    return send_from_directory('extension/assets', 'logo.png')

@app.route('/auth.js')
def auth_js():
    """JavaScript для страницы авторизации"""
    return send_from_directory('extension', 'auth.js')

@app.route('/auth/callback')
def oauth_callback():
    """OAuth callback - обработка кода от Google"""
    # Получаем code из query параметров
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
        # POST запрос к Google OAuth API
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        tokens = response.json()

        # Получаем id_token
        id_token = tokens.get('id_token')
        if not id_token:
            return "<h1>Ошибка</h1><p>id_token не получен.</p>", 500

        # Декодируем JWT
        payload = decode_jwt(id_token)
        if not payload:
            return "<h1>Ошибка</h1><p>Не удалось декодировать id_token.</p>", 500

        # Получаем email
        email = payload.get('email', 'Email не найден')

        # Сохраняем email в session
        session["email"] = email

        # Возвращаем HTML с автоматическим закрытием popup и редиректом
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <script>
            // После успешной авторизации:
            // 1) перенаправляем родительское окно на страницу тарифов
            // 2) закрываем popup
            if (window.opener) {
                window.opener.location = "/pricing";
            }
            window.close();
        </script>
        </head>
        <body>
        </body>
        </html>
        """

    except requests.exceptions.RequestException as e:
        print(f"Ошибка при обмене кода на токены: {e}")
        return f"<h1>Ошибка</h1><p>Не удалось обменять код на токены: {e}</p>", 500

@app.route('/pricing')
def pricing():
    """Страница тарифов"""
    # Проверяем, есть ли email в session
    email = session.get('email')

    if not email:
        return redirect("/auth")

    return send_from_directory('extension', 'pricing.html')

@app.route('/pricing.css')
def pricing_css():
    """CSS для страницы тарифов"""
    return send_from_directory('extension', 'pricing.css')

@app.route('/checkout/pro')
def checkout_pro():
    """Страница оформления тарифа Pro"""
    # Проверяем авторизацию
    if not session.get("email"):
        return redirect("/auth")

    # Устанавливаем тариф Pro
    session["plan"] = "Pro"

    return send_from_directory('extension', 'checkout_pro.html')

@app.route('/checkout/premium')
def checkout_premium():
    """Страница оформления тарифа Premium"""
    # Проверяем авторизацию
    if not session.get("email"):
        return redirect("/auth")

    # Устанавливаем тариф Premium
    session["plan"] = "Premium"

    return send_from_directory('extension', 'checkout_premium.html')

@app.route('/switch-plan/<plan>')
def switch_plan(plan):
    """Переключение тарифного плана"""
    # Допустимые планы
    valid_plans = ["free", "pro", "premium"]

    # Приводим к нижнему регистру для проверки
    plan_lower = plan.lower()

    # Если план неверный → 400
    if plan_lower not in valid_plans:
        return "Unknown plan", 400

    # Проверяем авторизацию
    if not session.get("email"):
        return redirect("/auth")

    # Устанавливаем план с заглавной буквы
    session["plan"] = plan_lower.capitalize()

    return redirect("/pricing")

@app.route('/api/user')
def api_user():
    """API для получения информации о текущем пользователе"""
    email = session.get("email")
    if not email:
        return jsonify({"email": None})
    return jsonify({"email": email})

@app.route('/api/subscription')
def api_subscription():
    """API для получения информации о подписке пользователя"""
    email = session.get("email")
    if not email:
        return jsonify({"error": "unauthorized"}), 401

    # Получаем план из session, по умолчанию "Free"
    plan = session.get("plan", "Free")
    session["plan"] = plan  # гарантируем, что он всегда есть

    return jsonify({
        "email": email,
        "plan": plan
    })

@app.route('/logout')
def logout():
    """Выход из системы"""
    # Очистить email и любые связанные данные из session
    session.pop("email", None)
    session.pop("plan", None)
    # После выхода перенаправляем пользователя на /auth
    return redirect("/auth")

if __name__ == '__main__':
    # Инициализируем БД при запуске
    init_db()

    print("=" * 60)
    print("YouTube Subtitle Translation Server (Line-by-Line)")
    print("=" * 60)
    print("Сервер запущен на http://localhost:5000")
    print("Endpoints:")
    print("  POST /translate-line - перевод одной строки субтитров")
    print("  GET  /health         - проверка работоспособности")
    print("  GET  /stats          - статистика кеша")
    print("  POST /clear-cache    - очистка кеша для видео")
    print("=" * 60)

    # Запускаем сервер
    app.run(debug=True, host='0.0.0.0', port=5000)
