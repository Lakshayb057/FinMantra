#!/bin/bash

# FinMantra CLI Management Tool for AWS EC2 Console
# Easily manage updating, logging, and configuring your application.

COMMAND=$1
ARG2=$2

show_help() {
    echo "=========================================================="
    echo "   FinMantra CLI Control Tool"
    echo "=========================================================="
    echo "Usage: ./manage.sh [command]"
    echo ""
    echo "Commands:"
    echo "  update            - Pull latest code, rebuild frontend, and restart all services"
    echo "  restart           - Restart the backend and Nginx services"
    echo "  status            - Check PM2 status and Nginx status"
    echo "  logs              - View real-time backend error/output logs"
    echo "  set-token [token] - Update the WhatsApp API token in your .env file"
    echo "=========================================================="
}

case "$COMMAND" in
    update)
        echo ">>> Pulling latest code from Git..."
        git pull
        
        echo ">>> Installing Backend Dependencies..."
        cd server
        npm install
        cd ..
        
        echo ">>> Installing Frontend Dependencies..."
        cd client
        npm install --legacy-peer-deps
        
        echo ">>> Rebuilding Frontend..."
        npm run build
        
        echo ">>> Copying static files to Nginx..."
        sudo cp -r dist/* /var/www/finmantra/
        
        cd ..
        echo ">>> Copying Nginx configuration..."
        sudo cp nginx.conf /etc/nginx/sites-available/finmantra
        sudo nginx -t && sudo systemctl restart nginx
        
        echo ">>> Ensuring Meta CAPI credentials in .env..."
        ENV_FILE="server/.env"
        if ! grep -q "META_PIXEL_ID" "$ENV_FILE" 2>/dev/null; then
            echo "" >> "$ENV_FILE"
            echo "# Meta Conversions API (CAPI) Configuration" >> "$ENV_FILE"
            echo "META_PIXEL_ID=1015546961540665" >> "$ENV_FILE"
            echo "META_ACCESS_TOKEN=EAAdY08snSiUBR0ZBDzFtRBYZCTIQZC9n46lHVRkRZCzkKpS2aBRZBRNo3t2nlzrud0wyZB2AXdCRTx7RAtyzUxJ0xSPW4LhneTZCd4V2p6c3jEH6HrM8ILVaZBGWnNWVprE8n7AseOEZBLSusKQMWwg5NdZByEoA9EqZCTXkp2uz4Ag2n6D4RVevlFaUZAEHOZAmfyVyRLwZDZD" >> "$ENV_FILE"
            echo "    Meta CAPI credentials added to .env."
        else
            echo "    Meta CAPI credentials already present in .env — skipped."
        fi

        echo ">>> Restarting PM2 Backend..."
        pm2 restart finmantra-backend
        
        echo ">>> Done! Everything is updated and live."
        ;;
        
    restart)
        echo ">>> Restarting backend (PM2)..."
        pm2 restart finmantra-backend
        echo ">>> Restarting Nginx..."
        sudo systemctl restart nginx
        echo ">>> Restart completed."
        ;;
        
    status)
        echo ">>> PM2 Status:"
        pm2 status
        echo ""
        echo ">>> Nginx Status:"
        sudo systemctl status nginx --no-pager | head -n 15
        ;;
        
    logs)
        echo ">>> Opening backend logs (Press Ctrl+C to exit)..."
        pm2 logs finmantra-backend --lines 40
        ;;
        
    set-token)
        if [ -z "$ARG2" ]; then
            echo "Error: Please provide the token. Example:"
            echo "  ./manage.sh set-token EAAPJ..."
            exit 1
        fi
        
        ENV_FILE="server/.env"
        if [ ! -f "$ENV_FILE" ]; then
            echo "Error: .env file not found at $ENV_FILE"
            exit 1
        fi
        
        echo ">>> Updating WA_API_KEY in $ENV_FILE..."
        # Use alternate delimiter for sed to avoid escaping special characters
        sed -i "s|^WA_API_KEY=.*|WA_API_KEY=$ARG2|" "$ENV_FILE"
        
        echo ">>> Restarting backend..."
        pm2 restart finmantra-backend
        echo ">>> Token successfully updated and server restarted!"
        ;;
        
    *)
        show_help
        ;;
esac
