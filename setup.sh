#!/bin/bash
# FinMantra - One-time server setup script
# Creates .env, applies nginx config, restarts everything

echo ">>> Creating .env file..."
cat > /home/ubuntu/finmantra/server/.env << 'EOF'
PORT=5000
DATABASE_URL=postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres
ADMIN_PASSWORD=admin1234
JWT_SECRET=supersecretjwtkeyforfinmantra
WA_API_KEY=EAAPJktfIJYsBR9SvydaPUf8lcTpj8PPZAFs1DkFI2Td66X9rVeLeKMjaGAPy3Lk0yByd24sIokhaVgq8fdIgXPPt3fSnhsHio2gCPZC1NXkwaW9oajAxBR5JA2t9InPxbSE4Tc13ZB41l9CHJoArgVekw9NVDZBoH5B6zCRHWwMhkUKePrIZA1ruNNEE6tnWCAGP2DxOIZCVKaukrbL5J6kZBNKcc9iXubH21xZBIwL5vG2TAsyPjXAfeFluhrzHLuxQpIaJ82gbZCsBxEPhcldeU
WA_PHONE_NUMBER_ID=1211037612088239
WA_OTP_TEMPLATE_NAME=jaspers_market_order_confirmation_v1
WA_REFERRAL_TEMPLATE_NAME=jaspers_market_order_confirmation_v1
WA_TEMPLATE_LANGUAGE=en
EOF
echo ">>> .env file created!"

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
