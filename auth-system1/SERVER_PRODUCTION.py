"""
YouTube Subtitle Translation Server - PRODUCTION VERSION WITH LIMITS
⚠️ ИСПОЛЬЗУЙ ЭТОТ ФАЙЛ ДЛЯ ЗАПУСКА СЕРВЕРА
"""

from flask import Flask, request, jsonify, send_from_directory, redirect, make_response
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

load_dotenv()

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXTENSION_DIR = os.path.join(BASE_DIR, 'extension')

CORS(
    app,
    resources={
        r"/translate-line": {
            "origins": ["https://www.youtube.com", "https://youtube.com"],
            "methods": ["POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "max_age": 3600
        },
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,
            "max_age": 3600
        },
        r"/health": {"origins": "*", "methods": ["GET"]},
        r"/stats": {"origins": "*", "methods": ["GET"]}
    }
)

DATABASE = os.path.join(BASE_DIR, 'translations.db')
USERS_DB = os.path.join(BASE_DIR, 'users.db')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-api-key-here')
client = OpenAI(api_key=OPENAI_API_KEY)

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', 'TEMP_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', 'TEMP_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = 'http://localhost:5000/auth/callback'

def decode_jwt(jwt_token):
    try:
        header, payload, signature = jwt_token.split(".")
        padded = payload + "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(padded)
        return json.loads(decoded)
    except Exception as e:
        print(f"Ошибка декодирования JWT: {e}")
        return None

def init_db():
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

def create_or_update_user(email, plan='Free'):
    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()
    cursor.execute('SELECT token, plan FROM users WHERE email = ?', (email,))
    existing_user = cursor.fetchone()

    if existing_user:
        existing_token = existing_user[0]
        existing_plan = existing_user[1]
        conn.close()
        return existing_token
    else:
        token = uuid.uuid4().hex
        cursor.execute('INSERT INTO users (email, token, plan) VALUES (?, ?, ?)', (email, token, plan))
        conn.commit()
        conn.close()
        return token

def get_user_by_token(token):
    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()
    cursor.execute('SELECT email, plan FROM users WHERE token = ?', (token,))
    result = cursor.fetchone()
    conn.close()
    if result:
        return {'email': result[0], 'plan': result[1]}
    return None

def update_user_plan(email, plan):
    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET plan = ? WHERE email = ?', (plan, email))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

def check_line_cache(video_id, line_number, lang='ru'):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT translated_text FROM translations WHERE video_id = ? AND line_number = ? AND lang = ?',
                   (video_id, line_number, lang))
    result = cursor.fetchone()
    conn.close()
    if result:
        return result[0]
    return None

def save_line_to_cache(video_id, line_number, original_text, translated_text, lang='ru'):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO translations (video_id, line_number, original_text, translated_text, lang) VALUES (?, ?, ?, ?, ?)',
                   (video_id, line_number, original_text, translated_text, lang))
    conn.commit()
    conn.close()

LANGUAGE_NAMES = {
    'ru': 'Russian', 'en': 'English', 'es': 'Spanish', 'de': 'German',
    'fr': 'French', 'ja': 'Japanese', 'zh': 'Chinese', 'it': 'Italian', 'pt': 'Portuguese'
}

def translate_line_with_gpt(text, prev_context=None, lang='ru'):
    target_language = LANGUAGE_NAMES.get(lang, 'Russian')

    if prev_context and len(prev_context) > 0:
        context_text = '\n'.join([f"[prev] {line}" for line in prev_context[-2:]])
        text_to_translate = f"{context_text}\n[current] {text}"
    else:
        text_to_translate = f"[current] {text}"

    system_prompt = f"""You are a professional subtitle translator for YouTube videos.
Your task is to translate from English into {target_language}.

MAIN TASK:
Translate ONLY the [current] line using the [prev] lines as context for accuracy.

CORE RULES:
✔ NATURAL SPEECH — The translation must sound like fluent, natural {target_language}, not a literal dictionary-style translation.
✔ FIX RECOGNITION ERRORS — Correct obvious speech-to-text errors found in [current].
✔ USE CONTEXT — Analyze [prev] to understand the continuation of the idea.

OUTPUT FORMAT:
Return ONLY the clean translated text of the [current] line.
No quotes, no brackets (except sound effects), no metadata, no formatting."""

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
# ГЛАВНЫЙ ENDPOINT - /translate-line С ЛИМИТАМИ FREE
# ═══════════════════════════════════════════════════════════════════

