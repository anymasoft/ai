# Инструкция по запуску проекта на удаленном сервере Ubuntu (папка /var/www/beem.ink)

## 1. Обзор проекта
Проект представляет собой Next.js приложение (версия 15.4.7) с TypeScript, использующее SQLite базу данных, аутентификацию NextAuth, интеграцию с OpenAI и платежами (ЮKassa). Приложение предназначено для генерации и валидации описаний товаров для маркетплейсов.

## 2. Предварительные требования
- Сервер Ubuntu (рекомендуется 20.04 или 22.04)
- Node.js версия 20.12.0 (указана в .nvmrc)
- Менеджер пакетов npm или pnpm (рекомендуется pnpm)
- SQLite3 (для файловой базы данных)
- Системный менеджер процессов PM2 (рекомендуется) или systemd

## 3. Пошаговая инструкция

### 3.1. Подключение к серверу и обновление системы
```bash
ssh user@server_ip
sudo apt update && sudo apt upgrade -y
```

### 3.2. Установка Node.js через NVM
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20.12.0
nvm use 20.12.0
node --version  # убедиться, что версия 20.12.0
```

### 3.3. Установка SQLite3
```bash
sudo apt install sqlite3 -y
```

### 3.4. Установка менеджера пакетов pnpm (опционально, но рекомендуется)
```bash
npm install -g pnpm
```

### 3.5. Копирование проекта в /var/www/beem.ink
Предполагается, что код уже загружен в папку. Если нет:
```bash
sudo mkdir -p /var/www/beem.ink
sudo chown -R $USER:$USER /var/www/beem.ink
# скопируйте файлы проекта (например, через rsync или git clone)
```

### 3.6. Установка зависимостей
```bash
cd /var/www/beem.ink
pnpm install  # или npm install
```

### 3.7. Настройка переменных окружения
Создайте файл `.env.local` на основе `.env` (уже есть в проекте) и отредактируйте при необходимости:
```bash
cp .env .env.local
nano .env.local
```
**Критичные переменные, которые нужно проверить:**
- `NEXTAUTH_URL` – должен указывать на домен сервера (например, `https://beem.ink`)
- `NEXTAUTH_SECRET` – секретный ключ (уже есть, но можно сгенерировать новый)
- `OPENAI_API_KEY` – ключ OpenAI (должен быть действительным)
- `DATABASE_URL` – путь к файлу SQLite (например, `file:./sqlite.db`)
- `YOOKASSA_SHOP_ID` и `YOOKASSA_API_KEY` – для платежей (если используются)

### 3.8. Инициализация базы данных
Выполните скрипт setup-db.js для создания таблиц и заполнения начальных данных:
```bash
node setup-db.js
```
Если возникнут ошибки, убедитесь, что SQLite установлен и файл базы данных доступен для записи.

### 3.9. Сборка проекта
```bash
pnpm build  # или npm run build
```
При сборке могут быть предупреждения из-за ignoreBuildErrors, но они не критичны.

### 3.10. Запуск в production режиме
#### Вариант A: Использование PM2 (рекомендуется)
Установите PM2 глобально:
```bash
npm install -g pm2
```
Запустите приложение:
```bash
pm2 start "pnpm start" --name beem
pm2 save
pm2 startup  # сгенерирует команду для автозапуска при перезагрузке
```
#### Вариант B: Запуск напрямую
```bash
pnpm start
```
Приложение будет доступно на порту 3000.

### 3.11. Настройка reverse proxy (Nginx)
Установите Nginx:
```bash
sudo apt install nginx -y
```
Создайте конфигурационный файл:
```bash
sudo nano /etc/nginx/sites-available/beem
```
Добавьте конфигурацию:
```nginx
server {
    listen 80;
    server_name beem.ink www.beem.ink;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Активируйте сайт:
```bash
sudo ln -s /etc/nginx/sites-available/beem /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3.12. Настройка HTTPS (Let's Encrypt)
Установите Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
```
Получите сертификат:
```bash
sudo certbot --nginx -d beem.ink -d www.beem.ink
```
Следуйте инструкциям. Certbot автоматически обновит конфигурацию Nginx.

### 3.13. Настройка прав доступа
Убедитесь, что у пользователя, от которого запускается приложение, есть права на запись в папку базы данных и файлы логов.
```bash
sudo chown -R $USER:$USER /var/www/beem.ink
chmod 755 /var/www/beem.ink
```
Если используется SQLite, файл базы должен быть доступен для записи:
```bash
chmod 664 sqlite.db
```

### 3.14. Мониторинг и логи
- Логи PM2: `pm2 logs beem`
- Логи Nginx: `sudo tail -f /var/log/nginx/access.log`
- Логи приложения: находятся в `~/.pm2/logs/`

## 4. Дополнительные настройки
- **Рабочие процессы (workers)**: В проекте есть скрипт `scripts/batch-worker.ts`, который можно запустить через `pnpm worker:batch` (если требуется фоновая обработка).
- **Платежи**: Убедитесь, что ключи ЮKassa корректны и работают в нужном режиме (test/production).
- **Аутентификация**: Настройте OAuth провайдеров (Google) в консоли разработчика Google и обновите `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`.

## 5. Возможные проблемы и решения
- **Ошибка EPERM при сборке**: Добавьте `NEXT_DISABLE_TRACE=true` в `.env.local`.
- **Ошибка базы данных**: Проверьте, что SQLite установлен и файл базы существует.
- **Порт 3000 занят**: Измените порт в переменной окружения `PORT` или настройке PM2.
- **NextAuth секрет**: Сгенерируйте новый с помощью `openssl rand -base64 32`.

## 6. Тестирование
После запуска откройте в браузере `https://beem.ink`. Должна появиться главная страница приложения. Проверьте функционал генерации описаний и аутентификации.

## 7. Резервное копирование
Регулярно делайте бэкап файла `sqlite.db` и папки `/var/www/beem.ink`.

---

Инструкция готова к использованию. При возникновении вопросов обращайтесь к документации Next.js и соответствующим сервисам.