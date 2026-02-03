#!/bin/bash
# Setup Custom Domain - Creates Nginx config and SSL for agent's custom domain
# Usage: ./setup-custom-domain.sh <domain>
# Example: ./setup-custom-domain.sh myagency.com

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Error: Domain is required"
    echo "Usage: ./setup-custom-domain.sh <domain>"
    exit 1
fi

echo "========================================="
echo "  Setting up custom domain: $DOMAIN"
echo "========================================="

# Create Nginx config for the custom domain
CONFIG_FILE="/etc/nginx/sites-available/custom-$DOMAIN"

echo "[1/4] Creating Nginx configuration..."
cat > $CONFIG_FILE << EOF
# Custom Domain: $DOMAIN
# Auto-generated for 6AD Platform agent whitelabel
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

echo "[2/4] Enabling site configuration..."
ln -sf $CONFIG_FILE /etc/nginx/sites-enabled/

echo "[3/4] Testing Nginx configuration..."
if nginx -t; then
    systemctl reload nginx
    echo "Nginx configuration applied successfully"
else
    echo "Error: Nginx configuration test failed"
    rm -f /etc/nginx/sites-enabled/custom-$DOMAIN
    rm -f $CONFIG_FILE
    exit 1
fi

echo "[4/4] Installing SSL certificate with Certbot..."
# Use certbot in non-interactive mode
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@6ad.in --redirect 2>/dev/null || \
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@6ad.in --redirect 2>/dev/null || \
echo "Warning: SSL installation may have partially failed. www subdomain might not be available."

echo ""
echo "========================================="
echo "  Domain setup complete: $DOMAIN"
echo "========================================="
echo ""
echo "The domain should now be accessible at:"
echo "  - https://$DOMAIN"
echo ""