@app.route('/translate-line', methods=['POST', 'OPTIONS'])
def translate_line():
    """Endpoint для перевода одной строки субтитров с лимитами для Free"""

    if request.method == 'OPTIONS':
        return '', 200

    data = request.json
    video_id = data.get('videoId')
    line_number = data.get('lineNumber')
    text = data.get('text')
    prev_context = data.get('prevContext', [])
    lang = data.get('lang', 'ru')
    total_lines = data.get('totalLines', 0)

    if video_id is None or line_number is None or not text:
        return jsonify({'error': 'Missing videoId, lineNumber or text'}), 400

    # ОПРЕДЕЛЯЕМ ПЛАН ПОЛЬЗОВАТЕЛЯ
    user_plan = 'Free'
    user_email = None

    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = get_user_by_token(token)
        if user:
            user_plan = user['plan']
            user_email = user['email']

    # ВЫЧИСЛЯЕМ ЛИМИТ ДЛЯ FREE (30% СТРОК)
    max_free_line = -1
    if total_lines > 0:
        max_free_line = int(total_lines * 0.3) - 1

    # ПРОВЕРЯЕМ ЛИМИТ ДЛЯ FREE
    if user_plan == 'Free' and total_lines > 0 and line_number > max_free_line:
        return jsonify({
            'videoId': video_id,
            'lineNumber': line_number,
            'text': '',
            'cached': False,
            'limited': True,
            'export_allowed': False,
            'plan': user_plan,
            'stop': True
        })

    # ПЕРЕВОДИМ СТРОКУ (ПОЛНОСТЬЮ, БЕЗ ОБРЕЗКИ)
    cached_translation = check_line_cache(video_id, line_number, lang)

    if cached_translation:
        return jsonify({
            'videoId': video_id,
            'lineNumber': line_number,
            'text': cached_translation,
            'cached': True,
            'limited': user_plan == 'Free',
            'export_allowed': user_plan in ['Pro', 'Premium'],
            'plan': user_plan,
            'stop': False
        })

    translated_text = translate_line_with_gpt(text, prev_context, lang)

    if not translated_text:
        return jsonify({'error': 'Translation failed'}), 500

    save_line_to_cache(video_id, line_number, text, translated_text, lang)

    return jsonify({
        'videoId': video_id,
        'lineNumber': line_number,
        'text': translated_text,
        'cached': False,
        'limited': user_plan == 'Free',
        'export_allowed': user_plan in ['Pro', 'Premium'],
        'plan': user_plan,
        'stop': False
    })

@app.route('/api/plan', methods=['GET', 'OPTIONS'])
def api_plan():
    if request.method == 'OPTIONS':
        return '', 200

    token = None
    source = None

    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        source = 'extension'
    else:
        cookie_token = request.cookies.get('auth_token')
        if cookie_token:
            token = cookie_token
            source = 'website'

    if not token:
        return jsonify({"error": "unauthorized"}), 401

    user = get_user_by_token(token)
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    return jsonify({"status": "ok", "email": user['email'], "plan": user['plan']})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/stats', methods=['GET'])
def stats():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM translations')
    total = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(DISTINCT video_id) FROM translations')
    unique_videos = cursor.fetchone()[0]
    conn.close()
    return jsonify({'total_lines': total, 'unique_videos': unique_videos})

