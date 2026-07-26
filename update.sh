#!/bin/bash
echo "=== Updating FinMantra Code & EC2 Server Settings ==="
git pull origin main
cd client && npm run build && cd ..
pm2 restart all --max-memory-restart 2G
echo "client_max_body_size 100M; proxy_connect_timeout 600s; proxy_send_timeout 600s; proxy_read_timeout 600s; send_timeout 600s;" | sudo tee /etc/nginx/conf.d/timeout.conf > /dev/null
sudo nginx -t && sudo systemctl reload nginx
echo "=== Update Completed Successfully! ==="
