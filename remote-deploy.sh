#!/bin/bash
# Remote deployment script - run this ON THE SERVER
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/var/www/api.beem.ink"
DOMAIN="api.beem.ink"
REPO_URL="https://github.com/anymasoft/ai.git"
BRANCH="claude/fix-text-truncation-013FZTgzigK5TZaTLthiQeY3"

echo "================================"
echo "Video Reader AI - Deployment"
echo "Server: api.beem.ink"
echo "================================"

echo -e "${YELLOW}[1/10] Updating system...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}[2/10] Installing packages...${NC}"
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl

echo -e "${YELLOW}[3/10] Cloning repository...${NC}"
rm -rf /tmp/ai-deploy
git clone --branch $BRANCH $REPO_URL /tmp/ai-deploy
cd /tmp/ai-deploy

echo -e "${YELLOW}[4/10] Creating project directory...${NC}"
mkdir -p $PROJECT_DIR
cp -r auth-system/* $PROJECT_DIR/
cd $PROJECT_DIR

echo -e "${YELLOW}[5/10] Setting up Python environment...${NC}"
python3 -m venv venv
source venv/bin/activate

cat > requirements.txt << 'PYEOF'
flask==3.0.0
flask-cors==4.0.0
openai==1.3.0
requests==2.31.0
python-dotenv==1.0.0
yookassa==3.0.0
gunicorn==21.2.0
PYEOF

pip install --upgrade pip
pip install -r requirements.txt

echo -e "${YELLOW}[6/10] Creating .env template...${NC}"
if [ ! -f .env ]; then
cat > .env << 'ENVEOF'
# Google OAuth (REQUIRED!)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# OpenAI API (REQUIRED!)
OPENAI_API_KEY=your_openai_key_here

# Yookassa (optional)
YOOKASSA_SHOP_ID=
YOOKASSA_API_KEY=
YOOKASSA_RETURN_URL_BASE=https://api.beem.ink
ENVEOF
    echo -e "${RED}⚠️  IMPORTANT: Edit .env with your credentials!${NC}"
fi

echo -e "${YELLOW}[7/10] Creating systemd service...${NC}"
cat > /etc/systemd/system/videoreader.service << SVCEOF
[Unit]
Description=Video Reader AI Flask Application
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
ExecStart=$PROJECT_DIR/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:5000 --timeout 300 SERVER_TEMPLATE:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

echo -e "${YELLOW}[8/10] Configuring nginx...${NC}"
cat > /etc/nginx/sites-available/api.beem.ink << 'NGXEOF'
server {
    listen 80;
    server_name api.beem.ink;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.beem.ink;

    ssl_certificate /etc/letsencrypt/live/api.beem.ink/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.beem.ink/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location = / {
        return 301 https://$server_name/pricing;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    location /assets/ {
        alias /var/www/api.beem.ink/web/assets/;
        expires 30d;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/api.beem.ink /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo -e "${YELLOW}[9/10] Obtaining SSL certificate...${NC}"
systemctl reload nginx
certbot certonly --nginx -d api.beem.ink --non-interactive --agree-tos --email admin@beem.ink --redirect || {
    echo -e "${RED}SSL failed - check DNS and try: certbot certonly --nginx -d api.beem.ink${NC}"
}

systemctl reload nginx

echo -e "${YELLOW}[10/10] Starting application...${NC}"
systemctl daemon-reload
systemctl enable videoreader
systemctl start videoreader

echo ""
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT: Edit credentials${NC}"
echo -e "  nano /var/www/api.beem.ink/.env"
echo -e "  systemctl restart videoreader"
echo ""
echo -e "Check status: ${GREEN}systemctl status videoreader${NC}"
echo -e "View logs: ${GREEN}journalctl -u videoreader -f${NC}"
echo -e "Test: ${GREEN}https://api.beem.ink/pricing${NC}"
echo ""
