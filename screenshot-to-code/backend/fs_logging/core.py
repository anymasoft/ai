from datetime import datetime
import json
import os
import hashlib
from openai.types.chat import ChatCompletionMessageParam


def write_logs(prompt_messages: list[ChatCompletionMessageParam], completion: str):
    # 🔒 SECURITY: Логирование БЕЗ base64 изображений
    # Сохраняем только текстовые промпты и метаданные изображений

    # Get the logs path from environment, default to the current working directory
    logs_path = os.environ.get("LOGS_PATH", os.getcwd())

    # Create run_logs directory if it doesn't exist within the specified logs path
    logs_directory = os.path.join(logs_path, "run_logs")
    if not os.path.exists(logs_directory):
        os.makedirs(logs_directory)

    print("Writing to logs directory:", logs_directory)

    # Generate a unique filename using the current timestamp within the logs directory
    filename = datetime.now().strftime(f"{logs_directory}/messages_%Y%m%d_%H%M%S.json")

    # Очистить промпты: удалить base64 изображения, сохранить только metadata
    sanitized_messages = []
    for msg in prompt_messages:
        if isinstance(msg, dict):
            sanitized_msg = {"role": msg.get("role"), "content": []}

            # Обработать содержимое сообщения
            if isinstance(msg.get("content"), list):
                for content_item in msg.get("content", []):
                    if isinstance(content_item, dict):
                        if content_item.get("type") == "text":
                            # Сохранить текстовое содержимое
                            sanitized_msg["content"].append(content_item)
                        elif content_item.get("type") == "image_url":
                            # ❌ НЕ сохранять base64 изображение
                            # ✅ Вместо этого: сохранить только metadata
                            image_url = content_item.get("image_url", {}).get("url", "")
                            if image_url:
                                # Вычислить хеш изображения (если это data URL)
                                image_hash = hashlib.sha256(image_url.encode()).hexdigest()[:16]
                                sanitized_msg["content"].append({
                                    "type": "image_metadata",
                                    "hash": image_hash,
                                    "is_data_url": image_url.startswith("data:"),
                                })
                    else:
                        sanitized_msg["content"].append(content_item)

            sanitized_messages.append(sanitized_msg)
        else:
            sanitized_messages.append(msg)

    # Обрезать completion если он слишком большой (max 5KB для логов)
    truncated_completion = completion[:5000] if len(completion) > 5000 else completion

    # TODO: Реализовать TTL для логов (auto-delete через 30 дней)
    # TODO: Добавить encryption для логов, если нужна защита от disk access

    # Write the sanitized messages dict into a new file for each run
    with open(filename, "w") as f:
        log_data = {
            "prompt_metadata": {
                "num_messages": len(sanitized_messages),
                "has_images": any("image_metadata" in str(msg) for msg in sanitized_messages),
            },
            "prompt": sanitized_messages,
            "completion_preview": truncated_completion[:1000],  # Только первые 1KB
            "completion_length": len(completion),
        }
        f.write(json.dumps(log_data, indent=2))
