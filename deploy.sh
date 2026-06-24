#!/bin/bash
set -e

echo "========================================="
echo "  FinMantra Deployment Script"
echo "========================================="

# Step 1: Install Node.js 20
echo "[1/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Step 2: Install PM2
echo "[2/8] Installing PM2..."
sudo npm install pm2 -g

# Step 3: Install Nginx
echo "[3/8] Installing Nginx..."
sudo apt install nginx -y

# Step 4: Clone project
echo "[4/8] Cloning FinMantra..."
cd /home/ubuntu
if [ -d "finmantra" ]; then
    echo "Directory exists, pulling latest..."
    cd finmantra && git pull
else
    git clone https://github.com/Lakshayb057/FinMantra.git finmantra
    cd finmantra
fi

# Step 5: Install backend dependencies
echo "[5/8] Installing backend dependencies..."
cd /home/ubuntu/finmantra/server
npm install

# Step 6: Create .env file
echo "[6/8] Creating .env file..."
cat > /home/ubuntu/finmantra/server/.env << 'ENDOFENV'
PORT=5000
DATABASE_URL=postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres
ADMIN_PASSWORD=admin1234
JWT_SECRET=supersecretjwtkeyforfinmantra
WA_API_KEY=EAAPJktfIJYsBR7xLDC3FwpwAD940yadfJB6fCZCi6TsYc8yFgstqYEruXi2xxamWDucZAqQpvswvNsZBiQI21Iz5o3Cdtcn2oGl35SYZAZBNugSpYhU1qMUFRptomisFhJAEgDkE0xbCAjTjeX6jEZAouvi79ugFaus8wVMPqg9V4q5uf169VkaEKMmoVJx8URauANTy8y3CSJBuPX3qxsgSA5DXzEYByH9V3bshXa0IhDmZAKvfZCvwAMUkxR9jWXZAdILNZCGuf36sPPHSQygm8N0AZDZD
WA_PHONE_NUMBER_ID=1211037612088239
WA_OTP_TEMPLATE_NAME=jaspers_market_order_confirmation_v1
WA_REFERRAL_TEMPLATE_NAME=jaspers_market_order_confirmation_v1
WA_TEMPLATE_LANGUAGE=en_US
WA_API_VERSION=v25.0
ENDOFENV

# Step 7: Start backend with PM2
echo "[7/8] Starting backend..."
cd /home/ubuntu/finmantra/server
pm2 stop finmantra-backend 2>/dev/null || true
pm2 delete finmantra-backend 2>/dev/null || true
pm2 start server.js --name "finmantra-backend"
pm2 save

# Step 8: Build frontend and deploy
echo "[8/8] Building frontend..."
cd /home/ubuntu/finmantra/client
npm install --legacy-peer-deps
npm run build
sudo mkdir -p /var/www/finmantra
sudo cp -r dist/* /var/www/finmantra/
sudo chown -R www-data:www-data /var/www/finmantra

# Step 9: Configure Nginx
echo "[9/9] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/finmantra > /dev/null << 'NGINXCONF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 80;
    server_name _;
    location / {
        if ($http_upgrade = "websocket") {
            proxy_pass http://localhost:5000;
            break;
        }
        root /var/www/finmantra;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXCONF

sudo ln -sf /etc/nginx/sites-available/finmantra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "  Your site is live at: http://$(curl -s ifconfig.me)"
echo "========================================="
