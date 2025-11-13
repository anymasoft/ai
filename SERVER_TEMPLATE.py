"""
YouTube Subtitle Translation Server
Сервер для перевода субтитров YouTube с использованием GPT-4o-mini и кешированием в SQLite
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
    """Создает таблицу для хранения переводов"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            subtitle_hash TEXT NOT NULL,
            original_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(video_id, subtitle_hash)
        )
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_video_id
        ON translations(video_id)
    ''')

    conn.commit()
    conn.close()
    print("База данных инициализирована")

# Генерация хеша для субтитров
def generate_subtitle_hash(subtitles):
    """Генерирует хеш из текстов субтитров для кеширования"""
    import hashlib
    text = ''.join([sub['text'] for sub in subtitles])
    return hashlib.md5(text.encode()).hexdigest()

# Проверка кеша
def check_cache(video_id, subtitle_hash):
    """Проверяет наличие перевода в кеше"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT translated_text
        FROM translations
        WHERE video_id = ? AND subtitle_hash = ?
    ''', (video_id, subtitle_hash))

    result = cursor.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return None

# Сохранение в кеш
def save_to_cache(video_id, subtitle_hash, original_text, translated_text):
    """Сохраняет перевод в кеш"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO translations
        (video_id, subtitle_hash, original_text, translated_text)
        VALUES (?, ?, ?, ?)
    ''', (video_id, subtitle_hash, original_text, json.dumps(translated_text)))

    conn.commit()
    conn.close()

# Перевод через GPT-4o-mini
def translate_with_gpt(subtitles):
    """Переводит субтитры с использованием GPT-4o-mini"""

    # Формируем текст для перевода
    text_to_translate = '\n'.join([
        f"[{i}] {sub['text']}"
        for i, sub in enumerate(subtitles)
    ])

    system_prompt = """Ты профессиональный переводчик субтитров с английского на русский.

ЗАДАЧА:
1. Переведи каждую строку субтитров на русский язык
2. Сохрани естественность речи и контекст
3. Исправь любые ошибки распознавания речи
4. Если встречаются неразборчивые фрагменты или артефакты - замени их на осмысленный перевод на основе контекста
5. Сохрани формат: каждая строка должна начинаться с номера в квадратных скобках [N]

ВАЖНО:
- НЕ добавляй никаких пояснений или комментариев
- НЕ пропускай строки
- Сохрани порядок и нумерацию строк
- Переводи построчно, сохраняя разбивку предложений"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_to_translate}
            ],
            temperature=0.3,
            max_tokens=4000
        )

        translated_text = response.choices[0].message.content

        # Парсим ответ
        translations = []
        lines = translated_text.strip().split('\n')

        for line in lines:
            # Извлекаем номер и текст
            if line.strip().startswith('['):
                try:
                    # Формат: [N] текст
                    parts = line.split(']', 1)
                    if len(parts) == 2:
                        index = int(parts[0].strip('['))
                        text = parts[1].strip()
                        translations.append({
                            'index': index,
                            'text': text
                        })
                except:
                    continue

        return translations

    except Exception as e:
        print(f"Ошибка при переводе через GPT: {e}")
        return None

@app.route('/translate', methods=['POST'])
def translate():
    """Endpoint для перевода субтитров"""

    data = request.json
    video_id = data.get('videoId')
    subtitles = data.get('subtitles', [])

    if not video_id or not subtitles:
        return jsonify({'error': 'Missing videoId or subtitles'}), 400

    # Генерируем хеш для проверки кеша
    subtitle_hash = generate_subtitle_hash(subtitles)

    # Проверяем кеш
    cached_translation = check_cache(video_id, subtitle_hash)

    if cached_translation:
        print(f"Найден кеш для видео {video_id}")
        return jsonify({
            'videoId': video_id,
            'cached': True,
            'translations': cached_translation
        })

    # Переводим через GPT
    print(f"Переводим субтитры для видео {video_id}")
    translations = translate_with_gpt(subtitles)

    if not translations:
        return jsonify({'error': 'Translation failed'}), 500

    # Формируем результат с временными метками
    result_translations = []
    for i, sub in enumerate(subtitles):
        translated_text = next(
            (t['text'] for t in translations if t['index'] == i),
            sub['text']  # Fallback на оригинал если перевод не найден
        )
        result_translations.append({
            'time': sub['time'],
            'text': translated_text
        })

    # Сохраняем в кеш
    original_text = json.dumps(subtitles)
    save_to_cache(video_id, subtitle_hash, original_text, result_translations)

    print(f"Перевод сохранен в кеш для видео {video_id}")

    return jsonify({
        'videoId': video_id,
        'cached': False,
        'translations': result_translations
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
        'total_translations': total,
        'unique_videos': unique_videos
    })

if __name__ == '__main__':
    # Инициализируем БД при запуске
    init_db()

    print("=" * 60)
    print("YouTube Subtitle Translation Server")
    print("=" * 60)
    print("Сервер запущен на http://localhost:5000")
    print("Endpoints:")
    print("  POST /translate - перевод субтитров")
    print("  GET  /health    - проверка работоспособности")
    print("  GET  /stats     - статистика кеша")
    print("=" * 60)

    # Запускаем сервер
    app.run(debug=True, host='0.0.0.0', port=5000)
