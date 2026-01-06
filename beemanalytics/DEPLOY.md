# 🚀 ИНСТРУКЦИЯ ДЕПЛОЯ BEEMANALYTICS НА PRODUCTION

---

## 1️⃣ ПРОВЕРКА ОКРУЖЕНИЯ

### Проверка Node.js и npm

```bash
node --version
npm --version
```

**Требования:**
- Node.js: >= 18.x (рекомендуется 20.x+)
- npm: >= 9.x

Если версия не подходит:

```bash
# Обновить npm (если Node.js установлен корректно)
npm install -g npm@latest
```

### Проверка прав доступа

```bash
ls -ld /var/www/beemanalytics
```

**Ожидаемый вывод:** `drwxr-xr-x ... root root`

Если прав нет:

```bash
sudo chown -R root:root /var/www/beemanalytics
sudo chmod 755 /var/www/beemanalytics
```

### Проверка текущего user

```bash
whoami
```

Все команды далее выполняются от пользователя, под которым будет запускаться сервис (обычно `root`).

---

## 2️⃣ ПРАВИЛЬНАЯ СБОРКА ПРОЕКТА

### Перейти в директорию проекта

```bash
cd /var/www/beemanalytics
```

### Установка зависимостей

```bash
npm install --legacy-peer-deps
```

**Важно:**
- Используйте флаг `--legacy-peer-deps` если есть warning'и про peer dependencies
- **НЕ используйте `--production`** на этапе сборки (нужны devDependencies)
- Это может занять 2-5 минут

### Проверка наличия необходимых скриптов

```bash
cat package.json | grep -A 10 '"scripts"'
```

**Должны быть:**
```
"build": "next build"
"start": "next start"
```

### Сборка проекта

```bash
npm run build
```

**Что происходит:**
- Компилируется TypeScript/JSX
- Оптимизируются изображения
- Создается `.next` папка с production bundle'ом
- **Занимает 1-3 минуты**

**Признак успеха:**
```
> built successfully
```

**НЕ должны видеть:**
```
error TS
Module not found
Cannot find turbopack
```

---

## 3️⃣ SYSTEMD-СЕРВИС ДЛЯ ЗАПУСКА

### Создание systemd файла

```bash
sudo nano /etc/systemd/system/beemanalytics.service
```

**Содержимое файла:**

```ini
[Unit]
Description=BeeM Analytics Next.js Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/beemanalytics
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

**Пояснения:**
- `User=root` — под каким пользователем запускается (может быть другой)
- `WorkingDirectory` — откуда запускается команда
- `ExecStart=/usr/bin/npm start` — именно `npm start`, а не `next start` напрямую
- `Restart=always` — автоматически перезапускается при краше
- `NODE_ENV=production` — важный флаг для Next.js

### Сохранить файл

Нажать `Ctrl+X`, затем `Y`, затем `Enter`

### Перезагрузить systemd конфигурацию

```bash
sudo systemctl daemon-reload
```

### Включить сервис при загрузке системы

```bash
sudo systemctl enable beemanalytics.service
```

### Запустить сервис

```bash
sudo systemctl start beemanalytics.service
```

### Проверить статус

```bash
sudo systemctl status beemanalytics.service
```

**Ожидаемый вывод:**
```
● beemanalytics.service - BeeM Analytics Next.js Application
   Loaded: loaded (/etc/systemd/system/beemanalytics.service; enabled; vendor preset: enabled)
   Active: active (running) since ...
