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
from llm import generate_article_plan

# Инициализируем FastAPI приложение
app = FastAPI(title="Depeche - AI Article Editor")

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
