#!/bin/bash
# FinMantra - One-time server setup script
# Creates .env (if missing), applies nginx config, restarts everything

ENV_FILE="/home/ubuntu/finmantra/server/.env"

# Only create .env if it doesn't exist (preserve user's existing config)
if [ -f "$ENV_FILE" ]; then
    echo ">>> .env file already exists — preserving existing configuration."
else
    echo ">>> Creating .env file..."
    cat > "$ENV_FILE" << 'EOF'
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/postgres
ADMIN_PASSWORD=FM@Chaos!2026
JWT_SECRET=supersecretjwtkeyforfinmantra
# WhatsApp credentials are now configurable via Admin Dashboard > Settings
# You can set them here as fallback, or leave blank and use the Admin UI
WA_API_KEY=
WA_PHONE_NUMBER_ID=
WA_OTP_TEMPLATE_NAME=auth_otp
WA_REFERRAL_TEMPLATE_NAME=transactional_link
WA_TEMPLATE_LANGUAGE=en
EOF
    echo ">>> .env file created! Edit it with your actual DATABASE_URL."
fi

echo ">>> Applying Nginx configuration..."
sudo cp /home/ubuntu/finmantra/nginx.conf /etc/nginx/sites-available/finmantra
sudo ln -sf /etc/nginx/sites-available/finmantra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
echo ">>> Nginx updated!"

echo ">>> Restarting backend..."
pm2 restart finmantra-backend
echo ""
echo "=========================================="
echo "  ALL DONE! Your site should be live at:"
echo "  http://13.127.33.132"
echo "=========================================="
