"""
MiniMax API Client - Вызовы к MiniMax для генерации видео
Поддерживает два режима: template и prompt
"""

import os
import base64
import asyncio
from typing import Optional, Dict, Any
import aiohttp

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
MINIMAX_API_URL = "https://api.minimax.io/v1"


class MinimaxVideoClient:
    """Клиент для работы с MiniMax Video API"""

    def __init__(self, api_key: str = None, callback_url: str = None):
        self.api_key = api_key or MINIMAX_API_KEY
        self.callback_url = callback_url or os.getenv("MINIMAX_CALLBACK_URL")
        self.timeout = aiohttp.ClientTimeout(total=30)

        # Логируем исходный callback_url
        print(f"[MINIMAX] __init__ raw callback_url from env: {self.callback_url}")

        # Убеждаемся что callback_url содержит полный путь к endpoint'у /minimax/callback
        # MiniMax требует точный URL, не базовый домен
        if self.callback_url:
            if not self.callback_url.endswith("/minimax/callback"):
                # Удаляем trailing slash и добавляем полный путь
                self.callback_url = self.callback_url.rstrip("/") + "/minimax/callback"
                print(f"[MINIMAX] ✅ Auto-completed callback_url: {self.callback_url}")
            else:
                print(f"[MINIMAX] ✅ callback_url already complete: {self.callback_url}")
        else:
            print(f"[MINIMAX] ⚠️ NO CALLBACK_URL! MINIMAX_CALLBACK_URL env var is not set or empty!")

        # Маппинг task_id (от MiniMax) -> generation_id (наш)
        # Используется для связи callback'ов с генерациями
        self.task_id_to_generation_id = {}

    # ============ IMAGE CONVERSION ============

    def _image_to_base64(self, image_path: str) -> str:
        """
        Конвертирует изображение в base64 Data URL

        Поддерживаемые форматы: JPEG, PNG, WebP
        Возвращает: data:image/..;base64,...
        """
        try:
            # Определяем MIME тип по расширению файла
            file_ext = image_path.lower().split('.')[-1]
            mime_map = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
            }
            mime_type = mime_map.get(file_ext, 'image/jpeg')

            print(f"[MINIMAX] Converting image: {image_path}")
            print(f"[MINIMAX]   - File extension: {file_ext}")
            print(f"[MINIMAX]   - MIME type: {mime_type}")

            # Читаем файл и конвертируем в base64
            with open(image_path, "rb") as f:
                image_data = f.read()

            file_size_kb = len(image_data) / 1024
            print(f"[MINIMAX]   - File size: {file_size_kb:.1f} KB")

            # Проверяем что размер не превышает 20MB (требование MiniMax)
            if len(image_data) > 20 * 1024 * 1024:
                raise ValueError(f"Image size {file_size_kb:.1f} KB exceeds 20MB limit")

            base64_data = base64.b64encode(image_data).decode("utf-8")
            data_url = f"data:{mime_type};base64,{base64_data}"

            # Логируем первые символы для проверки
            print(f"[MINIMAX]   - Data URL: {data_url[:80]}...")
            print(f"[MINIMAX] ✅ Image converted successfully")

            return data_url

        except Exception as e:
            print(f"[MINIMAX] ❌ Image conversion error: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    # ============ PROMPT MODE ============

    async def generate_from_prompt(
        self,
        image_path: str,
        prompt: str,
        duration: int = 6,
        generation_id: str = None,
    ) -> Dict[str, Any]:
        """
        Генерирует видео из фото + текстового промпта (PROMPT MODE)

        Args:
            image_path: Путь к JPEG файлу
            prompt: Текстовый промпт (с camera commands)
            duration: Длительность видео (6 или 10 сек)

        Returns:
            {
                "success": bool,
                "generation_id": str,
                "status": str,
                "cost": float,
                "error": str (if failed)
            }
        """
        try:
            # Проверяем что API ключ установлен
            if not self.api_key:
                raise RuntimeError(
                    "[MINIMAX] ❌ ОШИБКА: MINIMAX_API_KEY не установлен!\n"
                    "Убедитесь что .env файл содержит MINIMAX_API_KEY=sk-..."
                )

            image_data_url = self._image_to_base64(image_path)

            # Формируем payload согласно OpenAPI спецификации
            # https://platform.minimax.io/docs/api-reference/video-generation/image-to-video
            payload = {
                "model": "MiniMax-Hailuo-02",
                "first_frame_image": image_data_url,
                "prompt": prompt,
                "duration": duration,
                "resolution": "768P",
                "prompt_optimizer": False,  # Отключаем оптимизатор (у нас уже есть prompt_enhancer)
            }

            # Добавляем callback_url если он сконфигурирован
            if self.callback_url:
                payload["callback_url"] = self.callback_url
                print(f"[MINIMAX] ✅ Adding callback_url to payload: {self.callback_url}")
            else:
                print(f"[MINIMAX] ❌ NO callback_url! Will NOT add to payload! MINIMAX_CALLBACK_URL env var not set")

            # Логируем payload (для отладки)
            print(f"[MINIMAX] Sending request to /video_generation")
            print(f"[MINIMAX] Payload details:")
            print(f"[MINIMAX]   - model: {payload['model']}")
            print(f"[MINIMAX]   - first_frame_image: {image_data_url[:80]}...")
            print(f"[MINIMAX]   - prompt: {payload['prompt'][:100]}...")
            print(f"[MINIMAX]   - duration: {payload['duration']} sec")
            print(f"[MINIMAX]   - resolution: {payload['resolution']}")
            print(f"[MINIMAX]   - prompt_optimizer: {payload['prompt_optimizer']}")
            print(f"[MINIMAX]   - callback_url: {payload.get('callback_url', 'NOT SET!')}")

            print(f"[MINIMAX] Sending request...")
            response = await self._post_to_minimax("/video_generation", payload)

            # Логируем полный ответ для отладки
            print(f"[MINIMAX] Raw response: {response}")

            # Проверяем успешность по status_code в base_resp (по документации)
            base_resp = response.get("base_resp", {})
            status_code = base_resp.get("status_code")

            print(f"[MINIMAX] Extracted status_code={status_code}, base_resp={base_resp}")

            if status_code == 0:  # 0 = успех по документации
                minimax_task_id = response.get("task_id")
                print(f"[MINIMAX] ✅ Prompt mode - generation started: task_id={minimax_task_id}")

                # ВАЖНО: Сохраняем маппинг task_id -> generation_id для callback'ов
                if generation_id and minimax_task_id:
                    self.task_id_to_generation_id[minimax_task_id] = generation_id
                    print(f"[MINIMAX] Mapped task_id {minimax_task_id} -> generation_id {generation_id}")

                return {
                    "success": True,
                    "generation_id": minimax_task_id,  # Возвращаем task_id как generation_id
                    "status": "queued",
                    "cost": response.get("cost", 0),
                }
            else:
                error_msg = base_resp.get("status_msg") or response.get("message") or response.get("error") or f"Unknown error (status_code={status_code})"
                print(f"[MINIMAX] ❌ Error: {error_msg}")
                print(f"[MINIMAX] Full base_resp: {base_resp}")
                print(f"[MINIMAX] Full response: {response}")
                return {
                    "success": False,
                    "generation_id": None,
                    "status": "failed",
                    "error": error_msg,
                }

        except Exception as e:
            print(f"[MINIMAX] ❌ Prompt mode exception: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "generation_id": None,
                "status": "error",
                "error": str(e),
            }

    # ============ FILE RETRIEVAL ============

    async def get_file_download_url(self, file_id: str) -> Dict[str, Any]:
        """
        Получить download_url по file_id (как в шаблоне кода)

        Returns:
            {
                "success": bool,
                "download_url": str (if success),
                "error": str (if failed)
            }
        """
        try:
            print(f"[MINIMAX] Getting download URL for file_id: {file_id}")

            response = await self._get_from_minimax("/files/retrieve", {"file_id": file_id})

            # Пытаемся найти download_url в разных местах
            download_url = (
                response.get("file", {}).get("download_url")
                or response.get("download_url")
            )

            if download_url:
                print(f"[MINIMAX] Got download URL: {download_url}")
                return {
                    "success": True,
                    "download_url": download_url,
                }
            else:
                error = f"No download_url in response: {response}"
                print(f"[MINIMAX] Error: {error}")
                return {
                    "success": False,
                    "error": error,
                }

        except Exception as e:
            print(f"[MINIMAX] Exception getting download URL: {str(e)}")
            return {
                "success": False,
                "error": str(e),
            }

    # ============ STATUS CHECKING ============

    async def get_generation_status(self, generation_id: str) -> Dict[str, Any]:
        """
        Получить статус генерации

        Returns:
            {
                "success": bool,
                "generation_id": str,
                "status": "processing" | "done" | "failed",
                "video_url": str (if done),
                "error": str (if failed)
            }
        """
        try:
            params = {"task_id": generation_id}

            response = await self._get_from_minimax("/video_generation", params)

            status = response.get("status", "processing").lower()
            # Нормализуем статусы
            if status in ["success", "complete"]:
                status = "done"

            result = {
                "success": True,
                "generation_id": generation_id,
                "status": status,
            }

            # Если готово - добавляем URL видео
            if status == "done":
                video_url = response.get("data", {}).get("video_url") or response.get("video_url")
                result["video_url"] = video_url

            # Если ошибка - добавляем сообщение
            if status == "failed":
                result["error"] = response.get("message", "Generation failed")

            print(f"[MINIMAX] Status check - {generation_id}: {status}")
            return result

        except Exception as e:
            print(f"[MINIMAX] Status check exception: {str(e)}")
            return {
                "success": False,
                "generation_id": generation_id,
                "status": "error",
                "error": str(e),
            }

    # ============ VIDEO DOWNLOAD ============

    async def download_video(self, video_url: str, output_path: str) -> bool:
        """
        Скачивает видео по URL

        Args:
            video_url: URL видео
            output_path: Путь для сохранения

        Returns:
            bool: True если успешно, False если ошибка
        """
        try:
            # Если локальный путь - копируем напрямую
            if video_url.startswith("/storage"):
                import shutil

                file_path = video_url.replace(
                    "/storage", os.path.join(os.getcwd(), "storage")
                )
                if os.path.exists(file_path):
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    shutil.copy(file_path, output_path)
                    print(f"[MINIMAX] Video copied from local: {output_path}")
                    return True

            # Иначе скачиваем по HTTP
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(video_url) as resp:
                    if resp.status == 200:
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        with open(output_path, "wb") as f:
                            f.write(await resp.read())
                        print(f"[MINIMAX] Video downloaded: {output_path}")
                        return True
                    else:
                        print(f"[MINIMAX] Download failed: HTTP {resp.status}")
                        return False

        except Exception as e:
            print(f"[MINIMAX] Download exception: {str(e)}")
            return False

    # ============ PRIVATE METHODS ============

    async def _post_to_minimax(self, endpoint: str, payload: Dict) -> Dict:
        """Отправляет POST запрос к MiniMax API"""
        import json

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        url = f"{MINIMAX_API_URL}{endpoint}"
        print(f"[MINIMAX] POST {url}")

        # Логируем payload (исключая длинную base64 строку)
        payload_for_logging = dict(payload)
        if "first_frame_image" in payload_for_logging:
            # Обрезаем base64 для читаемости логов
            payload_for_logging["first_frame_image"] = (
                payload_for_logging["first_frame_image"][:100] + "..."
            )

        print(f"[MINIMAX] REQUEST BODY:")
        print(f"[MINIMAX] {json.dumps(payload_for_logging, indent=2)}")

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                url,
                json=payload,
                headers=headers,
            ) as resp:
                print(f"[MINIMAX] RESPONSE STATUS: {resp.status}")

                response_data = await resp.json()

                print(f"[MINIMAX] RESPONSE BODY:")
                print(f"[MINIMAX] {json.dumps(response_data, indent=2, ensure_ascii=False)}")

                return response_data

    async def _get_from_minimax(self, endpoint: str, params: Dict) -> Dict:
        """Отправляет GET запрос к MiniMax API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        url = f"{MINIMAX_API_URL}{endpoint}"
        print(f"[MINIMAX] GET {url} params={params}")

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.get(
                url,
                params=params,
                headers=headers,
            ) as resp:
                print(f"[MINIMAX] GET response status: {resp.status}")
                response_data = await resp.json()
                print(f"[MINIMAX] GET response body: {response_data}")
                return response_data

    # ============ HEALTH CHECK ============

    async def check_health(self) -> bool:
        """Проверить доступность MiniMax API"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get(f"{MINIMAX_API_URL}/status") as resp:
                    return resp.status == 200
        except:
            return False


# Глобальный экземпляр (создается при импорте minimax.py)
print(f"[MINIMAX] Creating global minimax_client instance...")
minimax_client = MinimaxVideoClient()
print(f"[MINIMAX] ✅ Global minimax_client created successfully")
