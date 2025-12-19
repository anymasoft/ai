# Руководство по развёртыванию VPN Manager

## 📋 Оглавление

1. [Быстрое развёртывание локально](#локальное-развёртывание)
2. [Развёртывание Backend на VPS](#развёртывание-backend-на-vps)
3. [Развёртывание прокси-сервера](#развёртывание-прокси-сервера)
4. [Production развёртывание](#production)

---

## 🏠 Локальное развёртывание

### Требования:
- Python 3.8+
- Chrome/Edge или Firefox
- Git

### Шаги:

#### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd ROOCOD
```

#### 2. Установка Backend

```bash
cd backend
python3 -m venv venv

# Активация виртуального окружения
# На Linux/Mac:
source venv/bin/activate
# На Windows:
venv\Scripts\activate

# Установка зависимостей
pip install -r requirements.txt

# Создание .env файла
cp .env.example .env
```

#### 3. Запуск Backend

```bash
python server.py
```

Вы должны увидеть:
```
Starting VPN Manager Backend Server...
API running on localhost:5000
```

#### 4. Установка расширения в браузер

**Chrome/Edge:**
1. Откройте `chrome://extensions/`
2. Включите "Режим разработчика" (сверху справа)
3. Нажмите "Загрузить распакованное расширение"
4. Выберите папку `extension/`

**Firefox:**
1. Откройте `about:debugging#/runtime/this-firefox`
2. Нажмите "Загрузить временное дополнение"
3. Выберите файл `extension/manifest.json`

#### 5. Проверка работы

1. Нажмите на иконку расширения
2. Должна открыться popup с интерфейсом VPN Manager
3. Выберите локацию и нажмите toggle для включения

---

## 🖥️ Развёртывание Backend на VPS

### Рекомендуемые VPS провайдеры:
- DigitalOcean
- Linode
- AWS EC2
- Google Cloud
- Hetzner

### Требования на сервере:
- Ubuntu 20.04 LTS или новее
- 2GB RAM
- 20GB SSD
- Python 3.8+
- Nginx или Apache

### Пошаговое развёртывание:

#### 1. Подключение к VPS

```bash
ssh root@your_vps_ip
```

#### 2. Обновление системы

```bash
apt update && apt upgrade -y
```

#### 3. Установка зависимостей

```bash
apt install -y python3 python3-pip python3-venv git curl
```

#### 4. Клонирование кода

```bash
cd /opt
git clone <repository-url> vpn-manager
cd vpn-manager/backend
```

#### 5. Настройка Python окружения

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### 6. Настройка .env для production

```bash
nano .env
```

Установить следующие переменные:
```
DEBUG=false
HOST=0.0.0.0
PORT=5000
JWT_SECRET_KEY=your-very-long-random-secret-key-here
DATABASE_PATH=/var/lib/vpn-manager/vpn_manager.db
MAX_USERS_PER_PROXY=100
ENABLE_LOGGING=true
CORS_ORIGINS=https://your-domain.com,chrome-extension://your-extension-id
```

#### 7. Создание директории для базы данных

```bash
mkdir -p /var/lib/vpn-manager
chown www-data:www-data /var/lib/vpn-manager
chmod 755 /var/lib/vpn-manager
```

#### 8. Установка Gunicorn

```bash
pip install gunicorn
```

#### 9. Создание Systemd сервиса

```bash
sudo nano /etc/systemd/system/vpn-manager.service
```

Содержимое файла:
```ini
[Unit]
Description=VPN Manager Backend Service
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/opt/vpn-manager/backend
ExecStart=/opt/vpn-manager/backend/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:5000 server:app
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 10. Запуск сервиса

```bash
sudo systemctl daemon-reload
sudo systemctl start vpn-manager
sudo systemctl enable vpn-manager
sudo systemctl status vpn-manager
```

#### 11. Установка Nginx как Reverse Proxy

```bash
apt install -y nginx
```

Создать конфигурацию:
```bash
sudo nano /etc/nginx/sites-available/vpn-manager
```

```nginx
upstream vpn_manager {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL сертификаты (используйте Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Оптимизация SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://vpn_manager;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Логи
    access_log /var/log/nginx/vpn-manager-access.log;
    error_log /var/log/nginx/vpn-manager-error.log;
}
```

Включить сайт:
```bash
sudo ln -s /etc/nginx/sites-available/vpn-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 12. SSL сертификат с Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot certonly --nginx -d your-domain.com
```

### Проверка

```bash
curl https://your-domain.com/api/health
```

---

## 🌐 Развёртывание Прокси-сервера

### Вариант 1: Tinyproxy на VPS

#### 1. Установка

```bash
ssh root@proxy_vps_ip
apt update
apt install -y tinyproxy
```

#### 2. Конфигурация

```bash
nano /etc/tinyproxy/tinyproxy.conf
```

Измените строки:
```
# Port на котором слушать
Port 8080

# Слушать на всех интерфейсах
Listen 0.0.0.0

# Разрешить любые подключения
Allow 0.0.0.0/0

# Логирование
LogFile "/var/log/tinyproxy/tinyproxy.log"
```

#### 3. Запуск

```bash
systemctl restart tinyproxy
systemctl enable tinyproxy

# Проверка
systemctl status tinyproxy
```

#### 4. Добавление в админ-панель

1. Откройте админ-панель
2. Перейдите в "Управление прокси"
3. Нажмите "+ Добавить прокси"
4. Заполните поля:
   - **Имя:** "Proxy VPS 1"
   - **Страна:** Выберите страну где находится VPS
   - **Хост:** IP адрес VPS
   - **Порт:** 8080
   - **Тип:** HTTP
5. Нажмите "Сохранить"

### Вариант 2: Squid на VPS

#### 1. Установка

```bash
apt update
apt install -y squid
```

#### 2. Конфигурация

```bash
nano /etc/squid/squid.conf
```

Найти и изменить:
```
# Порт
http_port 3128

# Access Control
acl all src 0.0.0.0/0
http_access allow all
```

#### 3. Запуск

```bash
systemctl restart squid
systemctl enable squid
```

### Вариант 3: Shadowsocks SOCKS5 Proxy

```bash
apt install -y python3-pip
pip3 install shadowsocks-libev

# Конфигурация
nano /etc/shadowsocks-libev/config.json
```

```json
{
    "server": "0.0.0.0",
    "server_port": 1080,
    "local_port": 1080,
    "password": "your-password",
    "timeout": 300,
    "method": "aes-256-gcm"
}
```

---

## 🔒 Production развёртывание

### Контрольный список безопасности:

- [ ] Изменён пароль администратора по умолчанию
- [ ] Установлен надёжный JWT_SECRET_KEY (32+ символов)
- [ ] Включен HTTPS со действительным сертификатом
- [ ] Правильно настроены CORS origins
- [ ] Включено логирование всех событий
- [ ] Установлена система резервного копирования БД
- [ ] Настроен firewall (блокировка лишних портов)
- [ ] Установлены и настроены логи rotations
- [ ] Включен мониторинг активности
- [ ] Настроены алерты на подозрительную активность

### Мониторинг и логирование:

```bash
# Просмотр логов сервиса
journalctl -u vpn-manager -f

# Просмотр Nginx логов
tail -f /var/log/nginx/vpn-manager-access.log
tail -f /var/log/nginx/vpn-manager-error.log

# Проверка использования ресурсов
htop
df -h
```

### Резервное копирование:

```bash
# Создать скрипт резервного копирования
nano /opt/backup-vpn.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/vpn-manager"
DB_PATH="/var/lib/vpn-manager/vpn_manager.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_PATH $BACKUP_DIR/vpn_manager_$DATE.db
# Удалить резервные копии старше 30 дней
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
```

Добавить в crontab:
```bash
0 2 * * * /opt/backup-vpn.sh
```

---

## 🧪 Тестирование развёртывания

### Проверка Backend:

```bash
# Health check
curl https://your-domain.com/api/health

# Получить список прокси
curl https://your-domain.com/api/proxies

# Тест входа админа
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Проверка прокси:

```bash
# Тест с curl
curl -x http://proxy-ip:8080 http://example.com

# Тест скорости
curl -x http://proxy-ip:8080 -w "Speed: %{speed_download} bytes/sec\n" http://speedtest.net
```

---

## 🐛 Troubleshooting

### Backend не запускается

```bash
# Проверить логи
journalctl -u vpn-manager -n 50

# Проверить порт
lsof -i :5000

# Проверить процесс
ps aux | grep gunicorn
```

### Проблемы с прокси

```bash
# Проверить, доступен ли прокси
telnet proxy-ip 8080

# Проверить конфигурацию
sudo systemctl status tinyproxy -l
```

### SSL ошибки

```bash
# Проверить сертификат
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# Обновить сертификат
certbot renew --dry-run
```

---

## 📞 Поддержка

Для проблем с развёртыванием:
1. Проверьте логи приложения
2. Убедитесь в наличии всех зависимостей
3. Проверьте файрволл и портовые настройки
4. Откройте Issue в репозитории
