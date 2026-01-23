import subprocess
import os
import threading

def start_listener():
    def run():
        try:
            subprocess.run(["python", "bot/listener.py"], check=True)
        except Exception as e:
            print(f"❌ Ошибка бота-слушателя: {e}")
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()