@app.route('/auth/callback')
def oauth_callback():
    code = request.args.get('code')
    if not code:
        return "<h1>Ошибка</h1><p>Код авторизации не получен.</p>", 400

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

        payload = decode_jwt(id_token)
        if not payload:
            return "<h1>Ошибка</h1><p>Не удалось декодировать id_token.</p>", 500

        email = payload.get('email', 'Email не найден')
        token = create_or_update_user(email, plan='Free')

        html_response = f"""
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <script>
            if (window.opener) {{
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
                setTimeout(function() {{ window.close(); }}, 1000);
            }} else {{
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
    return send_from_directory(EXTENSION_DIR, 'auth.html')

@app.route('/auth-site')
def auth_site():
    oauth_url = (
        'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={GOOGLE_CLIENT_ID}'
        '&response_type=code'
        '&redirect_uri=http://localhost:5000/auth-site/callback'
        '&scope=openid email profile'
        '&prompt=select_account'
    )
    return redirect(oauth_url)

@app.route('/auth-site/callback')
def auth_site_callback():
    code = request.args.get('code')
    if not code:
        return "<h1>Ошибка</h1><p>Код авторизации не получен.</p>", 400

    token_url = 'https://oauth2.googleapis.com/token'
    token_data = {
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': 'http://localhost:5000/auth-site/callback',
        'grant_type': 'authorization_code'
    }

    try:
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        tokens = response.json()
        id_token = tokens.get('id_token')
        if not id_token:
            return "<h1>Ошибка</h1><p>id_token не получен.</p>", 500

        payload = decode_jwt(id_token)
        if not payload:
            return "<h1>Ошибка</h1><p>Не удалось декодировать id_token.</p>", 500

        email = payload.get('email', 'Email не найден')
        token = create_or_update_user(email, plan='Free')

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

        resp = make_response(html)
        resp.set_cookie('auth_token', token, max_age=60*60*24*30, httponly=False, samesite='Lax')
        resp.set_cookie('auth_email', email, max_age=60*60*24*30, httponly=False, samesite='Lax')
        return resp
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при обмене кода на токены: {e}")
        return f"<h1>Ошибка</h1><p>Не удалось обменять код на токены: {e}</p>", 500

@app.route('/auth-site/logout')
def auth_site_logout():
    resp = make_response(redirect('/pricing'))
    resp.set_cookie('auth_token', '', expires=0, path='/')
    resp.set_cookie('auth_email', '', expires=0, path='/')
    return resp

@app.route('/pricing')
def pricing():
    return send_from_directory(EXTENSION_DIR, 'pricing.html')

@app.route('/pricing.css')
def pricing_css():
    return send_from_directory(EXTENSION_DIR, 'pricing.css', mimetype='text/css')

@app.route('/pricing.js')
def pricing_js():
    return send_from_directory(EXTENSION_DIR, 'pricing.js', mimetype='application/javascript')

@app.route('/auth.css')
def auth_css():
    return send_from_directory(EXTENSION_DIR, 'auth.css', mimetype='text/css')

@app.route('/auth.js')
def auth_js():
    return send_from_directory(EXTENSION_DIR, 'auth.js', mimetype='application/javascript')

@app.route('/styles.css')
def styles_css():
    return send_from_directory(EXTENSION_DIR, 'styles.css', mimetype='text/css')

@app.route('/background.js')
def background_js():
    return send_from_directory(EXTENSION_DIR, 'background.js', mimetype='application/javascript')

@app.route('/content.js')
def content_js():
    return send_from_directory(EXTENSION_DIR, 'content.js', mimetype='application/javascript')

@app.route('/flags.js')
def flags_js():
    return send_from_directory(EXTENSION_DIR, 'flags.js', mimetype='application/javascript')

@app.route('/manifest.json')
def manifest():
    return send_from_directory(EXTENSION_DIR, 'manifest.json', mimetype='application/json')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(EXTENSION_DIR, 'assets'), filename)

@app.route('/switch-plan/<plan>', methods=['POST', 'OPTIONS'])
def switch_plan(plan):
    if request.method == 'OPTIONS':
        return '', 200
    if plan not in ['Free', 'Pro', 'Premium']:
        return jsonify({"error": "invalid_plan"}), 400

    token = request.cookies.get('auth_token')
    if not token:
        return jsonify({"error": "unauthorized"}), 401

    user = get_user_by_token(token)
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    conn = sqlite3.connect(USERS_DB)
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET plan = ? WHERE token = ?', (plan, token))
    conn.commit()
    conn.close()

    return jsonify({"status": "ok", "plan": plan, "email": user['email']})

@app.route('/api/update-plan', methods=['POST', 'OPTIONS'])
def api_update_plan():
    if request.method == 'OPTIONS':
        return '', 200

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "unauthorized"}), 401

    token = auth_header.split(' ')[1]
    user = get_user_by_token(token)
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    data = request.json
    new_plan = data.get('plan')
    if not new_plan or new_plan not in ['Free', 'Pro', 'Premium']:
        return jsonify({"error": "invalid_plan"}), 400

    success = update_user_plan(user['email'], new_plan)
    if success:
        return jsonify({"status": "ok", "email": user['email'], "plan": new_plan})
    else:
        return jsonify({"error": "update_failed"}), 500

@app.route('/checkout/pro')
def checkout_pro():
    return send_from_directory(EXTENSION_DIR, 'checkout_pro.html')

@app.route('/checkout/premium')
def checkout_premium():
    return send_from_directory(EXTENSION_DIR, 'checkout_premium.html')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
