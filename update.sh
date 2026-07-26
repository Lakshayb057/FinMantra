#!/bin/bash
echo "=== Updating FinMantra Code & EC2 Server Settings ==="
git pull origin main
cd server && npm install && cd ..
cd client && npm run build && cd ..

# Fix Nginx timeouts globally in conf.d
sudo tee /etc/nginx/conf.d/timeout.conf > /dev/null <<'NGINX'
client_max_body_size 200M;
proxy_connect_timeout 1800s;
proxy_send_timeout 1800s;
proxy_read_timeout 1800s;
send_timeout 1800s;
NGINX

# Inject proxy_read_timeout directly into active site config if missing
for site_file in /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*; do
  if [ -f "$site_file" ]; then
    if ! grep -q "proxy_read_timeout" "$site_file"; then
      echo "Adding timeouts to $site_file"
      sudo sed -i '/proxy_pass/a \        proxy_connect_timeout 1800s;\n        proxy_send_timeout 1800s;\n        proxy_read_timeout 1800s;\n        send_timeout 1800s;' "$site_file"
    fi
  fi
done

sudo nginx -t && sudo systemctl reload nginx || sudo systemctl restart nginx
pm2 restart all --max-memory-restart 4G
pm2 save
echo "=== Update Completed Successfully! ==="
