#!/bin/bash
set -e

echo "========================================="
echo "  FinMantra UAT Deployment Script"
echo "========================================="

# Step 1: Check Node.js & PM2 & Nginx
echo "[1/9] Verifying Node.js, PM2, and Nginx..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    sudo npm install pm2 -g
fi

if ! command -v nginx &> /dev/null; then
    sudo apt install nginx -y
fi

# Step 2: Clone or Update UAT repository directory
echo "[2/9] Setting up UAT repository at /home/ubuntu/finmantra-uat..."
cd /home/ubuntu
if [ -d "finmantra-uat" ]; then
    echo "Directory exists. Pulling latest code from uat branch..."
    cd finmantra-uat
    git fetch origin
    git checkout uat
    git pull origin uat
else
    echo "Cloning repository and checking out uat branch..."
    git clone https://github.com/Lakshayb057/FinMantra.git finmantra-uat
    cd finmantra-uat
    git checkout uat
fi

# Step 3: Install backend dependencies
echo "[3/9] Installing backend dependencies..."
cd /home/ubuntu/finmantra-uat/server
if [ ! -f "node_modules/express/package.json" ] || [ ! -f "node_modules/debug/package.json" ]; then
    echo "Cleaning incomplete node_modules..."
    rm -rf node_modules
fi
npm install

# Step 4: Setup .env file for UAT
echo "[4/9] Setting up server/.env for UAT..."
ENV_FILE="/home/ubuntu/finmantra-uat/server/.env"
if [ -f "$ENV_FILE" ]; then
    echo ".env file already exists — preserving existing UAT configuration."
else
    cat > "$ENV_FILE" << 'ENDOFENV'
PORT=5001
DATABASE_URL=postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat
ADMIN_PASSWORD=finMantra@org
LAKSHAY_PASSWORD=Lakshay@123
JWT_SECRET=supersecretjwtkeyforfinmantra_uat

# WhatsApp API Configuration (Meta Graph Cloud API - Production Permanent Credentials)
WA_API_KEY=EAAVeOgEkwUQBR0suCgkJqWVJSi84GUu8QcWZCy0bNv7jBO5tQ3RmhGt9BzmJgiZBwNcwVoYtrucvrDKlyfa1ZB0ibFjMa7HHZA2Xbm8yzO7fPuz9iZA3ZCMnSzVcLdauBZC8GyNRO3pxemOOlzvlb8Y2bJHIA8MoDGwDOGxrpbK9UUZBooPPCWzKrZBwbq5n2H9MvSQZDZD
WA_PHONE_NUMBER_ID=1102087192998270
WA_OTP_TEMPLATE_NAME=finmantra_otp
WA_REFERRAL_TEMPLATE_NAME=finmantra_url_temp
WA_TEMPLATE_LANGUAGE=en
WA_API_VERSION=v20.0
WA_OTP_IS_AUTH_TEMPLATE=true

# Meta Conversions API (CAPI) & Custom Audiences Configuration
META_PIXEL_ID=1015546961540665
META_AD_ACCOUNT_ID=act_1450810068922146
META_ACCESS_TOKEN=EAAVcOgEkwUQBSMZA5fifzCMuvEzonYAZCybPbWYdAy0YM6ASvcjqcIt9ii4gaXDuLexc7ZBHZA7zGA0hhZA5d1t59SkUtszAb/NFZASRXucGdaX2w1XQD6RY4/QA8jZAUbaiAVSn/ColzfIlOvq9BU0ePyM1uoileKbLtFe0BSjfghbZCUtQSjY0BBjYe3FFXQZDZD
META_TEST_EVENT_CODE=
ENDOFENV
    echo "UAT .env file created at server/.env. Make sure 'finmantra_uat' database exists."
fi

# Step 5: Start backend with PM2 on port 5001
echo "[5/9] Starting UAT backend with PM2..."
cd /home/ubuntu/finmantra-uat/server
pm2 stop finmantra-backend-uat 2>/dev/null || true
pm2 delete finmantra-backend-uat 2>/dev/null || true
pm2 start server.js --name "finmantra-backend-uat"
pm2 save

# Step 6: Build UAT frontend
echo "[6/9] Building UAT frontend..."
cd /home/ubuntu/finmantra-uat/client
npm install --legacy-peer-deps
npm run build

# Step 7: Deploy build to /var/www/finmantra-uat
echo "[7/9] Deploying frontend build files to /var/www/finmantra-uat..."
sudo mkdir -p /var/www/finmantra-uat
sudo cp -r dist/* /var/www/finmantra-uat/
sudo chown -R www-data:www-data /var/www/finmantra-uat

# Step 8: Configure Nginx for UAT
echo "[8/9] Configuring Nginx for UAT..."
sudo cp /home/ubuntu/finmantra-uat/nginx-uat.conf /etc/nginx/sites-available/finmantra-uat
sudo ln -sf /etc/nginx/sites-available/finmantra-uat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Enable PM2 startup
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true
pm2 save

echo ""
echo "========================================="
echo "  UAT DEPLOYMENT COMPLETE!"
echo "  Backend Running on PM2: finmantra-backend-uat (Port 5001)"
echo "  Frontend Hosted at: /var/www/finmantra-uat"
echo "  Your UAT site is live at your configured domain/subdomain or server IP."
echo "========================================="
