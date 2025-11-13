"""
YouTube Subtitle Translation Server - Line-by-Line Architecture
Сервер для построчного перевода субтитров YouTube с использованием GPT-4o-mini
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import json
import os
from openai import OpenAI
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для запросов из расширения

# Конфигурация
DATABASE = 'translations.db'
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-api-key-here')
client = OpenAI(api_key=OPENAI_API_KEY)

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

    system_prompt = f"""You are a professional subtitle translator from English to {target_language}.

TASK:
1. Translate the [current] line to {target_language}
2. Use the [prev] lines as context for accurate translation
3. Maintain natural speech and context
4. Fix any speech recognition errors
5. If there are unclear fragments - replace them with a meaningful translation based on context

IMPORTANT:
- Return ONLY the translated text of the [current] line
- Do NOT add any explanations, comments, or prefixes
- Do NOT translate the [prev] lines - they are only for context"""

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
            'videoId': video_id,
            'lineNumber': line_number,
            'text': cached_translation,
            'cached': True
        })

    # Переводим через GPT
    print(f"[Translating] Video {video_id}, line {line_number}")
    translated_text = translate_line_with_gpt(text, prev_context, lang)

    if not translated_text:
        return jsonify({'error': 'Translation failed'}), 500

    # Сохраняем в кеш
    save_line_to_cache(video_id, line_number, text, translated_text, lang)

    return jsonify({
        'videoId': video_id,
        'lineNumber': line_number,
        'text': translated_text,
        'cached': False
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
        'total_lines': total,
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
        'videoId': video_id,
        'deletedLines': deleted
    })

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
