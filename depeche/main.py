from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from pydantic import BaseModel
import os
import sqlite3
from dotenv import load_dotenv

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
    init_db()


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


@app.post("/api/articles")
async def create_new_article(request: ArticleCreateRequest):
    """
    Создать новую ПУСТУЮ статью (без генерации плана).

    Request: { "topic": "Название статьи" }
    Response: { "id": 1, "title": "Название статьи", "content": "" }
    """
    try:
        title = request.topic.strip()

        if not title:
            raise HTTPException(status_code=400, detail="Название статьи не может быть пустым")

        # Создаём пустую статью - БЕЗ вызова LLM
        article = create_article(title=title, content="")

        return ArticleResponse(**article)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при создании статьи: {str(e)}")


@app.post("/api/articles/{article_id}/plan")
async def generate_and_save_plan(article_id: int, request: ArticleCreateRequest):
    """
    Генерирует план статьи по теме и сохраняет её содержимое.

    Request: { "topic": "Обезьяны в Африке" }
    Response: { "id": 1, "title": "...", "content": "1. ...\n2. ..." }
    """
    try:
        topic = request.topic.strip()

        if not topic:
            raise HTTPException(status_code=400, detail="Тема статьи не может быть пустой")

        # Проверяем существование статьи
        article = get_article(article_id)
        if not article:
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        # Генерируем план через LLM
        plan = generate_article_plan(topic)

        # Обновляем статью в БД с полученным планом
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE articles SET content = ? WHERE id = ?", (plan, article_id))
        conn.commit()
        conn.close()

        # Возвращаем обновлённую статью
        updated_article = get_article(article_id)
        return ArticleResponse(**updated_article)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации плана: {str(e)}")


@app.get("/api/articles")
async def get_articles_list():
    """
    Получить список всех статей для sidebar.

    Response: [{ "id": 1, "title": "Тема статьи" }, ...]
    """
    try:
        articles = get_all_articles()
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении списка статей: {str(e)}")


@app.get("/api/articles/{article_id}")
async def get_single_article(article_id: int):
    """
    Получить конкретную статью по ID.

    Response: { "id": 1, "title": "Тема", "content": "1. ...\n2. ..." }
    """
    try:
        article = get_article(article_id)

        if not article:
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        return ArticleResponse(**article)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении статьи: {str(e)}")


@app.delete("/api/articles/{article_id}")
async def delete_single_article(article_id: int):
    """
    Удалить статью по ID.

    Response: { "success": true, "message": "Статья удалена" }
    """
    try:
        success = delete_article(article_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"Статья с ID {article_id} не найдена")

        return {"success": True, "message": "Статья удалена"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении статьи: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
