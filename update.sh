#!/bin/bash
echo "=== Updating FinMantra Code & EC2 Server Settings ==="
git pull origin main
cd client && npm run build && cd ..
pm2 restart all --max-memory-restart 4G
echo "client_max_body_size 200M; proxy_connect_timeout 1800s; proxy_send_timeout 1800s; proxy_read_timeout 1800s; send_timeout 1800s;" | sudo tee /etc/nginx/conf.d/timeout.conf > /dev/null
sudo nginx -t && sudo systemctl reload nginx
echo "=== Update Completed Successfully! ==="
