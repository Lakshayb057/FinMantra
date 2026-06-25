#!/bin/bash
# Exit script immediately if any command returns a non-zero exit status
set -e

echo "========================================="
echo "  FinMantra Domain Configuration Script"
echo "========================================="

# Ask the user for their custom domain name
read -p "Enter your custom domain name (e.g., finmantra.org): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Error: Domain name cannot be empty."
    exit 1
fi

WWW_DOMAIN="www.$DOMAIN"

echo "Configuring Nginx for $DOMAIN and $WWW_DOMAIN..."

# Update the server_name in the repository nginx.conf
# Replace 'server_name _;' with 'server_name DOMAIN WWW_DOMAIN;'
sed -i "s/server_name _;/server_name $DOMAIN $WWW_DOMAIN;/g" /home/ubuntu/finmantra/nginx.conf

# Copy the updated config to Nginx sites-available
sudo cp /home/ubuntu/finmantra/nginx.conf /etc/nginx/sites-available/finmantra
sudo ln -sf /etc/nginx/sites-available/finmantra /etc/nginx/sites-enabled/

# Remove default site to prevent conflicts
sudo rm -f /etc/nginx/sites-enabled/default

echo "Testing Nginx configuration..."
sudo nginx -t

echo "Restarting Nginx..."
sudo systemctl restart nginx

echo "Nginx configured successfully."
echo ""
echo "========================================="
echo "  Installing Certbot & Obtaining SSL"
echo "========================================="

# Install Certbot and its Nginx plugin if not already installed
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Run certbot to request and configure SSL certificate
echo "Obtaining SSL certificate for $DOMAIN and $WWW_DOMAIN..."
read -p "Enter your email address for SSL renewal notifications (or press enter to skip): " EMAIL_ADDR

if [ -z "$EMAIL_ADDR" ]; then
    sudo certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --agree-tos --register-unsafely-without-email --redirect
else
    sudo certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --agree-tos -m "$EMAIL_ADDR" --redirect
fi

echo "SSL Certificate installed successfully!"
echo ""
echo "========================================="
echo "  Updating environment variable..."
echo "========================================="

ENV_FILE="/home/ubuntu/finmantra/server/.env"
if [ -f "$ENV_FILE" ]; then
    # Remove existing PUBLIC_SITE_URL from the env file if present
    sed -i '/PUBLIC_SITE_URL/d' "$ENV_FILE"
    # Append the new PUBLIC_SITE_URL
    echo "PUBLIC_SITE_URL=https://$DOMAIN" >> "$ENV_FILE"
    echo "Updated PUBLIC_SITE_URL in $ENV_FILE to https://$DOMAIN"
    
    # Restart the backend to apply the updated environment variable
    echo "Restarting FinMantra backend via PM2..."
    pm2 restart finmantra-backend || true
else
    echo "Warning: .env file not found at $ENV_FILE. Please create it manually and set PUBLIC_SITE_URL=https://$DOMAIN."
fi

echo "========================================="
echo "  Domain connection complete!"
echo "  Your site is now live and secured at: https://$DOMAIN"
echo "========================================="
