#!/bin/bash
# Run this script on your LOCAL machine

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVER="root@146.103.102.104"

echo -e "${YELLOW}Deploying to api.beem.ink...${NC}"
echo ""

# Copy deployment script to server and execute
sshpass -p "111111111111111Qq!" ssh -o StrictHostKeyChecking=no $SERVER 'bash -s' << 'ENDSSH'
#!/bin/bash
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
echo "================================"

echo -e "${YELLOW}[1/10] Updating system...${NC}"
apt update -qq && apt upgrade -y -qq

echo -e "${YELLOW}[2/10] Installing packages...${NC}"
DEBIAN_FRONTEND=noninteractive apt install -y -qq python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl >/dev/null 2>&1

echo -e "${YELLOW}[3/10] Cloning repository...${NC}"
rm -rf /tmp/ai-deploy
git clone --branch $BRANCH --quiet $REPO_URL /tmp/ai-deploy
cd /tmp/ai-deploy

echo -e "${YELLOW}[4/10] Creating project directory...${NC}"
mkdir -p $PROJECT_DIR
cp -r auth-system/* $PROJECT_DIR/
cd $PROJECT_DIR

echo -e "${YELLOW}[5/10] Setting up Python...${NC}"
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

pip install --upgrade pip -q
pip install -r requirements.txt -q

echo -e "${YELLOW}[6/10] Creating .env...${NC}"
cat > .env << 'ENVEOF'
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
OPENAI_API_KEY=your_openai_key_here
YOOKASSA_SHOP_ID=
YOOKASSA_API_KEY=
YOOKASSA_RETURN_URL_BASE=https://api.beem.ink
ENVEOF

echo -e "${YELLOW}[7/10] Creating systemd service...${NC}"
cat > /etc/systemd/system/videoreader.service << SVCEOF
[Unit]
Description=Video Reader AI
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
ExecStart=$PROJECT_DIR/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:5000 --timeout 300 SERVER_TEMPLATE:app
Restart=always

[Install]
WantedBy=multi-user.target
SVCEOF

chown -R www-data:www-data $PROJECT_DIR

echo -e "${YELLOW}[8/10] Configuring nginx...${NC}"
cat > /etc/nginx/sites-available/api.beem.ink << 'NGXEOF'
server {
    listen 80;
    server_name api.beem.ink;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$server_name$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name api.beem.ink;
    ssl_certificate /etc/letsencrypt/live/api.beem.ink/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.beem.ink/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location = / { return 301 https://$server_name/pricing; }
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
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

echo -e "${YELLOW}[9/10] Getting SSL...${NC}"
systemctl reload nginx
certbot certonly --nginx -d api.beem.ink --non-interactive --agree-tos --email admin@beem.ink 2>/dev/null || echo -e "${RED}SSL failed - run manually: certbot certonly --nginx -d api.beem.ink${NC}"

systemctl reload nginx

echo -e "${YELLOW}[10/10] Starting app...${NC}"
systemctl daemon-reload
systemctl enable videoreader
systemctl start videoreader

echo ""
echo -e "${GREEN}✅ DEPLOYED!${NC}"
echo ""
echo -e "${YELLOW}Edit .env:${NC} nano /var/www/api.beem.ink/.env"
echo -e "${YELLOW}Restart:${NC} systemctl restart videoreader"
echo -e "${YELLOW}Status:${NC} systemctl status videoreader"
echo -e "${YELLOW}Logs:${NC} journalctl -u videoreader -f"
echo -e "${YELLOW}Test:${NC} https://api.beem.ink/pricing"

ENDSSH

echo ""
echo -e "${GREEN}Done! Connect to server to edit .env:${NC}"
echo -e "  ssh root@146.103.102.104"
echo -e "  nano /var/www/api.beem.ink/.env"
echo -e "  systemctl restart videoreader"
