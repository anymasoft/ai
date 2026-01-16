"""
FastAPI сервер для Telegram-бота
Запускает бота + видео-движок в фоне и предоставляет endpoints
"""

# ⚠️ КРИТИЧНО: Загружаем .env ДО всех остальных импортов!
# Иначе prompts.py не сможет инициализировать OpenAI клиент
import os
import dotenv
dotenv.load_dotenv()

# Логируем что .env загружена
print(f"[MAIN] .env loaded")
print(f"[MAIN] MINIMAX_CALLBACK_URL from env: {os.getenv('MINIMAX_CALLBACK_URL')}")

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from bot import run_bot
from state import state_manager
from core.video_engine import start_video_engine, video_engine
from core.minimax import minimax_client
from core.payments import process_webhook, log_payment
from core.db import init_db, confirm_payment, get_payment


# Глобальные переменные для задач
bot_task = None
engine_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global bot_task, engine_task

    print("[MAIN] FastAPI server starting...")

    # Инициализируем БД
    init_db()
    print("[MAIN] Database initialized")

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
    """Получение callback от MiniMax (по документации)"""
    try:
        # Логируем все заголовки для диагностики
        print(f"[MINIMAX-CALLBACK] Request headers: {dict(request.headers)}")

        data = await request.json()
        print(f"[MINIMAX-CALLBACK] Received: {data}")

        # Step 1: MiniMax verification challenge (обязательный для безопасности)
        if "challenge" in data:
            print(f"[MINIMAX-CALLBACK] 🔐 Verification challenge received")
            return {"challenge": data["challenge"]}

        # Step 2: Получаем task_id из callback'а
        task_id = str(data.get("task_id"))  # ⚠️ ВАЖНО: преобразуем в строку!
        status = data.get("status")
        file_id = data.get("file_id")

        print(f"[MINIMAX-CALLBACK] Processing: task_id={task_id}, status={status}, file_id={file_id}")

        # Step 3: Преобразуем task_id в наш generation_id используя маппинг
        generation_id = minimax_client.task_id_to_generation_id.get(task_id)

        if not generation_id:
            error_msg = f"Unknown task_id: {task_id}"
            print(f"[MINIMAX-CALLBACK] ⚠️ {error_msg}")
            return {"ok": False, "error": error_msg}

        print(f"[MINIMAX-CALLBACK] Mapped task_id {task_id} -> generation_id {generation_id}")

        # Step 4: Обрабатываем результат генерации
        if status == "success":
            # Получить download_url по file_id (как в шаблоне кода)
            if not file_id:
                error_msg = "No file_id in callback"
                print(f"[MINIMAX-CALLBACK] ❌ Error: {error_msg}")
                if generation_id in video_engine._generation_status:
                    video_engine._generation_status[generation_id]["minimax_error"] = error_msg
                return {"ok": False, "error": error_msg}

            print(f"[MINIMAX-CALLBACK] Step 1: Getting download URL for file_id: {file_id}")
            file_response = await minimax_client.get_file_download_url(file_id)

            if not file_response.get("success"):
                error_msg = file_response.get("error", "Failed to get download URL")
                print(f"[MINIMAX-CALLBACK] ❌ Error: {error_msg}")
                if generation_id in video_engine._generation_status:
                    video_engine._generation_status[generation_id]["minimax_error"] = error_msg
                return {"ok": False, "error": error_msg}

            download_url = file_response.get("download_url")
            print(f"[MINIMAX-CALLBACK] Step 2: Got download URL: {download_url}")

            # Step 3: Скачиваем видео (как в шаблоне кода)
            print(f"[MINIMAX-CALLBACK] Step 3: Downloading video...")
            video_path = os.path.join(video_engine.temp_dir, f"{generation_id}.mp4")

            success = await minimax_client.download_video(download_url, video_path)
            if not success:
                error_msg = "Failed to download video"
                print(f"[MINIMAX-CALLBACK] ❌ Error: {error_msg}")
                if generation_id in video_engine._generation_status:
                    video_engine._generation_status[generation_id]["minimax_error"] = error_msg
                return {"ok": False, "error": error_msg}

            # Step 4: Обновляем статус на "done"
            if generation_id in video_engine._generation_status:
                video_engine._generation_status[generation_id].update({
                    "status": "done",
                    "video_path": video_path,
                    "video_url": download_url,
                    "minimax_task_id": task_id,
                    "minimax_file_id": file_id,
                    "completed_at": datetime.now(),
                })
                print(f"[MINIMAX-CALLBACK] ✅ Generation complete: {generation_id}")
            else:
                print(f"[MINIMAX-CALLBACK] ⚠️ Generation not found in status dict: {generation_id}")

            return {"ok": True}

        elif status == "processing":
            # Обновляем только что идет обработка
            if generation_id in video_engine._generation_status:
                video_engine._generation_status[generation_id]["minimax_status"] = "processing"
                print(f"[MINIMAX-CALLBACK] ⏳ Generation still processing: {generation_id}")

            return {"ok": True}

        elif status == "failed":
            # Обрабатываем ошибку
            base_resp = data.get("base_resp", {})
            error_msg = base_resp.get("status_msg", data.get("message", "Unknown error"))
            print(f"[MINIMAX-CALLBACK] ❌ Generation failed: {generation_id}, error={error_msg}")

            # Обновляем статус с ошибкой
            if generation_id in video_engine._generation_status:
                video_engine._generation_status[generation_id].update({
                    "minimax_status": "failed",
                    "minimax_error": error_msg,
                })
                print(f"[MINIMAX-CALLBACK] Updated generation error: {generation_id}")

            return {"ok": False, "error": error_msg}

        else:
            print(f"[MINIMAX-CALLBACK] ⚠️ Unknown status: {status}")
            return {"ok": True}

    except Exception as e:
        print(f"[MINIMAX-CALLBACK] ❌ Error processing callback: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"ok": False, "error": str(e)}


# ============ YOOKASSA WEBHOOK ============


@app.post("/yookassa/webhook", response_class=JSONResponse)
async def yookassa_webhook(request: Request):
    """Получение webhook от YooKassa при успешной оплате"""
    try:
        print(f"[YOOKASSA-WEBHOOK] Received webhook")

        # Получаем body для проверки подписи
        body = await request.body()
        body_str = body.decode('utf-8')

        # Получаем заголовок с подписью
        signature = request.headers.get("X-Yookassa-Signature", "")

        print(f"[YOOKASSA-WEBHOOK] Signature header present: {bool(signature)}")

        # Парсим JSON
        try:
            payload = await request.json()
        except Exception as e:
            print(f"[YOOKASSA-WEBHOOK] ❌ Failed to parse JSON: {str(e)}")
            return {"ok": False, "error": "Invalid JSON"}

        # Обрабатываем webhook (это проверит тип события и метаданные)
        result = process_webhook(payload)

        if not result:
            # Платёж не успешен или это не payment.succeeded событие
            print(f"[YOOKASSA-WEBHOOK] Event not processed (not payment.succeeded or already processed)")
            return {"ok": True}

        # 🎉 Платёж успешен! Начисляем видео через БД
        user_id = result["user_id"]
        videos_count = result["videos_count"]
        payment_id = result["payment_id"]

        # Подтверждаем платёж в БД (включает зачисление видео + проверку дублирования)
        if confirm_payment(payment_id):
            payment = get_payment(payment_id)
            log_payment(
                "SUCCESS",
                f"Payment confirmed and credited",
                {
                    "user_id": user_id,
                    "payment_id": payment_id,
                    "videos_added": videos_count
                }
            )
            print(f"[YOOKASSA-WEBHOOK] ✅ User {user_id} credited with {videos_count} videos")
        else:
            log_payment("WARNING", f"Payment was already processed or not found", {"payment_id": payment_id})
            print(f"[YOOKASSA-WEBHOOK] ⚠️ Payment {payment_id} already processed or not found")

        return {"ok": True}

    except Exception as e:
        log_payment("ERROR", f"Exception in webhook handler: {str(e)}")
        print(f"[YOOKASSA-WEBHOOK] ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

        # Возвращаем OK чтобы YooKassa не повторял попытку
        return {"ok": True}


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
