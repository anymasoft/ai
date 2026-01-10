# Video Reader AI — Chrome Extension + AI SaaS

**Перевод субтитров YouTube, транскрибация, анализ, генерация статей и озвучка**

## 🚀 О проекте

Video Reader AI — это инструмент для работы с YouTube-видео:

- **перевод субтитров в реальном времени**
- **эффект "karaoke highlighting"**
- **экспорт в SRT / VTT / TXT**
- **анализ видео**: summary, статья, таймкоды
- **перевод и генерация озвучки** (ElevenLabs)
- **готовая CMS + SaaS-приложение** (app.beem.ink)
- **тарифы**: Free → Pro → Premium

**Технологический стек:**
- **Бэкенд**: Flask
- **Фронтенд**: Astro
- **База**: SQLite
- **Платежи**: ЮKassa
- **Авторизация**: Google OAuth
- **Продакшн-деплой**: Nginx + systemd

## 📦 Структура репозитория

```
root/
│── extension/                 # Chrome Extension
│── server/                    # Flask API
│── users.db                   # User DB
│── translations.db            # Cache DB
│── astro-landing/             # Astro frontend (beem.ink)
│── systemd/
│   └── videoreader.service
│── nginx/
│   └── beem.ink.conf
└── README.md
```

## ⚙️ Установка и запуск API

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python SERVER_TEMPLATE.py
```

## 🧩 Запуск лендинга (Astro)

```bash
cd astro-landing
npm install
npm run dev
npm run build
```

## 🌐 Production деплой

- **Лендинг**: `/var/www/beem.ink/dist`
- **Backend**: `/var/www/api.beem.ink/`
- **Nginx**: `beem.ink.conf`
- **Сервис**: `sudo systemctl restart videoreader.service`

## 📄 Лицензия

MIT