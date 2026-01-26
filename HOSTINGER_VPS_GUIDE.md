# Hostinger VPS Deployment Guide for 6AD Platform

## Overview
Deploy 6AD platform on Hostinger VPS KVM 2 (8GB RAM) with self-hosted MongoDB.

**Total Cost: ~$12/month** (vs ~$88/month on AWS)

---

## Step 1: Purchase Hostinger VPS

1. Go to https://www.hostinger.com/vps-hosting
2. Select **KVM 2** plan (8GB RAM, 4 vCPU, 100GB NVMe)
3. Choose **Ubuntu 22.04** as OS
4. Select data center closest to your users
5. Complete purchase

---

## Step 2: Initial VPS Access

### 2.1 Get VPS Credentials
1. Go to Hostinger hPanel → VPS
2. Note your:
   - IP Address
   - Root password (or set SSH key)

### 2.2 Connect via SSH
```bash
ssh root@YOUR_VPS_IP
```

### 2.3 Create Non-Root User (Recommended)
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

---

## Step 3: Server Setup

### 3.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 3.2 Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

### 3.3 Install MongoDB 7.0
```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```

### 3.4 Configure MongoDB Replica Set (Required for Prisma)
```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf
```

Add/modify these lines:
```yaml
replication:
  replSetName: "rs0"
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

Initialize replica set:
```bash
mongosh --eval "rs.initiate()"
```

### 3.5 Secure MongoDB (Optional but Recommended)
```bash
mongosh
```

```javascript
use admin
db.createUser({
  user: "6ad_admin",
  pwd: "your-secure-password",
  roles: [{ role: "root", db: "admin" }]
})
exit
```

Enable authentication in `/etc/mongod.conf`:
```yaml
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

### 3.6 Install PM2, Nginx, Git
```bash
sudo npm install -g pm2
sudo apt install -y nginx git
sudo systemctl enable nginx
```

---

## Step 4: Deploy Application

### 4.1 Clone Repository
```bash
cd /home/deploy
git clone YOUR_REPOSITORY_URL 6ad
cd 6ad
```

### 4.2 Install Dependencies
```bash
npm install
```

### 4.3 Create Environment Files

**API Environment** (`apps/api/.env`):
```bash
cat > apps/api/.env << 'EOF'
# Database - Local MongoDB with Replica Set
DATABASE_URL="mongodb://127.0.0.1:27017/coinest?replicaSet=rs0&directConnection=true"

# If using authentication:
# DATABASE_URL="mongodb://6ad_admin:your-secure-password@127.0.0.1:27017/coinest?replicaSet=rs0&directConnection=true&authSource=admin"

# JWT
JWT_SECRET="your-super-secure-jwt-secret-change-this-in-production"

# Server
PORT=5001
NODE_ENV=production

# Frontend URLs
ADMIN_URL="https://admin.yourdomain.com"
AGENCY_URL="https://agency.yourdomain.com"
USER_URL="https://app.yourdomain.com"
EOF
```

**Admin** (`apps/admin/.env.local`):
```bash
echo 'NEXT_PUBLIC_API_URL=https://api.yourdomain.com' > apps/admin/.env.local
```

**Agency** (`apps/agency/.env.local`):
```bash
echo 'NEXT_PUBLIC_API_URL=https://api.yourdomain.com' > apps/agency/.env.local
```

**User** (`apps/user/.env.local`):
```bash
echo 'NEXT_PUBLIC_API_URL=https://api.yourdomain.com' > apps/user/.env.local
```

### 4.4 Generate Prisma Client & Build
```bash
cd packages/database
npx prisma generate
cd ../..
npm run build
```

### 4.5 Seed Database
```bash
cd packages/database
npx tsx prisma/seed.ts
cd ../..
```

---

## Step 5: PM2 Setup

### 5.1 Start All Apps
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command it outputs
```

### 5.2 Check Status
```bash
pm2 status
pm2 logs
```

---

## Step 6: Nginx Configuration

### 6.1 Create Config
```bash
sudo nano /etc/nginx/sites-available/6ad
```

```nginx
# API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}

# Admin
server {
    listen 80;
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
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

# Agency
server {
    listen 80;
    server_name agency.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
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

# User App
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3003;
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
```

### 6.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/6ad /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 7: SSL Certificates (HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com -d agency.yourdomain.com -d app.yourdomain.com
```

Auto-renewal is set up automatically.

---

## Step 8: Domain DNS Setup

In Hostinger hPanel or your domain registrar, create A records:

| Type | Name | Value |
|------|------|-------|
| A | api | YOUR_VPS_IP |
| A | admin | YOUR_VPS_IP |
| A | agency | YOUR_VPS_IP |
| A | app | YOUR_VPS_IP |

---

## Step 9: Firewall Setup

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Step 10: Deployment Script

Create `/home/deploy/update.sh`:
```bash
#!/bin/bash
cd /home/deploy/6ad

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🔧 Generating Prisma client..."
cd packages/database && npx prisma generate && cd ../..

echo "🏗️ Building apps..."
npm run build

echo "🔄 Reloading PM2..."
pm2 reload all

echo "✅ Deployment complete!"
```

```bash
chmod +x /home/deploy/update.sh
```

---

## Quick Commands

```bash
# App status
pm2 status
pm2 logs
pm2 logs 6ad-api

# Restart apps
pm2 restart all
pm2 reload all  # Zero-downtime

# MongoDB
sudo systemctl status mongod
mongosh  # Connect to MongoDB shell

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log

# Check disk/memory
df -h
free -m
htop
```

---

## Backup MongoDB (Important!)

### Manual Backup
```bash
mongodump --out /home/deploy/backups/$(date +%Y%m%d)
```

### Automated Daily Backup
```bash
sudo crontab -e
```
Add:
```
0 2 * * * mongodump --out /home/deploy/backups/$(date +\%Y\%m\%d) && find /home/deploy/backups -mtime +7 -delete
```

---

## Cost Summary

| Item | Monthly Cost |
|------|-------------|
| Hostinger VPS KVM 2 | ~$12 |
| MongoDB (self-hosted) | $0 |
| SSL (Let's Encrypt) | $0 |
| Domain (if needed) | ~$1 |
| **Total** | **~$12-13/month** |

**Savings vs AWS: ~$75/month (~$900/year)**

---

## Troubleshooting

### MongoDB not starting
```bash
sudo systemctl status mongod
sudo journalctl -u mongod --no-pager | tail -50
```

### Apps not responding
```bash
pm2 logs
pm2 restart all
```

### Out of memory
```bash
# Add swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Check ports
```bash
sudo netstat -tlnp | grep -E '27017|3001|3002|3003|5001'
```