```

### Просмотр логов

```bash
sudo journalctl -u beemanalytics.service -f
```

**Флаги:**
- `-f` — в реальном времени (как `tail -f`)
- `-n 50` — последние 50 строк
- `--no-pager` — без pagination

---

## 4️⃣ ПРОВЕРКА БЕЗ NGINX

### Проверить, что Next.js слушает порт 3000

```bash
ss -tlnp | grep 3000
```

**Ожидаемый вывод:**
```
LISTEN 127.0.0.1:3000 ... users:(("node",pid=XXXX,...
```

**Если ничего не появилось:**
- Сервис не запустился, смотрите логи: `sudo journalctl -u beemanalytics.service -n 30`
- Порт занят другим процессом

### Проверить, что приложение отвечает

```bash
curl http://localhost:3000
```

**Ожидаемый ответ:**
- HTML страницы (начинается с `<!DOCTYPE` или `<html`)
- Или редирект на HTTPS

**Если 500 ошибка:**
- Смотрите логи: `sudo journalctl -u beemanalytics.service -n 50`

---

## 5️⃣ ПРОВЕРКА NGINX

### Где лежит конфиг

```bash
ls -la /etc/nginx/sites-enabled/beemanalytics
```

### Проверить конфиг nginx

```bash
sudo nginx -t
```

**Ожидаемый вывод:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Что должно быть в конфиге (пример для beemanalytics.com)

```bash
sudo cat /etc/nginx/sites-enabled/beemanalytics
```

**Минимальный конфиг:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name beemanalytics.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name beemanalytics.com;

    ssl_certificate /etc/letsencrypt/live/beemanalytics.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beemanalytics.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Важные строки:**
- `proxy_pass http://127.0.0.1:3000` — проксирует на Node.js приложение
- `proxy_http_version 1.1` — нужна для WebSocket
- `proxy_set_header Connection 'upgrade'` — для WebSocket
- `X-Forwarded-For`, `X-Real-IP` — для логирования реальных IP клиентов

### Перезагрузить nginx

```bash
sudo systemctl reload nginx
```

**Проверить:**

```bash
sudo systemctl status nginx
```

---

## 6️⃣ ФИНАЛЬНАЯ ПРОВЕРКА

### Проверить сайт через HTTPS

```bash
curl -I https://beemanalytics.com
```

**Ожидаемый ответ:**
```
HTTP/2 200
```

### Проверить в браузере

Открыть `https://beemanalytics.com` — должна загружиться страница

---

## ⚠️ ТИПОВЫЕ ОШИБКИ И РЕШЕНИЯ

### 1. HTTP 500 Internal Server Error

**Причина:** Ошибка в приложении при запуске

**Решение:**

```bash
# Просмотреть логи
sudo journalctl -u beemanalytics.service -n 50 --no-pager

# Перезапустить сервис
sudo systemctl restart beemanalytics.service

# Проверить статус
sudo systemctl status beemanalytics.service
```

**Что искать в логах:**
- `Cannot find module` — не установлены зависимости, нужен `npm install`
- `Error: listen EADDRINUSE` — порт 3000 занят, найти и убить процесс:

```bash
lsof -i :3000
sudo kill -9 PID
sudo systemctl restart beemanalytics.service
```

---

### 2. Module not found: turbopack

**Причина:** Используется конфиг Turbopack из dev режима вместо production

**Решение:**

```bash
# Удалить старую сборку
rm -rf /var/www/beemanalytics/.next

# Пересобрать
cd /var/www/beemanalytics
npm run build

# Перезапустить сервис
sudo systemctl restart beemanalytics.service
```

---

### 3. Port 3000 is not listening

**Причина:** Сервис не запустился

**Решение:**

```bash
# Проверить статус
sudo systemctl status beemanalytics.service

# Просмотреть логи
sudo journalctl -u beemanalytics.service -n 100

# Если сервис в статусе "failed":
sudo systemctl restart beemanalytics.service

# Проверить права на директорию
ls -ld /var/www/beemanalytics
```

---

### 4. Nginx works but site doesn't load

**Причина:** Либо nginx не проксирует на 3000, либо Node.js не слушает

**Проверка:**

```bash
# Проверить, что Node.js слушает
ss -tlnp | grep 3000

# Проверить nginx конфиг
sudo nginx -t

# Перезагрузить nginx
sudo systemctl reload nginx

# Проверить прямое подключение к Node.js
curl -v http://localhost:3000

# Если HTTPS редирект, проверить конфиг
sudo cat /etc/nginx/sites-enabled/beemanalytics | grep proxy_pass
```

---

### 5. SSL сертификат не работает

**Причина:** Certbot конфиг неправильный

**Проверка:**

```bash
# Проверить сертификаты
ls -la /etc/letsencrypt/live/

# Проверить в nginx конфиге
sudo cat /etc/nginx/sites-enabled/beemanalytics | grep ssl_certificate

# Проверить сертификат
sudo openssl x509 -in /etc/letsencrypt/live/beemanalytics.com/fullchain.pem -text -noout | grep -A2 "Subject:"
```

---

### 6. Высокое использование памяти / CPU после запуска

**Причина:** Может быть бесконечный цикл в коде или утечка памяти

**Проверка:**

```bash
# Просмотреть процессы Node.js
ps aux | grep node

# Просмотреть память
free -h

# Если есть несколько процессов Node.js, убить их все:
pkill -9 node

# Перезапустить сервис
sudo systemctl restart beemanalytics.service

# Просмотреть логи
sudo journalctl -u beemanalytics.service -f
```

---

## 🔄 КОМАНДЫ ДЛЯ ПОВСЕДНЕВНОГО ИСПОЛЬЗОВАНИЯ

### Перезапустить приложение (после изменений)

```bash
cd /var/www/beemanalytics
npm run build
sudo systemctl restart beemanalytics.service
```

### Посмотреть текущие логи

```bash
sudo journalctl -u beemanalytics.service -f
```

### Остановить приложение

```bash
sudo systemctl stop beemanalytics.service
```

### Запустить приложение

```bash
sudo systemctl start beemanalytics.service
```

### Перезагрузить nginx (после изменения конфига)

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Проверить, слушает ли приложение порт

```bash
ss -tlnp | grep 3000
curl http://localhost:3000
```

---

## ✅ ЧЕК-ЛИСТ ПЕРЕД PRODUCTION

- [ ] Node.js версия >= 18
- [ ] `npm install --legacy-peer-deps` выполнен
- [ ] `npm run build` прошёл без ошибок
- [ ] Systemd сервис создан в `/etc/systemd/system/beemanalytics.service`
- [ ] `systemctl daemon-reload` выполнен
- [ ] Сервис `systemctl start beemanalytics.service` запустился
- [ ] Приложение слушает `127.0.0.1:3000` (проверено `ss` и `curl`)
- [ ] Nginx конфиг проходит `nginx -t`
- [ ] HTTPS сертификат установлен и действует
- [ ] Site отвечает на `https://beemanalytics.com`
- [ ] Логи просматриваются через `journalctl`
- [ ] Сервис включен при загрузке: `systemctl enable beemanalytics.service`

---

**После выполнения всех пунктов приложение готово к production!** 🎉
