#!/bin/bash
# 6AD Platform - Complete VPS Setup Script
# Domains: ads.6ad.in (user), partner.6ad.in (agency), super.6ad.in (admin)
# VPS: 72.61.172.38

set -e

echo "========================================="
echo "  6AD Platform - Complete Setup"
echo "========================================="

# Update system
echo "[1/12] Updating system..."
apt update && apt upgrade -y

# Install Node.js 20
echo "[2/12] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Git and Nginx
echo "[3/12] Installing Git and Nginx..."
apt install -y git nginx

# Install PM2
echo "[4/12] Installing PM2..."
npm install -g pm2

# Install MongoDB 7.0
echo "[5/12] Installing MongoDB..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org

# Configure MongoDB as Replica Set
echo "[6/12] Configuring MongoDB Replica Set..."
cat >> /etc/mongod.conf << 'EOF'

replication:
  replSetName: "rs0"
EOF

systemctl start mongod
systemctl enable mongod
sleep 5
mongosh --eval "rs.initiate()"

# Configure Firewall
echo "[7/12] Configuring Firewall..."
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# Create Nginx configuration
echo "[8/12] Creating Nginx configuration..."
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

# Clone repository
echo "[9/12] Cloning repository..."
cd /home
git clone https://github.com/ManishxRajpoot/6ad.git 6ad
cd 6ad

# Install dependencies
echo "[10/12] Installing dependencies..."
npm install

# Create environment files
echo "[11/12] Setting up environment files..."

# API env
cat > apps/api/.env << 'EOF'
DATABASE_URL="mongodb://127.0.0.1:27017/coinest?replicaSet=rs0&directConnection=true"
JWT_SECRET="6ad-production-secret-key-2024-change-this"
PORT=5001
NODE_ENV=production
ADMIN_URL="https://super.6ad.in"
AGENCY_URL="https://partner.6ad.in"
USER_URL="https://ads.6ad.in"
EOF

# Frontend envs
echo 'NEXT_PUBLIC_API_URL=https://api.6ad.in' > apps/admin/.env.local
echo 'NEXT_PUBLIC_API_URL=https://api.6ad.in' > apps/agency/.env.local
echo 'NEXT_PUBLIC_API_URL=https://api.6ad.in' > apps/user/.env.local

# Generate Prisma and build
echo "[12/12] Building applications..."
cd packages/database && npx prisma generate && cd ../..
npm run build

# Seed database
echo "Seeding database..."
cd packages/database && npx tsx prisma/seed.ts && cd ../..

# Start with PM2
echo "Starting applications..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Install Certbot
apt install -y certbot python3-certbot-nginx

echo ""
echo "========================================="
echo "  SETUP COMPLETE!"
echo "========================================="
echo ""
echo "Your apps are running at:"
echo "  - User:    http://ads.6ad.in (port 3003)"
echo "  - Agency:  http://partner.6ad.in (port 3002)"
echo "  - Admin:   http://super.6ad.in (port 3001)"
echo "  - API:     http://api.6ad.in (port 5001)"
echo ""
echo "Check status: pm2 status"
echo "View logs: pm2 logs"
echo ""
echo "IMPORTANT: Configure DNS A records pointing to 72.61.172.38:"
echo "  - api.6ad.in"
echo "  - super.6ad.in"
echo "  - partner.6ad.in"
echo "  - ads.6ad.in"
echo ""
echo "After DNS propagates, run SSL:"
echo "certbot --nginx -d api.6ad.in -d super.6ad.in -d partner.6ad.in -d ads.6ad.in"
echo ""
