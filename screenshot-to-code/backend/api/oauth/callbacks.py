from datetime import datetime
from db.sqlite import get_conn
from api.oauth.config import ADMIN_EMAIL


async def handle_oauth_signin(user_id: str, email: str, name: str):
    """
    Обработка Google OAuth signin callback.

    Логика переносится 1-в-1 из YouTubeAnalytics:
    - Проверяет, существует ли пользователь в БД
    - Если нет → создает новую запись с role='user', plan='free'
    - Если существует и disabled=1 → отклоняет (raise exception)
    - Возвращает user данные для JWT token

    Args:
        user_id: Google User ID
        email: Google User Email
        name: Google User Name

    Returns:
        dict: {id, email, name, role}

    Raises:
        Exception: если пользователь отключен (disabled=1)
    """
    if not user_id or not email:
        raise ValueError("Missing required user info from Google (id, email)")

    conn = get_conn()
    cursor = conn.cursor()

    try:
        # Проверяем, существует ли пользователь в БД
        cursor.execute("SELECT id, disabled FROM users WHERE id = ?", (user_id,))
        existing_user = cursor.fetchone()

        if existing_user is None:
            # ЛОГИКА ИЗ YouTubeAnalytics: Создаём нового пользователя
            now_iso = datetime.utcnow().isoformat()
            display_name = name or email.split("@")[0]

            cursor.execute(
                """
                INSERT INTO users (id, email, name, role, plan, disabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    email,
                    display_name,
                    "user",  # role default
                    "free",  # plan default
                    0,  # disabled=0 (active)
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()
        else:
            # ЛОГИКА ИЗ YouTubeAnalytics: Проверяем, не отключен ли пользователь
            if existing_user[1] == 1 or existing_user[1] is True:
                raise Exception(f"User is disabled: {email}")

        # Возвращаем user данные для создания JWT
        return {
            "id": user_id,
            "email": email,
            "name": name or email.split("@")[0],
            "role": "admin" if email == ADMIN_EMAIL else "user",
        }

    finally:
        conn.close()
