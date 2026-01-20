from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import sqlite3
from dotenv import load_dotenv
import logging

# Настраиваем логирование
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Загружаем переменные окружения из .env
load_dotenv()

# Импортируем модули нашего приложения
from database import init_db, create_article, get_all_articles, get_article, delete_article, DB_PATH
from llm import (
    generate_article_plan,
    edit_full_text,
    edit_fragment,
    import_youtube_video,
    enhance_fragment,
    enhance_full_text,
    enhance_plan,
    humanize_text,
    LLMResponse,
    ChunkInfo,
    LLMUsage
)

# Инициализируем FastAPI приложение
app = FastAPI(title="Depeche - AI Article Editor")

# Добавляем middleware для логирования всех запросов
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"[HTTP] {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"[HTTP] Response: {response.status_code}")
    return response

# Добавляем CORS middleware для работы с фронтенду
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Получаем абсолютный путь к текущей директории
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Настраиваем шаблоны
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Подключаем статические файлы (CSS, JS, изображения)
static_dir = os.path.join(BASE_DIR, "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Инициализируем БД при старте приложения
@app.on_event("startup")
def startup_event():
    """Инициализация БД при запуске сервера"""
    logger.info("=== DEPECHE STARTUP ===")
    logger.info(f"Всего endpoints: {len([r for r in app.routes if hasattr(r, 'path')])}")
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = list(route.methods) if hasattr(route, 'methods') and route.methods else ["GET"]
            logger.info(f"  Registered: {methods} {route.path}")
    init_db()
    logger.info("=== БД инициализирована ===")


# === MODELS ===

class ArticleCreateRequest(BaseModel):
    """Запрос для создания новой статьи"""
    topic: str
    format: str = "plain"  # "plain" или "markdown"


class ArticleResponse(BaseModel):
    """Ответ с информацией о статье"""
    id: int
    title: str
    content: str


class UsageInfo(BaseModel):
    """Информация об использовании токенов"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChunkInfoResponse(BaseModel):
    """Информация о разбиении на чанки"""
    chunks_count: int
    strategy: str
    total_chars: int


class EditFragmentResponse(BaseModel):
    """Ответ при редактировании фрагмента с полной метаинформацией"""
    id: int
    title: str
    content: str
    fragment: str  # НОВЫЙ фрагмент (не полный текст)
    truncated: bool = False  # True если ответ был обрезан (недоступно сейчас, но готово к будущему)
    finish_reason: Optional[str] = "stop"
    usage: Optional[UsageInfo] = None
    chunk_info: Optional[ChunkInfoResponse] = None


class EditFullResponse(BaseModel):
    """Ответ при редактировании полного текста с метаинформацией"""
    id: int
    title: str
    content: str
    truncated: bool = False
    finish_reason: Optional[str] = "stop"
    usage: Optional[UsageInfo] = None
    chunk_info: Optional[ChunkInfoResponse] = None


class ArticleListItem(BaseModel):
    """Элемент списка статей для sidebar"""
    id: int
    title: str


class EditFullTextRequest(BaseModel):
    """Запрос для редактирования всего текста статьи (РЕЖИМ 2)"""
    instruction: str
    current_text: str = ""  # Текст из поля редактора (приоритет над текстом из БД)
    format: str = "plain"  # "plain" или "markdown"


class EditFragmentRequest(BaseModel):
    """Запрос для редактирования фрагмента статьи (РЕЖИМ 3)"""
    before_context: str
    fragment: str
    after_context: str
    instruction: str
    format: str = "plain"  # "plain" или "markdown"


class TruncatedErrorResponse(BaseModel):
    """Ошибка когда ответ был обрезан несмотря на все попытки"""
    detail: str
    error_code: str = "TRUNCATED"
    mode: str  # "plan", "fragment", "fulltext"
    diagnostics: Optional[Dict[str, Any]] = None


class EnhanceRequest(BaseModel):
    """Запрос для усиления текста (РЕЖИМ 5)"""
    mode: str  # "fragment" | "full" | "plan"
    text: str = ""  # Текст для усиления (фрагмент или полная статья)
    beforeContext: str = ""  # Контекст перед фрагментом (опционально, для режима fragment)
    afterContext: str = ""  # Контекст после фрагмента (опционально, для режима fragment)
    userInstruction: str = ""  # Тема (для режима plan) или дополнительная инструкция


class EnhanceFragmentResponse(BaseModel):
    """Ответ при усилении фрагмента"""
    replacementText: str


class EnhanceFullResponse(BaseModel):
    """Ответ при усилении полного текста"""
    newText: str


class EnhancePlanResponse(BaseModel):
    """Ответ при усилении плана"""
    newText: str  # Нумерованный список пункков


class YouTubeImportRequest(BaseModel):
    """Запрос для импорта статьи из YouTube видео (РЕЖИМ 4)"""
    youtube_url: str


class HumanizeRequest(BaseModel):
    """Запрос для гуманизации текста (РЕЖИМ 6)"""
    text: str
    scope: str = "full"  # "full" или "fragment"


# === API ENDPOINTS ===

@app.get("/")
async def get_index(request: Request):
    """Главная страница - возвращает index.html через шаблонизатор Jinja2"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check():
    """Проверка здоровья сервера"""
    return {"status": "ok", "app": "Depeche"}


@app.get("/debug/routes")
async def debug_routes():
    """Показать все зарегистрированные routes (для отладки)"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else ["GET"]
            })
    logger.info(f"[DEBUG] Всего routes: {len(routes)}")
    for route in routes:
        logger.info(f"[DEBUG] {route['methods']} {route['path']}")
    return {"routes": routes, "total": len(routes)}


@app.post("/api/articles")
async def create_new_article(request: ArticleCreateRequest):
    """
    Создать новую ПУСТУЮ статью (без генерации плана).

    Request: { "topic": "Название статьи" }
    Response: { "id": 1, "title": "Название статьи", "content": "" }
    """
    try:
        logger.info(f"[CREATE_ARTICLE] Получен запрос на создание статьи. topic='{request.topic}'")
        title = request.topic.strip()

        if not title:
            logger.warning("[CREATE_ARTICLE] Ошибка: название пусто")
            raise HTTPException(status_code=400, detail="Название статьи не может быть пустым")

        # Создаём пустую статью - БЕЗ вызова LLM
        logger.info(f"[CREATE_ARTICLE] Создаём пустую статью с названием '{title}'")
        article = create_article(title=title, content="")

        logger.info(f"[CREATE_ARTICLE] Статья успешно создана! ID={article['id']}, title='{article['title']}'")
        return ArticleResponse(**article)

    except HTTPException as e:
        logger.error(f"[CREATE_ARTICLE] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[CREATE_ARTICLE] Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при создании статьи: {str(e)}")


@app.post("/api/articles/{article_id}/plan")
async def generate_and_save_plan(article_id: int, request: ArticleCreateRequest):
    """
    Генерирует план статьи по теме и сохраняет её содержимое.

    Request: { "topic": "Обезьяны в Африке" }
    Response: { "id": 1, "title": "...", "content": "1. ...\n2. ..." }

    При обрезании ответа (finish_reason=length):
    - Один автоматический retry с увеличенным лимитом
    - Если все равно не получилось → 422 с error_code="TRUNCATED"
    """
    try:
        logger.info(f"[GENERATE_PLAN] Получен запрос на генерацию плана. article_id={article_id}, topic='{request.topic}'")
        topic = request.topic.strip()

        if not topic:
            logger.warning("[GENERATE_PLAN] Ошибка: тема пуста")
            raise HTTPException(status_code=400, detail="Тема статьи не может быть пустой")

        # Проверяем существование статьи
        logger.info(f"[GENERATE_PLAN] Проверяем существование статьи с ID={article_id}")
        article = get_article(article_id)
        if not article:
            logger.error(f"[GENERATE_PLAN] Статья с ID {article_id} не найдена в БД")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[GENERATE_PLAN] Статья найдена: ID={article['id']}, title='{article['title']}'")

        # Генерируем план через LLM с учётом формата
        logger.info(f"[GENERATE_PLAN] Вызываем LLM для генерации плана по теме '{topic}', format: {request.format}")
        try:
            llm_response, chunk_info = generate_article_plan(topic, request.format)
            plan = llm_response.text
            logger.info(f"[GENERATE_PLAN] План успешно сгенерирован: {plan[:100]}...")
        except Exception as e:
            if "TRUNCATED" in str(e):
                logger.error(f"[GENERATE_PLAN] План был обрезан: {str(e)}")
                raise HTTPException(
                    status_code=422,
                    detail=f"Ошибка: план был обрезан. Попробуйте сократить тему."
                )
            raise

        # КРИТИЧНО: НЕ сохраняем план в БД! Только возвращаем фронтенду
        logger.info(f"[GENERATE_PLAN] Возвращаем сгенерированный план фронтенду (БЕЗ сохранения в БД)")

        # Возвращаем статью с сгенерированным планом
        return ArticleResponse(
            id=article_id,
            title=article["title"],
            content=plan  # Сгенерированный план, не из БД
        )

    except HTTPException as e:
        logger.error(f"[GENERATE_PLAN] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[GENERATE_PLAN] Критическая ошибка: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации плана: {str(e)}")


@app.get("/api/articles")
async def get_articles_list():
    """
    Получить список всех статей для sidebar.

    Response: [{ "id": 1, "title": "Тема статьи" }, ...]
    """
    try:
        logger.info("[GET_ARTICLES_LIST] Получен запрос списка статей")
        articles = get_all_articles()
        logger.info(f"[GET_ARTICLES_LIST] Возвращаем {len(articles)} статей")
        return articles
    except Exception as e:
        logger.error(f"[GET_ARTICLES_LIST] Ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении списка статей: {str(e)}")


@app.get("/api/articles/{article_id}")
async def get_single_article(article_id: int):
    """
    Получить конкретную статью по ID.

    Response: { "id": 1, "title": "Тема", "content": "1. ...\n2. ..." }
    """
    try:
        logger.info(f"[GET_ARTICLE] Получен запрос статьи. ID={article_id}")
        article = get_article(article_id)

        if not article:
            logger.error(f"[GET_ARTICLE] Статья с ID {article_id} не найдена в БД")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[GET_ARTICLE] Статья найдена: ID={article['id']}, title='{article['title']}'")
        return ArticleResponse(**article)

    except HTTPException as e:
        logger.error(f"[GET_ARTICLE] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[GET_ARTICLE] Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении статьи: {str(e)}")


@app.delete("/api/articles/{article_id}")
async def delete_single_article(article_id: int):
    """
    Удалить статью по ID.

    Response: { "success": true, "message": "Статья удалена" }
    """
    try:
        logger.info(f"[DELETE_ARTICLE] Получен запрос на удаление статьи. ID={article_id}")
        success = delete_article(article_id)

        if not success:
            logger.error(f"[DELETE_ARTICLE] Статья с ID {article_id} не найдена для удаления")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[DELETE_ARTICLE] Статья с ID {article_id} успешно удалена")
        return {"success": True, "message": "Статья удалена"}

    except HTTPException as e:
        logger.error(f"[DELETE_ARTICLE] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[DELETE_ARTICLE] Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении статьи: {str(e)}")


class SaveArticleRequest(BaseModel):
    """Запрос для сохранения контента статьи"""
    content: str


@app.patch("/api/articles/{article_id}")
async def save_article_content(article_id: int, request: SaveArticleRequest):
    """
    Явно сохранить контент статьи (PATCH).

    Request: { "content": "новый контент" }
    Response: { "id": 1, "title": "...", "content": "новый контент" }
    """
    try:
        logger.info(f"[SAVE_ARTICLE] Получен запрос на сохранение контента. ID={article_id}")

        # Проверяем что статья существует
        article = get_article(article_id)
        if not article:
            logger.error(f"[SAVE_ARTICLE] Статья с ID {article_id} не найдена")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[SAVE_ARTICLE] Сохраняю контент. Размер: {len(request.content)} символов")

        # Обновляем content статьи в БД
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE articles SET content = ? WHERE id = ?",
            (request.content, article_id)
        )
        conn.commit()
        conn.close()

        logger.info(f"[SAVE_ARTICLE] Контент успешно сохранён")

        return ArticleResponse(
            id=article_id,
            title=article["title"],
            content=request.content
        )

    except HTTPException as e:
        logger.error(f"[SAVE_ARTICLE] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[SAVE_ARTICLE] Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении: {str(e)}")


@app.post("/api/articles/{article_id}/edit-full", response_model=EditFullResponse)
async def edit_article_full_text(article_id: int, request: EditFullTextRequest):
    """
    РЕЖИМ 2: Редактирование ВСЕГО текста статьи с поддержкой chunking.

    Применяет инструкцию редактирования ко ВСЕМУ тексту статьи.
    Для длинных текстов (>2500 символов) автоматически разбивает на чанки.

    Request: { "instruction": "Сделай текст более научным" }
    Response: { "id": 1, "title": "...", "content": "отредактированный текст...",
                "chunk_info": {...}, "truncated": false, ... }

    При обрезании (даже после retry/chunking):
    - Возвращает HTTP 422 с error_code="TRUNCATED"
    """
    try:
        logger.info(f"[EDIT_FULL] Получен запрос на редактирование всего текста. article_id={article_id}")
        logger.info(f"[EDIT_FULL] Инструкция: {request.instruction[:100]}...")

        # Проверяем что статья существует (только для валидации ID)
        article = get_article(article_id)
        if not article:
            logger.error(f"[EDIT_FULL] Статья с ID {article_id} не найдена")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        # КРИТИЧНО: Используем ТОЛЬКО текст из фронтенда, НИКОГДА из БД!
        if not request.current_text:
            logger.error(f"[EDIT_FULL] ОШИБКА: Текст из фронтенда не передан (пусто)")
            raise HTTPException(status_code=400, detail="Текст для редактирования не может быть пустым")

        logger.info(f"[EDIT_FULL] Статья валидна: {article['title']}")
        logger.info(f"[EDIT_FULL] Текст из фронтенда: {len(request.current_text)} символов")
        logger.info(f"[EDIT_FULL] Формат вывода: {request.format}")

        # Вызываем LLM для редактирования (только с текстом из фронтенда!)
        logger.info(f"[EDIT_FULL] Вызываем LLM для редактирования всего текста")
        try:
            llm_response, chunk_info = edit_full_text(request.current_text, request.instruction, request.format)
            edited_text = llm_response.text
            logger.info(f"[EDIT_FULL] Текст успешно отредактирован ({len(edited_text)} символов)")
        except Exception as e:
            if "TRUNCATED" in str(e):
                logger.error(f"[EDIT_FULL] Текст был обрезан даже после всех попыток: {str(e)}")
                raise HTTPException(
                    status_code=422,
                    detail=f"Ошибка: текст был обрезан. Попробуйте сократить запрос или разбить текст на части."
                )
            raise

        # ВАЖНО: НЕ сохраняем в БД! Только возвращаем отредактированный текст фронтенду
        logger.info(f"[EDIT_FULL] Возвращаем результат редактирования фронтенду (БЕЗ сохранения в БД)")

        chunk_info_response = None
        if chunk_info:
            chunk_info_response = ChunkInfoResponse(
                chunks_count=chunk_info.chunks_count,
                strategy=chunk_info.strategy,
                total_chars=chunk_info.total_chars
            )

        usage_info = None
        if llm_response.usage:
            usage_info = UsageInfo(
                prompt_tokens=llm_response.usage.prompt_tokens,
                completion_tokens=llm_response.usage.completion_tokens,
                total_tokens=llm_response.usage.total_tokens
            )

        # Возвращаем ТОЛЬКО отредактированный текст (не загружаем из БД!)
        return EditFullResponse(
            id=article_id,
            title=article["title"],
            content=edited_text,
            truncated=llm_response.truncated,
            finish_reason=llm_response.finish_reason,
            usage=usage_info,
            chunk_info=chunk_info_response
        )

    except HTTPException as e:
        logger.error(f"[EDIT_FULL] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[EDIT_FULL] Критическая ошибка: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при редактировании текста: {str(e)}")


@app.post("/api/articles/{article_id}/edit-fragment", response_model=EditFragmentResponse)
async def edit_article_fragment(article_id: int, request: EditFragmentRequest):
    """
    РЕЖИМ 3: Редактирование ВЫДЕЛЕННОГО ФРАГМЕНТА статьи с поддержкой retry и chunking.

    Применяет инструкцию только к выделенному фрагменту, сохраняя остальной текст.

    Алгоритм:
    1. Один запрос с FRAGMENT_MAX_TOKENS
    2. Если обрезано (finish_reason=length) → retry с увеличенным лимитом
    3. Если снова обрезано → chunking фрагмента

    Request: {
        "before_context": "...",
        "fragment": "...",
        "after_context": "...",
        "instruction": "Раскрой подробнее"
    }
    Response: { "id": 1, "title": "...", "content": "обновленный текст...",
                "fragment": "отредактированный фрагмент...", "chunk_info": {...}, ... }

    При обрезании (даже после retry/chunking):
    - Возвращает HTTP 422 с error_code="TRUNCATED"
    - НЕ сохраняет partial в БД
    """
    try:
        logger.info(f"[EDIT_FRAGMENT] Получен запрос на редактирование фрагмента. article_id={article_id}")
        logger.info(f"[EDIT_FRAGMENT] Инструкция: {request.instruction[:100]}...")
        logger.info(f"[EDIT_FRAGMENT] Размер фрагмента: {len(request.fragment)} символов")

        # Получаем текущую статью
        article = get_article(article_id)
        if not article:
            logger.error(f"[EDIT_FRAGMENT] Статья с ID {article_id} не найдена")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[EDIT_FRAGMENT] Статья найдена: {article['title']}")
        logger.info(f"[EDIT_FRAGMENT] Формат вывода: {request.format}")

        # Вызываем LLM для редактирования фрагмента
        logger.info(f"[EDIT_FRAGMENT] Вызываем LLM для редактирования фрагмента (retry + chunking при необходимости)")
        try:
            llm_response, chunk_info = edit_fragment(
                request.before_context,
                request.fragment,
                request.after_context,
                request.instruction,
                request.format
            )
            edited_fragment = llm_response.text
            logger.info(f"[EDIT_FRAGMENT] Фрагмент успешно отредактирован ({len(edited_fragment)} символов)")

            # === ФИНАЛЬНАЯ САНИТИЗАЦИЯ В main.py ===
            # Даже если llm.py уже санитизировал, проверим ещё раз перед конкатенацией и возвратом
            from llm import sanitize_fragment as sanitize_frag, _has_fragment_markers
            logger.debug(f"[EDIT_FRAGMENT] Финальная проверка: санитизация в main.py")
            has_markers, marker_name = _has_fragment_markers(edited_fragment)
            if has_markers:
                logger.warning(f"[EDIT_FRAGMENT] ВНИМАНИЕ: В edited_fragment обнаружены маркеры {marker_name}!")
                edited_fragment = sanitize_frag(edited_fragment)
                has_markers_after, _ = _has_fragment_markers(edited_fragment)
                if has_markers_after:
                    logger.error(f"[EDIT_FRAGMENT] КРИТИЧЕСКАЯ ОШИБКА: Маркеры остались после финальной санитизации!")
            logger.info(f"[EDIT_FRAGMENT] После финальной санитизации: {len(edited_fragment)} символов")
        except Exception as e:
            error_str = str(e)
            if "TRUNCATED" in error_str:
                logger.error(f"[EDIT_FRAGMENT] Фрагмент был обрезан даже после всех попыток: {error_str}")
                raise HTTPException(
                    status_code=422,
                    detail=f"Ошибка: фрагмент был обрезан. Выделите меньший фрагмент и попробуйте снова."
                )
            elif "STRUCTURE_MISMATCH" in error_str:
                logger.error(f"[EDIT_FRAGMENT] Структурное несоответствие после всех попыток: {error_str}")
                raise HTTPException(
                    status_code=422,
                    detail=f"Ошибка: структура фрагмента не совпадает с требованием. Попробуйте ещё раз или уточните инструкцию."
                )
            raise

        # Заменяем фрагмент в тексте статьи
        logger.info(f"[EDIT_FRAGMENT] Заменяем фрагмент в тексте статьи")

        # МИНИМАЛЬНЫЙ ПОДХОД: просто конкатенируем before + новый_fragment + after
        # Собираем полный текст из компонентов (без сохранения в БД!)
        updated_text = request.before_context + edited_fragment + request.after_context
        logger.info(f"[EDIT_FRAGMENT] Текст обновлен: concat(before={len(request.before_context)} + fragment={len(edited_fragment)} + after={len(request.after_context)})")

        # КРИТИЧНО: НЕ сохраняем в БД! Только возвращаем результат фронтенду
        logger.info(f"[EDIT_FRAGMENT] Возвращаем результат редактирования фронтенду (БЕЗ сохранения в БД)")

        chunk_info_response = None
        if chunk_info:
            chunk_info_response = ChunkInfoResponse(
                chunks_count=chunk_info.chunks_count,
                strategy=chunk_info.strategy,
                total_chars=chunk_info.total_chars
            )

        usage_info = None
        if llm_response.usage:
            usage_info = UsageInfo(
                prompt_tokens=llm_response.usage.prompt_tokens,
                completion_tokens=llm_response.usage.completion_tokens,
                total_tokens=llm_response.usage.total_tokens
            )

        # Возвращаем обновленный текст и новый фрагмент (не загружаем из БД!)
        return EditFragmentResponse(
            id=article_id,
            title=article["title"],
            content=updated_text,
            fragment=edited_fragment,  # НОВЫЙ фрагмент, отдельно от content
            truncated=llm_response.truncated,
            finish_reason=llm_response.finish_reason,
            usage=usage_info,
            chunk_info=chunk_info_response
        )

    except HTTPException as e:
        logger.error(f"[EDIT_FRAGMENT] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[EDIT_FRAGMENT] Критическая ошибка: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при редактировании фрагмента: {str(e)}")


@app.post("/api/enhance")
async def enhance_article(request: EnhanceRequest):
    """
    РЕЖИМ 5: Усиление текста (фрагмента, полного текста или плана)

    Request JSON варианты:

    1. Усиление фрагмента:
    {
        "mode": "fragment",
        "text": "текст фрагмента",
        "beforeContext": "...",
        "afterContext": "..."
    }
    Response: { "replacementText": "..." }

    2. Усиление полного текста:
    {
        "mode": "full",
        "text": "полный текст статьи"
    }
    Response: { "newText": "..." }

    3. Усиление плана:
    {
        "mode": "plan",
        "userInstruction": "тема статьи"
    }
    Response: { "newText": "...(нумерованный список пунктов)..." }
    """
    try:
        logger.info(f"[ENHANCE] Получен запрос на усиление. mode={request.mode}")

        # РЕЖИМ 1: Усиление фрагмента
        if request.mode == "fragment":
            if not request.text:
                logger.error("[ENHANCE] Для режима fragment требуется текст фрагмента")
                raise HTTPException(status_code=400, detail="Для режима fragment требуется текст фрагмента в поле 'text'")

            logger.info(f"[ENHANCE] Усиливаю фрагмент ({len(request.text)} символов)")

            response = enhance_fragment(request.text, request.beforeContext, request.afterContext)

            if response.truncated:
                logger.error("[ENHANCE] Ответ был обрезан")
                raise HTTPException(
                    status_code=422,
                    detail="Фрагмент слишком большой, ответ был обрезан. Сократите фрагмент и попробуйте снова."
                )

            logger.info(f"[ENHANCE] Фрагмент успешно усилен ({len(response.text)} символов)")

            return EnhanceFragmentResponse(replacementText=response.text)

        # РЕЖИМ 2: Усиление полного текста
        elif request.mode == "full":
            if not request.text:
                logger.error("[ENHANCE] Для режима full требуется полный текст")
                raise HTTPException(status_code=400, detail="Для режима full требуется полный текст статьи в поле 'text'")

            logger.info(f"[ENHANCE] Усиливаю полный текст ({len(request.text)} символов)")

            response = enhance_full_text(request.text)

            if response.truncated:
                logger.error("[ENHANCE] Ответ был обрезан")
                raise HTTPException(
                    status_code=422,
                    detail="Текст слишком большой, ответ был обрезан. Сократите текст и попробуйте снова."
                )

            logger.info(f"[ENHANCE] Текст успешно усилен ({len(response.text)} символов)")

            return EnhanceFullResponse(newText=response.text)

        # РЕЖИМ 3: Усиление плана по теме
        elif request.mode == "plan":
            if not request.userInstruction:
                logger.error("[ENHANCE] Для режима plan требуется тема/инструкция")
                raise HTTPException(status_code=400, detail="Для режима plan требуется тема в поле 'userInstruction'")

            logger.info(f"[ENHANCE] Создаю усиленный план по теме: {request.userInstruction}")

            response = enhance_plan(request.userInstruction)

            if response.truncated:
                logger.warning("[ENHANCE] План был обрезан, но возвращаю как есть")

            logger.info("[ENHANCE] План успешно создан")

            return EnhancePlanResponse(newText=response.text)

        else:
            logger.error(f"[ENHANCE] Неизвестный режим: {request.mode}")
            raise HTTPException(status_code=400, detail=f"Неизвестный режим: {request.mode}. Используйте 'fragment', 'full' или 'plan'")

    except HTTPException as e:
        logger.error(f"[ENHANCE] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[ENHANCE] Критическая ошибка: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при усилении: {str(e)}")


@app.post("/api/articles/{article_id}/import-youtube", response_model=EditFullResponse)
async def import_youtube_article(article_id: int, request: YouTubeImportRequest):
    """
    РЕЖИМ 4: Импорт и обработка статьи из YouTube видео

    Pipeline:
    1. Получить транскрипт через ScrapeCreators API
    2. Обработать через LLM (очистка + структурирование)
    3. Сохранить как содержимое статьи

    Request: { "youtube_url": "https://youtube.com/watch?v=..." }
    Response: { "id": 1, "title": "...", "content": "готовая статья...", ... }

    Существующая статья должна быть пуста или содержать только заголовок.
    """
    try:
        logger.info(f"[YOUTUBE_IMPORT] Получен запрос на импорт из YouTube. article_id={article_id}")
        logger.info(f"[YOUTUBE_IMPORT] YouTube URL: {request.youtube_url}")

        # Проверяем что статья существует
        article = get_article(article_id)
        if not article:
            logger.error(f"[YOUTUBE_IMPORT] Статья с ID {article_id} не найдена")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[YOUTUBE_IMPORT] Статья найдена: {article['title']}")

        # Вызываем pipeline для импорта YouTube
        logger.info(f"[YOUTUBE_IMPORT] Начинаю pipeline импорта...")
        try:
            processed_text = import_youtube_video(request.youtube_url)
            logger.info(f"[YOUTUBE_IMPORT] Текст успешно импортирован и обработан ({len(processed_text)} символов)")
        except ValueError as e:
            logger.error(f"[YOUTUBE_IMPORT] Ошибка конфигурации: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Ошибка конфигурации: {str(e)}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[YOUTUBE_IMPORT] Ошибка при импорте: {error_msg}")
            raise HTTPException(status_code=422, detail=f"Ошибка при импорте: {error_msg}")

        # Возвращаем результат фронтенду (НЕ сохраняем в БД автоматически!)
        logger.info(f"[YOUTUBE_IMPORT] Возвращаем результат импорта фронтенду (БЕЗ сохранения в БД)")

        return EditFullResponse(
            id=article_id,
            title=article["title"],
            content=processed_text,
            truncated=False,
            finish_reason="stop",
            usage=None,
            chunk_info=None
        )

    except HTTPException as e:
        logger.error(f"[YOUTUBE_IMPORT] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[YOUTUBE_IMPORT] Критическая ошибка: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при импорте из YouTube: {str(e)}")


@app.post("/api/articles/{article_id}/humanize")
async def humanize_article_text(article_id: int, request: HumanizeRequest):
    """
    РЕЖИМ 6: Гуманизация текста (убрать AI-паттерны, канцелярит, сделать естественнее)

    Можно гуманизировать либо весь текст, либо выделенный фрагмент.
    """
    try:
        logger.info(f"[HUMANIZE] Получен запрос на гуманизацию. article_id={article_id}, scope={request.scope}")
        logger.info(f"[HUMANIZE] Размер текста: {len(request.text)} символов")

        # Проверяем что статья существует
        article = get_article(article_id)
        if not article:
            logger.error(f"[HUMANIZE] Статья с ID {article_id} не найдена")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[HUMANIZE] Статья найдена: {article['title']}")

        # Вызываем функцию гуманизации
        logger.info(f"[HUMANIZE] Начинаю обработку текста...")
        try:
            llm_response, chunk_info = humanize_text(request.text)
            logger.info(f"[HUMANIZE] Текст успешно гуманизирован ({len(llm_response.text)} символов)")
        except ValueError as e:
            logger.error(f"[HUMANIZE] Ошибка конфигурации: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Ошибка конфигурации: {str(e)}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[HUMANIZE] Ошибка при гуманизации: {error_msg}")
            raise HTTPException(status_code=422, detail=f"Ошибка при гуманизации: {error_msg}")

        # Формируем ответ
        logger.info(f"[HUMANIZE] Возвращаем результат гуманизации фронтенду")

        chunk_info_response = None
        if chunk_info:
            chunk_info_response = ChunkInfoResponse(
                chunks_count=chunk_info.chunks_count,
                strategy=chunk_info.strategy,
                total_chars=chunk_info.total_chars
            )

        usage_info = None
        if llm_response.usage:
            usage_info = UsageInfo(
                prompt_tokens=llm_response.usage.prompt_tokens,
                completion_tokens=llm_response.usage.completion_tokens,
                total_tokens=llm_response.usage.total_tokens
            )

        return EditFullResponse(
            id=article_id,
            title=article["title"],
            content=llm_response.text,
            truncated=llm_response.truncated,
            finish_reason=llm_response.finish_reason,
            usage=usage_info,
            chunk_info=chunk_info_response
        )

    except HTTPException as e:
        logger.error(f"[HUMANIZE] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[HUMANIZE] Критическая ошибка: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при гуманизации: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
