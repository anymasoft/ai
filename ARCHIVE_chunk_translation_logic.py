"""
АРХИВ: Логика перевода субтитров по чанкам (batch translation)

Этот файл содержит исторические версии логики перевода субтитров,
которые работали с полным текстом / чанками, а не построчно.

ИСТОРИЯ:
1. Первая версия (коммит b4f4930): перевод всех субтитров сразу одним запросом
2. Batch версия (коммит 668b89f): разбивка на батчи по 100 субтитров
3. Текущая версия: построчный перевод (line-by-line) с контекстом

Эти версии сохранены для возможного использования в будущем.
"""

# ═══════════════════════════════════════════════════════════════════
# ВЕРСИЯ 1: ОРИГИНАЛЬНАЯ (коммит b4f4930)
# Перевод всех субтитров сразу одним запросом к GPT
# ═══════════════════════════════════════════════════════════════════

def translate_with_gpt_v1(subtitles, client):
    """
    Переводит субтитры с использованием GPT-4o-mini

    ЛОГИКА:
    1. Собирает все субтитры в один текст с нумерацией [0], [1], [2]...
    2. Отправляет весь текст в GPT одним запросом
    3. Парсит ответ, извлекая переводы по номерам

    ПЛЮСЫ:
    - Простота кода
    - GPT видит полный контекст

    МИНУСЫ:
    - Ограничение max_tokens (4000) - не хватает для длинных видео
    - Может пропускать строки при большом объеме
    """

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


# ═══════════════════════════════════════════════════════════════════
# ВЕРСИЯ 2: BATCH TRANSLATION (коммит 668b89f)
# Разбивка на батчи по 100 субтитров для длинных видео
# ═══════════════════════════════════════════════════════════════════

