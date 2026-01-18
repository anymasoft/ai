from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from pydantic import BaseModel
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
from llm import generate_article_plan, edit_full_text, edit_fragment

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


class ArticleResponse(BaseModel):
    """Ответ с информацией о статье"""
    id: int
    title: str
    content: str


class ArticleListItem(BaseModel):
    """Элемент списка статей для sidebar"""
    id: int
    title: str


class EditFullTextRequest(BaseModel):
    """Запрос для редактирования всего текста статьи (РЕЖИМ 2)"""
    instruction: str


class EditFragmentRequest(BaseModel):
    """Запрос для редактирования фрагмента статьи (РЕЖИМ 3)"""
    before_context: str
    fragment: str
    after_context: str
    instruction: str


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

        # Генерируем план через LLM
        logger.info(f"[GENERATE_PLAN] Вызываем LLM для генерации плана по теме '{topic}'")
        plan = generate_article_plan(topic)
        logger.info(f"[GENERATE_PLAN] План успешно сгенерирован: {plan[:100]}...")

        # Обновляем статью в БД с полученным планом
        logger.info(f"[GENERATE_PLAN] Обновляем БД - сохраняем план для статьи ID={article_id}")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE articles SET content = ? WHERE id = ?", (plan, article_id))
        conn.commit()
        logger.info(f"[GENERATE_PLAN] Запись в БД успешна")
        conn.close()

        # Возвращаем обновлённую статью
        logger.info(f"[GENERATE_PLAN] Получаем обновлённую статью из БД")
        updated_article = get_article(article_id)
        logger.info(f"[GENERATE_PLAN] Возвращаем обновлённую статью: ID={updated_article['id']}")
        return ArticleResponse(**updated_article)

    except HTTPException as e:
        logger.error(f"[GENERATE_PLAN] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[GENERATE_PLAN] Критическая ошибка: {str(e)}")
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


@app.post("/api/articles/{article_id}/edit-full")
async def edit_article_full_text(article_id: int, request: EditFullTextRequest):
    """
    РЕЖИМ 2: Редактирование ВСЕГО текста статьи.

    Применяет инструкцию редактирования ко ВСЕМУ тексту статьи.

    Request: { "instruction": "Сделай текст более научным" }
    Response: { "id": 1, "title": "...", "content": "отредактированный текст..." }
    """
    try:
        logger.info(f"[EDIT_FULL] Получен запрос на редактирование всего текста. article_id={article_id}")
        logger.info(f"[EDIT_FULL] Инструкция: {request.instruction[:100]}...")

        # Получаем текущую статью
        article = get_article(article_id)
        if not article:
            logger.error(f"[EDIT_FULL] Статья с ID {article_id} не найдена")
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        logger.info(f"[EDIT_FULL] Статья найдена: {article['title']}, текст = {len(article['content'])} символов")

        # Вызываем LLM для редактирования
        logger.info(f"[EDIT_FULL] Вызываем LLM для редактирования всего текста")
        edited_text = edit_full_text(article['content'], request.instruction)

        # Обновляем статью в БД
        logger.info(f"[EDIT_FULL] Сохраняем отредактированный текст в БД")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE articles SET content = ? WHERE id = ?", (edited_text, article_id))
        conn.commit()
        conn.close()
        logger.info(f"[EDIT_FULL] Текст успешно сохранен в БД")

        # Возвращаем обновленную статью
        updated_article = get_article(article_id)
        logger.info(f"[EDIT_FULL] Возвращаем обновленную статью")
        return ArticleResponse(**updated_article)

    except HTTPException as e:
        logger.error(f"[EDIT_FULL] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[EDIT_FULL] Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при редактировании текста: {str(e)}")


@app.post("/api/articles/{article_id}/edit-fragment")
async def edit_article_fragment(article_id: int, request: EditFragmentRequest):
    """
    РЕЖИМ 3: Редактирование ВЫДЕЛЕННОГО ФРАГМЕНТА статьи.

    Применяет инструкцию только к выделенному фрагменту, сохраняя остальной текст.

    Request: {
        "before_context": "...",
        "fragment": "...",
        "after_context": "...",
        "instruction": "Раскрой подробнее"
    }
    Response: { "id": 1, "title": "...", "content": "обновленный текст..." }
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

        # Вызываем LLM для редактирования фрагмента
        logger.info(f"[EDIT_FRAGMENT] Вызываем LLM для редактирования фрагмента")
        edited_fragment = edit_fragment(
            request.before_context,
            request.fragment,
            request.after_context,
            request.instruction
        )

        # Заменяем фрагмент в тексте статьи
        logger.info(f"[EDIT_FRAGMENT] Заменяем фрагмент в тексте статьи")
        full_text = article['content']

        # Находим и заменяем фрагмент
        if request.fragment in full_text:
            updated_text = full_text.replace(request.fragment, edited_fragment, 1)
            logger.info(f"[EDIT_FRAGMENT] Фрагмент найден и заменен")
        else:
            logger.warning(f"[EDIT_FRAGMENT] Точное совпадение фрагмента не найдено, используем контекст")
            # Если точного совпадения нет, пытаемся найти по контексту
            before_idx = full_text.find(request.before_context)
            if before_idx >= 0:
                start = before_idx + len(request.before_context)
                end = full_text.find(request.after_context, start)
                if end >= start:
                    updated_text = full_text[:start] + edited_fragment + full_text[end:]
                    logger.info(f"[EDIT_FRAGMENT] Фрагмент найден по контексту и заменен")
                else:
                    logger.error(f"[EDIT_FRAGMENT] Не удалось найти фрагмент ни по точному совпадению, ни по контексту")
                    raise HTTPException(status_code=400, detail="Не удалось найти фрагмент в тексте")
            else:
                logger.error(f"[EDIT_FRAGMENT] Контекст не найден в тексте")
                raise HTTPException(status_code=400, detail="Контекст не найден в тексте")

        # Обновляем статью в БД
        logger.info(f"[EDIT_FRAGMENT] Сохраняем обновленный текст в БД")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE articles SET content = ? WHERE id = ?", (updated_text, article_id))
        conn.commit()
        conn.close()
        logger.info(f"[EDIT_FRAGMENT] Текст успешно сохранен в БД")

        # Возвращаем обновленную статью
        updated_article = get_article(article_id)
        logger.info(f"[EDIT_FRAGMENT] Возвращаем обновленную статью")
        return ArticleResponse(**updated_article)

    except HTTPException as e:
        logger.error(f"[EDIT_FRAGMENT] HTTPException: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"[EDIT_FRAGMENT] Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при редактировании фрагмента: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
