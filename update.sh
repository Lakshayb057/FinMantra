#!/bin/bash
echo "=== Updating FinMantra Code & EC2 Server Settings ==="
git pull origin main
cd server && npm install && cd ..
cd client && npm run build && cd ..

# Deploy built static files to Nginx web root /var/www/finmantra
sudo mkdir -p /var/www/finmantra
sudo cp -r client/dist/* /var/www/finmantra/
sudo chown -R www-data:www-data /var/www/finmantra

# Ensure python3, pandas, and openpyxl are installed for ultra-fast lead & MIS processing
if command -v python3 &>/dev/null; then
  python3 -m pip install pandas openpyxl --quiet 2>/dev/null || sudo apt-get update && sudo apt-get install -y python3-pandas python3-openpyxl 2>/dev/null || true
fi

# Fix Nginx timeouts globally in conf.d
sudo tee /etc/nginx/conf.d/timeout.conf > /dev/null <<'NGINX'
client_max_body_size 200M;
proxy_connect_timeout 1800s;
proxy_send_timeout 1800s;
proxy_read_timeout 1800s;
send_timeout 1800s;
NGINX

# Inject proxy_read_timeout and WebSocket headers directly into active site config if missing
for site_file in /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*; do
  if [ -f "$site_file" ]; then
    if ! grep -q "proxy_read_timeout" "$site_file"; then
      echo "Adding timeouts to $site_file"
      sudo sed -i '/proxy_pass/a \        proxy_connect_timeout 1800s;\n        proxy_send_timeout 1800s;\n        proxy_read_timeout 1800s;\n        send_timeout 1800s;' "$site_file"
    fi
    if ! grep -q "Upgrade \$http_upgrade" "$site_file"; then
      echo "Adding WebSocket upgrade headers to $site_file"
      sudo sed -i '/proxy_pass/a \        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";' "$site_file"
    fi
  fi
done

sudo nginx -t && sudo systemctl reload nginx || sudo systemctl restart nginx
pm2 restart all --max-memory-restart 4G
pm2 save
echo "=== Update Completed Successfully! ==="
