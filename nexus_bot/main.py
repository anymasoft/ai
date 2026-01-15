"""
FastAPI сервер для Telegram-бота
Запускает бота + видео-движок в фоне и предоставляет endpoints
"""

# ⚠️ КРИТИЧНО: Загружаем .env ДО всех остальных импортов!
# Иначе prompts.py не сможет инициализировать OpenAI клиент
import os
import dotenv
dotenv.load_dotenv()

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from bot import run_bot
from state import state_manager
from core.video_engine import start_video_engine


# Глобальные переменные для задач
bot_task = None
engine_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global bot_task, engine_task

    print("[MAIN] FastAPI server starting...")

    # Запускаем видео-движок при старте сервера
    await start_video_engine()
    engine_task = asyncio.create_task(asyncio.sleep(3600))  # Фоновая задача

    # Запускаем бота при старте сервера
    bot_task = asyncio.create_task(run_bot())

    # Запускаем периодическую очистку состояний
    cleanup_task = asyncio.create_task(state_manager.start_cleanup_task())

    print("[MAIN] ✅ Server ready (video engine + bot running)")

    try:
        yield
    finally:
        print("[MAIN] Shutting down...")
        if bot_task:
            bot_task.cancel()
            try:
                await bot_task
            except asyncio.CancelledError:
                pass
        if engine_task:
            engine_task.cancel()
            try:
                await engine_task
            except asyncio.CancelledError:
                pass
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


# Создаём FastAPI приложение
app = FastAPI(
    title="Beem Telegram Bot",
    description="Telegram-бот для генерации видео",
    version="1.0.0",
    lifespan=lifespan,
)


# ============ HEALTH CHECK ============


@app.get("/", response_class=JSONResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "nexus_bot",
        "version": "1.0.0",
        "active_users": state_manager.get_active_count(),
    }


@app.get("/health", response_class=JSONResponse)
async def health():
    """Расширенный health check"""
    return {
        "status": "healthy",
        "bot_running": bot_task is not None and not bot_task.done(),
        "active_users": state_manager.get_active_count(),
    }


# ============ MINIMAX CALLBACK ============


@app.post("/minimax/callback", response_class=JSONResponse)
async def minimax_callback(request: Request):
    """Получение callback от MiniMax когда видео готово"""
    try:
        data = await request.json()
        print(f"[MINIMAX-CALLBACK] Received: {data}")

        # MiniMax verification challenge
        if "challenge" in data:
            print(f"[MINIMAX-CALLBACK] Verification challenge received")
            return {"challenge": data["challenge"]}

        # Обрабатываем результат генерации
        status = data.get("status")
        task_id = data.get("task_id")
        file_id = data.get("file_id")

        if status == "success":
            print(f"[MINIMAX-CALLBACK] Success: task_id={task_id}, file_id={file_id}")
            return {"ok": True}
        elif status == "failed":
            print(f"[MINIMAX-CALLBACK] Failed: {data.get('message', 'Unknown error')}")
            return {"ok": False}
        else:
            print(f"[MINIMAX-CALLBACK] Unknown status: {status}")
            return {"ok": True}

    except Exception as e:
        print(f"[MINIMAX-CALLBACK] Error processing callback: {str(e)}")
        return {"ok": False, "error": str(e)}


# ============ DEBUG ENDPOINTS ============


@app.get("/debug/state", response_class=JSONResponse)
async def debug_state():
    """Debug endpoint - показать текущие состояния пользователей"""
    states = {}
    for user_id, state in state_manager.states.items():
        states[str(user_id)] = {
            "step": state.step,
            "photo_path": state.photo_path,
            "prompt_text": state.prompt_text[:50] + "..." if state.prompt_text else None,
            "last_generation_id": state.last_generation_id,
            "last_generation_status": state.last_generation_status,
        }
    return {"total_users": len(states), "states": states}


# ============ STARTUP MESSAGE ============


@app.on_event("startup")
async def startup_message():
    """Сообщение при старте"""
    print("\n" + "=" * 60)
    print("🚀 TELEGRAM BOT SERVER STARTED")
    print("=" * 60)
    print(f"📍 Base URL: http://localhost:8000")
    print(f"📍 Docs: http://localhost:8000/docs")
    print(f"🤖 Bot Token: {os.getenv('TELEGRAM_BOT_TOKEN', '(not set)')[:20]}...")
    print(f"🎯 Beem API: {os.getenv('BEEM_BASE_URL', 'http://localhost:4321')}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("BOT_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
