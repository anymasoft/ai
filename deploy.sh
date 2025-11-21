#!/bin/bash
set -e  # Exit on any error

echo "================================"
echo "Video Reader AI - Deployment"
echo "Server: api.beem.ink"
echo "Ubuntu 22.04"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="/var/www/api.beem.ink"
DOMAIN="api.beem.ink"

echo -e "${YELLOW}[1/10] Updating system packages...${NC}"
apt update
apt upgrade -y

echo -e "${YELLOW}[2/10] Installing required packages...${NC}"
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl

echo -e "${YELLOW}[3/10] Creating project directory...${NC}"
mkdir -p $PROJECT_DIR
cd /home/user/ai

echo -e "${YELLOW}[4/10] Copying project files...${NC}"
cp -r auth-system/* $PROJECT_DIR/
cd $PROJECT_DIR

echo -e "${YELLOW}[5/10] Creating Python virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

echo -e "${YELLOW}[6/10] Installing Python dependencies...${NC}"
cat > requirements.txt << 'EOF'
flask==3.0.0
flask-cors==4.0.0
openai==1.3.0
requests==2.31.0
python-dotenv==1.0.0
yookassa==3.0.0
gunicorn==21.2.0
EOF

pip install --upgrade pip
pip install -r requirements.txt

echo -e "${YELLOW}[7/10] Checking .env file...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}⚠️  .env file not found! Creating template...${NC}"
    cat > .env << 'EOF'
# Google OAuth (REQUIRED - заполните!)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# OpenAI API (REQUIRED - заполните!)
OPENAI_API_KEY=your_openai_key_here

# Yookassa Payment (опционально)
YOOKASSA_SHOP_ID=your_shop_id_here
YOOKASSA_API_KEY=your_yookassa_key_here
YOOKASSA_RETURN_URL_BASE=https://api.beem.ink
EOF
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit /var/www/api.beem.ink/.env with your credentials!${NC}"
    echo -e "${YELLOW}   Then run: systemctl restart videoreader${NC}"
fi

echo -e "${YELLOW}[8/10] Creating systemd service...${NC}"
cat > /etc/systemd/system/videoreader.service << EOF
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
EOF

# Set permissions
chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

echo -e "${YELLOW}[9/10] Configuring nginx...${NC}"
cat > /etc/nginx/sites-available/api.beem.ink << 'EOF'
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name api.beem.ink;

    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name api.beem.ink;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/api.beem.ink/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.beem.ink/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Logs
    access_log /var/log/nginx/api.beem.ink.access.log;
    error_log /var/log/nginx/api.beem.ink.error.log;

    # Root redirect to /pricing
    location = / {
        return 301 https://$server_name/pricing;
    }

    # Proxy to Flask application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long requests
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;

        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Static files from web/
    location /assets/ {
        alias /var/www/api.beem.ink/web/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/api.beem.ink /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

echo -e "${YELLOW}[10/10] Obtaining SSL certificate...${NC}"
echo -e "${YELLOW}⚠️  Make sure DNS record 'api.beem.ink' points to this server IP!${NC}"
echo -e "${YELLOW}⚠️  Press Enter to continue or Ctrl+C to cancel...${NC}"
read

# Reload nginx to enable HTTP for certbot challenge
systemctl reload nginx

# Get certificate
certbot certonly --nginx -d api.beem.ink --non-interactive --agree-tos --email admin@beem.ink || {
    echo -e "${RED}❌ Failed to obtain SSL certificate!${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "  1. DNS record 'api.beem.ink' points to this server"
    echo -e "  2. Port 80 and 443 are open in firewall"
    echo -e "  3. Run manually: certbot certonly --nginx -d api.beem.ink"
    exit 1
}

# Reload nginx with SSL
systemctl reload nginx

echo -e "${YELLOW}Starting Flask application...${NC}"
systemctl daemon-reload
systemctl enable videoreader
systemctl start videoreader

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Edit credentials in: ${GREEN}/var/www/api.beem.ink/.env${NC}"
echo -e "   ${YELLOW}nano /var/www/api.beem.ink/.env${NC}"
echo ""
echo -e "2. Restart service: ${GREEN}systemctl restart videoreader${NC}"
echo ""
echo -e "3. Check status: ${GREEN}systemctl status videoreader${NC}"
echo ""
echo -e "4. View logs: ${GREEN}journalctl -u videoreader -f${NC}"
echo ""
echo -e "5. Test: ${GREEN}https://api.beem.ink/pricing${NC}"
echo ""
echo -e "${YELLOW}Google OAuth Console:${NC}"
echo -e "  Authorized JavaScript origins: ${GREEN}https://api.beem.ink${NC}"
echo -e "  Authorized redirect URIs:"
echo -e "    ${GREEN}https://api.beem.ink/auth/callback${NC}"
echo -e "    ${GREEN}https://api.beem.ink/auth-site/callback${NC}"
echo ""
