"""
Camera Director - Фаза 2 обработки промптов
Компиляция camera commands через GPT + валидация PRESERVE constraints
"""

import os
import re
import asyncio
from typing import List, Tuple
import openai

# Инициализируем OpenAI клиент
openai.api_key = os.getenv("OPENAI_API_KEY")

# Валидные 15 MiniMax camera команд
VALID_CAMERA_COMMANDS = {
    "[Truck left]",
    "[Truck right]",
    "[Pan left]",
    "[Pan right]",
    "[Push in]",
    "[Pull out]",
    "[Pedestal up]",
    "[Pedestal down]",
    "[Tilt up]",
    "[Tilt down]",
    "[Zoom in]",
    "[Zoom out]",
    "[Shake]",
    "[Tracking shot]",
    "[Static shot]",
}

# Constraints keywords, которые требуют ТОЛЬКО [Static shot]
STATIC_ONLY_KEYWORDS = {
    "text", "background", "banner", "price",
    "overlay", "typography", "label", "caption"
}


class CameraDirector:
    """Director для компиляции camera commands"""

    def __init__(self):
        self.model = "gpt-4o-mini"
        self.max_retries = 3
        self.timeout = 12  # сек

    # ============ DETECTION & PARSING ============

    def _extract_no_generation_block(self, prompt: str) -> Tuple[str, str]:
        """
        Извлекает NO_GENERATION блок из промпта
        Возвращает: (prompt_clean, no_generation_block)
        """
        pattern = r'NO_GENERATION:\s*(.+?)(?=\n\n|\Z)'
        match = re.search(pattern, prompt, re.DOTALL)

        if match:
            no_gen_block = match.group(1).strip()
            prompt_clean = re.sub(pattern, '', prompt, flags=re.DOTALL).strip()
            print(f"[CAMERA-DIRECTOR] Extracted NO_GENERATION block")
            return prompt_clean, no_gen_block

        return prompt, ""

    def _extract_preserve_keywords(self, prompt: str) -> List[str]:
        """
        Извлекает keywords из NO_GENERATION / PRESERVE блока
        """
        # Ищем NO_GENERATION блок
        no_gen_pattern = r'NO_GENERATION:\s*(.+?)(?=\n\n|\Z)'
        match = re.search(no_gen_pattern, prompt, re.DOTALL)

        if match:
            text = match.group(1)
            # Извлекаем keywords, разделенные запятыми
            keywords = [kw.strip().lower() for kw in text.split(",")]
            return keywords

        return []

    def _should_use_static_only(self, prompt: str) -> bool:
        """
        Проверяет, нужно ли использовать ТОЛЬКО [Static shot]
        Это верно если PRESERVE содержит конкретные keywords
        """
        preserve_keywords = self._extract_preserve_keywords(prompt)

        for keyword in preserve_keywords:
            if any(static_kw in keyword for static_kw in STATIC_ONLY_KEYWORDS):
                print(f"[CAMERA-DIRECTOR] PRESERVE requires [Static shot] only (keyword: {keyword})")
                return True

        return False

    # ============ COMPILATION PHASE ============

    async def compile_camera_commands(self, prompt: str) -> str:
        """
        Компилирует camera commands через GPT
        Возвращает промпт с встроенными camera commands
        """
        # Проверяем нужны ли constraints
        should_static_only = self._should_use_static_only(prompt)

        if should_static_only:
            print("[CAMERA-DIRECTOR] Applying STATIC SHOT ONLY (PRESERVE constraint)")
            prompt_with_commands = prompt + "\n\n[Static shot]"
            return await self._sanitize_camera_commands(prompt_with_commands)

        # Нормальная компиляция через GPT
        system_message = """Ты — cinematic director для видео-генерации (MiniMax).

Добавляй camera movement commands из этого списка:
[Truck left], [Truck right]
[Pan left], [Pan right]
[Push in], [Pull out]
[Pedestal up], [Pedestal down]
[Tilt up], [Tilt down]
[Zoom in], [Zoom out]
[Shake], [Tracking shot], [Static shot]

Правила:
1. Добавляй 1-3 camera commands в конец промпта
2. Каждую команду на отдельной строке
3. Выбирай команды которые соответствуют описанию сцены
4. НИКАКИХ других текстов, ТОЛЬКО команды

Пример output:
[Pan left]
[Push in]"""

        user_message = f"""Добавь camera movement commands для этого видео-промпта:

{prompt}

Output: ТОЛЬКО camera commands (1-3 команды на отдельных строках)"""

        try:
            response = await asyncio.wait_for(
                self._call_openai(system_message, user_message),
                timeout=self.timeout,
            )

            # Добавляем commands к промпту
            prompt_with_commands = f"{prompt}\n\n{response}"

            # Санитизируем (проверяем что только валидные команды)
            return await self._sanitize_camera_commands(prompt_with_commands)

        except asyncio.TimeoutError:
            print("[CAMERA-DIRECTOR] ⚠️ GPT timeout, using original prompt")
            return prompt

        except Exception as e:
            print(f"[CAMERA-DIRECTOR] Error: {str(e)}")
            return prompt

    # ============ SANITIZATION PHASE ============

    async def _sanitize_camera_commands(self, prompt: str) -> str:
        """
        Удаляет невалидные camera commands из промпта
        Оставляет только валидные из VALID_CAMERA_COMMANDS
        """
        lines = prompt.split("\n")
        cleaned_lines = []
        found_commands = False

        for line in lines:
            line_stripped = line.strip()

            # Проверяем что это camera command
            is_command = any(cmd in line_stripped for cmd in VALID_CAMERA_COMMANDS)

            if is_command:
                # Извлекаем и проверяем точное совпадение
                for valid_cmd in VALID_CAMERA_COMMANDS:
                    if valid_cmd.lower() in line_stripped.lower():
                        cleaned_lines.append(valid_cmd)
                        found_commands = True
                        break
            else:
                # Обычная строка - добавляем как есть
                cleaned_lines.append(line)

        if found_commands:
            print("[CAMERA-DIRECTOR] Sanitized camera commands")

        return "\n".join(cleaned_lines).strip()

    # ============ CONSTRAINTS ENFORCEMENT ============

    def enforce_preserve_constraints(self, prompt: str) -> str:
        """
        Принудительно применяет PRESERVE constraints
        Если есть NO_GENERATION с keywords → ТОЛЬКО [Static shot]
        """
        should_static_only = self._should_use_static_only(prompt)

        if should_static_only:
            # Удаляем все camera commands кроме [Static shot]
            prompt_clean = re.sub(r'\[(?!Static shot\])[^\]]+\]', '', prompt)
            # Убеждаемся что есть [Static shot]
            if "[Static shot]" not in prompt_clean:
                prompt_clean += "\n\n[Static shot]"

            print("[CAMERA-DIRECTOR] Enforced PRESERVE constraints - [Static shot] only")
            return prompt_clean

        return prompt

    # ============ PRIVATE METHODS ============

    async def _call_openai(self, system: str, user: str) -> str:
        """Вызов OpenAI API (с retry logic)"""
        for attempt in range(self.max_retries):
            try:
                response = await asyncio.to_thread(
                    openai.ChatCompletion.create,
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    temperature=0.5,
                    max_tokens=100,
                )
                return response.choices[0].message.content

            except Exception as e:
                print(f"[CAMERA-DIRECTOR] OpenAI attempt {attempt + 1} failed: {str(e)}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise

    # ============ PUBLIC API ============

    async def compile(self, prompt: str) -> str:
        """
        Главная функция компиляции camera commands
        """
        print("[CAMERA-DIRECTOR] Starting camera command compilation")

        # Фаза 1: Проверяем PRESERVE constraints
        self.enforce_preserve_constraints(prompt)

        # Фаза 2: Компилируем camera commands (или используем [Static shot])
        result = await self.compile_camera_commands(prompt)

        print("[CAMERA-DIRECTOR] ✅ Camera commands compiled")
        return result


# Глобальный экземпляр
camera_director = CameraDirector()
