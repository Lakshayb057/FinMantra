#!/usr/bin/env bash
set -e

echo "=================================================="
echo "  FinMantra Production New EC2 Setup Script"
echo "=================================================="

# 1. Update system packages & install dependencies
echo "[1/5] Installing System Dependencies (Node.js 20, Nginx, Certbot, PM2)..."
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git certbot python3-certbot-nginx postgresql-client
sudo npm install -g pm2

# 2. Build Client Frontend
echo "[2/5] Installing Frontend Dependencies & Building Web App..."
cd /home/ubuntu/finmantra/client
npm install
npm run build

# 3. Deploy Frontend Assets
echo "[3/5] Deploying Web Assets to /var/www/finmantra..."
sudo mkdir -p /var/www/finmantra
sudo cp -r dist/* /var/www/finmantra/
sudo chown -R www-data:www-data /var/www/finmantra

# 4. Configure Nginx Web Server & Proxy
echo "[4/5] Configuring Nginx Web Server & Proxy..."
sudo tee /etc/nginx/sites-available/finmantra > /dev/null <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name finmantra.org www.finmantra.org;
    client_max_body_size 100M;

    location / {
        root /var/www/finmantra;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        client_max_body_size 200M;
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 1800s;
        proxy_send_timeout 1800s;
        proxy_read_timeout 1800s;
        send_timeout 1800s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/finmantra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 5. Start Backend Process with PM2
echo "[5/5] Installing Backend Dependencies & Starting PM2 Service..."
cd /home/ubuntu/finmantra/server
npm install
pm2 start server.js --name finmantra-backend
pm2 save
pm2 startup || true

echo "=================================================="
echo "🎉 FinMantra Production Server Setup Completed!"
echo "=================================================="
echo ""
echo "Final Steps to Finalize Production:"
echo "1. In AWS EC2 Console, point your Elastic IP (or update DNS A records) to this new instance IP."
echo "2. Generate Let's Encrypt SSL by running:"
echo "   sudo certbot --nginx -d finmantra.org -d www.finmantra.org"
echo ""
