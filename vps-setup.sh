#!/bin/bash
# 6AD Platform - Hostinger VPS Setup Script
# Domains: ads.6ad.in (user), partner.6ad.in (agency), super.6ad.in (admin)

set -e

echo "========================================="
echo "  6AD Platform - VPS Setup Script"
echo "========================================="

# Update system
echo "[1/10] Updating system..."
apt update && apt upgrade -y

# Install Node.js 20
echo "[2/10] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Git and Nginx
echo "[3/10] Installing Git and Nginx..."
apt install -y git nginx

# Install PM2
echo "[4/10] Installing PM2..."
npm install -g pm2

# Install MongoDB 7.0
echo "[5/10] Installing MongoDB..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org

# Configure MongoDB as Replica Set
echo "[6/10] Configuring MongoDB Replica Set..."
cat >> /etc/mongod.conf << 'EOF'

replication:
  replSetName: "rs0"
EOF

systemctl start mongod
systemctl enable mongod
sleep 5
mongosh --eval "rs.initiate()"

# Configure Firewall
echo "[7/10] Configuring Firewall..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 3001
ufw allow 3002
ufw allow 3003
ufw allow 5001
ufw --force enable

# Create Nginx configuration
echo "[8/10] Creating Nginx configuration..."
cat > /etc/nginx/sites-available/6ad << 'EOF'
# API Server
server {
    listen 80;
    server_name api.6ad.in;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Admin Panel - super.6ad.in
server {
    listen 80;
    server_name super.6ad.in;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Agency Panel - partner.6ad.in
server {
    listen 80;
    server_name partner.6ad.in;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# User Panel - ads.6ad.in
server {
    listen 80;
    server_name ads.6ad.in;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/6ad /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Install Certbot for SSL
echo "[9/10] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

echo "========================================="
echo "  Base Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Run: git clone https://github.com/ManishxRajpoot/6ad.git /home/6ad"
echo "2. Run: cd /home/6ad && chmod +x deploy-app.sh && ./deploy-app.sh"
echo ""
echo "For SSL, run after DNS is configured:"
echo "certbot --nginx -d api.6ad.in -d super.6ad.in -d partner.6ad.in -d ads.6ad.in"
echo ""