def translate_with_gpt_v2_batch(subtitles, client):
    """
    Переводит субтитры с использованием GPT-4o-mini, разбивая на батчи

    ЛОГИКА:
    1. Разбивает субтитры на батчи по 100 штук
    2. Переводит каждый батч отдельным запросом
    3. Объединяет результаты

    ПЛЮСЫ:
    - Работает с любым количеством субтитров
    - Детальное логирование каждого батча
    - Обработка ошибок - если батч упал, остальные продолжают работу

    МИНУСЫ:
    - Контекст теряется между батчами (батч 0-100 не знает про батч 100-200)
    - Больше запросов к API
    """

    BATCH_SIZE = 100  # Переводим по 100 субтитров за раз
    all_translations = []

    print(f"Всего субтитров для перевода: {len(subtitles)}")

    # Разбиваем на батчи
    for batch_start in range(0, len(subtitles), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(subtitles))
        batch = subtitles[batch_start:batch_end]

        print(f"Переводим батч {batch_start}-{batch_end} ({len(batch)} субтитров)")

        # Формируем текст для перевода
        text_to_translate = '\n'.join([
            f"[{batch_start + i}] {sub['text']}"
            for i, sub in enumerate(batch)
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
- Переводи построчно, сохраняя разбивку предложений
- ОБЯЗАТЕЛЬНО переведи ВСЕ строки из входных данных"""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text_to_translate}
                ],
                temperature=0.3,
                max_tokens=8000  # Увеличили лимит для батчей
            )

            translated_text = response.choices[0].message.content

            # Парсим ответ
            batch_translations = []
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
                            batch_translations.append({
                                'index': index,
                                'text': text
                            })
                    except:
                        continue

            print(f"Получено переводов для батча: {len(batch_translations)}")
            all_translations.extend(batch_translations)

        except Exception as e:
            print(f"Ошибка при переводе батча {batch_start}-{batch_end}: {e}")
            # В случае ошибки добавляем оригинальные тексты
            for i, sub in enumerate(batch):
                all_translations.append({
                    'index': batch_start + i,
                    'text': sub['text']  # Оставляем оригинал
                })

    print(f"Всего получено переводов: {len(all_translations)}")
    return all_translations


# ═══════════════════════════════════════════════════════════════════
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ═══════════════════════════════════════════════════════════════════

import hashlib
import json

def generate_subtitle_hash(subtitles):
    """Генерирует хеш из текстов субтитров для кеширования"""
    text = ''.join([sub['text'] for sub in subtitles])
    return hashlib.md5(text.encode()).hexdigest()


def check_cache(video_id, subtitle_hash, database_connection):
    """Проверяет наличие перевода в кеше"""
    cursor = database_connection.cursor()

    cursor.execute('''
        SELECT translated_text
        FROM translations
        WHERE video_id = ? AND subtitle_hash = ?
    ''', (video_id, subtitle_hash))

    result = cursor.fetchone()

    if result:
        return json.loads(result[0])
    return None


def save_to_cache(video_id, subtitle_hash, original_text, translated_text, database_connection):
    """Сохраняет перевод в кеш"""
    cursor = database_connection.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO translations
        (video_id, subtitle_hash, original_text, translated_text)
        VALUES (?, ?, ?, ?)
    ''', (video_id, subtitle_hash, original_text, json.dumps(translated_text)))

    database_connection.commit()


# ═══════════════════════════════════════════════════════════════════
# ENDPOINT ДЛЯ ПЕРЕВОДА (как это было раньше)
# ═══════════════════════════════════════════════════════════════════

def translate_endpoint_handler(request_data, client, database_connection):
    """
    Обработчик endpoint /translate
    Используется для batch перевода всех субтитров сразу

    ОТЛИЧИЕ ОТ ТЕКУЩЕЙ ВЕРСИИ:
    - Текущая: /translate-line - переводит по одной строке с контекстом
    - Старая: /translate - переводит весь транскрипт за раз / батчами
    """

    video_id = request_data.get('videoId')
    subtitles = request_data.get('subtitles', [])

    if not video_id or not subtitles:
        return {'error': 'Missing videoId or subtitles'}, 400

    # Генерируем хеш для проверки кеша
    subtitle_hash = generate_subtitle_hash(subtitles)

    # Проверяем кеш
    cached_translation = check_cache(video_id, subtitle_hash, database_connection)

    if cached_translation:
        print(f"Найден кеш для видео {video_id}")
        return {
            'videoId': video_id,
            'cached': True,
            'translations': cached_translation
        }, 200

    # Переводим через GPT (используем batch версию для длинных видео)
    print(f"Переводим субтитры для видео {video_id}")
    translations = translate_with_gpt_v2_batch(subtitles, client)

    if not translations:
        return {'error': 'Translation failed'}, 500

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
    save_to_cache(video_id, subtitle_hash, original_text, result_translations, database_connection)

    print(f"Перевод сохранен в кеш для видео {video_id}")

    return {
        'videoId': video_id,
        'cached': False,
        'translations': result_translations
    }, 200


# ═══════════════════════════════════════════════════════════════════
# СХЕМА БД ДЛЯ BATCH ПЕРЕВОДА
# ═══════════════════════════════════════════════════════════════════

def init_db_for_batch_translation(database_connection):
    """
    Создает таблицу для хранения переводов (batch version)

    ОТЛИЧИЕ ОТ ТЕКУЩЕЙ СХЕМЫ:
    - Текущая: хранит построчно (video_id, line_number, text)
    - Старая: хранит весь транскрипт с хешом (video_id, subtitle_hash, translated_text)
    """
    cursor = database_connection.cursor()

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

    database_connection.commit()


# ═══════════════════════════════════════════════════════════════════
# ПРИМЕЧАНИЯ
# ═══════════════════════════════════════════════════════════════════

"""
ПОЧЕМУ ПЕРЕШЛИ НА LINE-BY-LINE:

1. КОНТЕКСТ: При построчном переводе каждая строка получает контекст из 1-2 предыдущих
   переведенных строк. Это улучшает качество перевода.

2. КЕШИРОВАНИЕ: Если пользователь пересматривает видео, кеш работает на уровне строк.
   При batch - весь транскрипт пересчитывается при изменении хотя бы одной строки.

3. ПРОГРЕССИВНАЯ ЗАГРУЗКА: Перевод отображается построчно в реальном времени.
   При batch - пользователь ждет перевода всего видео.

4. НАДЕЖНОСТЬ: Если упала одна строка - остальные продолжают переводиться.
   При batch - если упал запрос, весь перевод теряется.

КОГДА BATCH ЛУЧШЕ:

1. Короткие видео (< 50 субтитров) - один запрос быстрее
2. Офлайн обработка больших объемов
3. Когда важнее качество за счет полного контекста

ТЕКУЩАЯ АРХИТЕКТУРА (line-by-line) ОПТИМАЛЬНА ДЛЯ:

1. YouTube видео любой длины
2. Real-time UX с прогрессивной загрузкой
3. Эффективное кеширование
4. Устойчивость к ошибкам
"""
