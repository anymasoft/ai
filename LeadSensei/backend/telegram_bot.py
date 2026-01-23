from pyrogram import Client
import os

def send_telegram_notification(user_id, lead, analysis):
    bot_token = get_setting("telegram.bot_token")
    user_tg_id = get_setting(f"user.{user_id}.telegram_id")  # Допустим, хранится
    if not bot_token or not user_tg_id:
        return

    bot = Client("notification_bot", bot_token=bot_token)
    with bot:
        message = f"""
🆕 Новый лид:
💬 "{lead['text'][:100]}..."
👤 {lead['full_name_in_chat']} (@{lead['username_in_chat']})
📍 {lead['chat_title']}
🔗 {lead['link']}
🎯 Релевантность: {analysis['confidence']:.0%}
📌 Причина: {analysis['reason']}
"""
        bot.send_message(user_tg_id, message)