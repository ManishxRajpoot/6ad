#!/bin/bash
# Remove Custom Domain - Removes Nginx config and SSL for agent's custom domain
# Usage: ./remove-custom-domain.sh <domain>
# Example: ./remove-custom-domain.sh myagency.com

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Error: Domain is required"
    echo "Usage: ./remove-custom-domain.sh <domain>"
    exit 1
fi

echo "========================================="
echo "  Removing custom domain: $DOMAIN"
echo "========================================="

echo "[1/3] Removing SSL certificates..."
certbot delete --cert-name $DOMAIN --non-interactive 2>/dev/null || echo "No SSL certificate found for $DOMAIN"

echo "[2/3] Removing Nginx configuration..."
rm -f /etc/nginx/sites-enabled/custom-$DOMAIN
rm -f /etc/nginx/sites-available/custom-$DOMAIN

echo "[3/3] Reloading Nginx..."
if nginx -t; then
    systemctl reload nginx
    echo "Nginx configuration reloaded successfully"
else
    echo "Error: Nginx configuration test failed"
    exit 1
fi

echo ""
echo "========================================="
echo "  Domain removed: $DOMAIN"
echo "========================================="
