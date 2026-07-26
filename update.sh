#!/bin/bash
echo "=== Updating FinMantra Code & EC2 Server Settings ==="
git pull origin main
cd server && npm install && cd ..
cd client && npm run build && cd ..

# Fix Nginx timeouts (each directive on separate line)
sudo tee /etc/nginx/conf.d/timeout.conf > /dev/null <<'NGINX'
client_max_body_size 200M;
proxy_connect_timeout 1800s;
proxy_send_timeout 1800s;
proxy_read_timeout 1800s;
send_timeout 1800s;
NGINX

sudo nginx -t && sudo systemctl reload nginx
pm2 restart all --max-memory-restart 4G
pm2 save
echo "=== Update Completed Successfully! ==="
