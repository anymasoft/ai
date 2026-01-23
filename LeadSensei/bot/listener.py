from pyrogram import Client, filters
from config import API_ID, API_HASH, ACCOUNT, DONORS_IDS
import requests
import os

BACKEND_URL = "http://127.0.0.1:8000/api/lead"

app = Client(ACCOUNT, api_id=API_ID, api_hash=API_HASH)

@app.on_message(filters.chat(chats=DONORS_IDS))
async def forward_handler(client, message):
    try:
        data = {
            "user_id": 1,  # В реальности — определяется по чату
            "chat_id": message.chat.id,
            "chat_title": message.chat.title,
            "full_name_in_chat": f"{message.from_user.first_name} {message.from_user.last_name or ''}",
            "username_in_chat": message.from_user.username,
            "text": message.text or message.caption,
            "date": message.date.isoformat(),
            "link": f"https://t.me/{message.chat.username}/{message.id}"
        }
        requests.post(BACKEND_URL, json=data)
    except Exception as e:
        print(f"Ошибка: {e}")

app.run()