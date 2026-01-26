# VPS Deployment Guide with MongoDB (Hostinger / AWS EC2)

Deploy 6AD on a single VPS with self-hosted MongoDB - **$0 database cost!**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your VPS Server                          │
│              (Hostinger $5/mo or AWS EC2)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Nginx                             │   │
│  │              (Reverse Proxy + SSL)                   │   │
│  │                Port 80/443                           │   │
│  └─────────────────────────────────────────────────────┘   │
│         │              │              │              │      │
│         ▼              ▼              ▼              ▼      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐  │
│  │  Admin   │   │  Agency  │   │   User   │   │   API   │  │
│  │  :3001   │   │  :3002   │   │  :3003   │   │  :5001  │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────────┘  │
│                                                     │       │
│                                                     ▼       │
│                              ┌──────────────────────────┐  │
│                              │       MongoDB            │   │
│                              │        :27017            │   │
│                              │    (Self-hosted FREE)    │   │
│                              └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Total Cost: $5-15/month (VPS only!)
Database: FREE (unlimited storage based on VPS disk)
```

---

## VPS Recommendations

| Provider | RAM | Storage | Price | Best For |
|----------|-----|---------|-------|----------|
| **Hostinger** | 4 GB | 50 GB | $5.99/mo | Budget |
| **Contabo** | 4 GB | 50 GB | €4.99/mo | Best value |
| **DigitalOcean** | 2 GB | 50 GB | $12/mo | Reliability |
| **AWS EC2** | 2 GB | 30 GB | ~$15/mo | AWS ecosystem |

---

## Part 1: Initial Server Setup

### 1.1 Connect to Your Server

```bash
# Hostinger (password)
ssh root@YOUR_SERVER_IP

# AWS EC2 (key file)
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP
```

### 1.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Create Deploy User

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy

# Copy SSH keys
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
sudo chown -R deploy:deploy /home/deploy/.ssh

# Switch to deploy user
su - deploy
```

---

## Part 2: Install MongoDB

### 2.1 Import MongoDB GPG Key

```bash
# Install dependencies
sudo apt install -y gnupg curl

# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
```

### 2.2 Add MongoDB Repository

```bash
# For Ubuntu 22.04
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list
sudo apt update
```

### 2.3 Install MongoDB

```bash
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify running
sudo systemctl status mongod
```

### 2.4 Secure MongoDB

```bash
# Connect to MongoDB
mongosh

# Switch to admin database
use admin

# Create admin user
db.createUser({
  user: "admin",
  pwd: "YourAdminPassword123!",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

# Create application user
use coinest
db.createUser({
  user: "coinest_user",
  pwd: "YourAppPassword123!",
  roles: [{ role: "readWrite", db: "coinest" }]
})

# Exit
exit
```

### 2.5 Enable Authentication

```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf
```

Find and modify:

```yaml
# Network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1  # Only localhost

# Security
security:
  authorization: enabled
```

Restart MongoDB:

```bash
sudo systemctl restart mongod
```

### 2.6 Test Connection

```bash
# Connect with authentication
mongosh "mongodb://coinest_user:YourAppPassword123!@localhost:27017/coinest?authSource=coinest"

# Should connect successfully
# Type 'exit' to quit
```

---

## Part 3: Install Node.js & Dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Verify installations
node --version   # v20.x
npm --version    # 10.x
mongosh --version # 2.x
```

---

## Part 4: Deploy Application

### 4.1 Clone Repository

```bash
cd /home/deploy
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git 6ad
cd 6ad
```

### 4.2 Create Environment File

```bash
nano .env
```

Add:

```bash
# MongoDB (local)
DATABASE_URL=mongodb://coinest_user:YourAppPassword123!@localhost:27017/coinest?authSource=coinest

# API Server
PORT=5001
NODE_ENV=production

# JWT Secret (generate: openssl rand -base64 64)
JWT_SECRET=your-super-secret-jwt-key-at-least-64-characters-long

# Frontend URLs
ADMIN_URL=https://admin.yourdomain.com
AGENCY_URL=https://agency.yourdomain.com
USER_URL=https://app.yourdomain.com
```

### 4.3 Install Dependencies

```bash
npm install
```

### 4.4 Generate Prisma Client & Push Schema

```bash
# Generate Prisma client
npx prisma generate --schema packages/database/prisma/schema.prisma

# Push schema to MongoDB (creates collections)
npx prisma db push --schema packages/database/prisma/schema.prisma
```

### 4.5 Build Applications

```bash
# Build API
npm run build --workspace=apps/api

# Build Frontend Apps
npm run build --workspace=apps/admin
npm run build --workspace=apps/agency
npm run build --workspace=apps/user
```

### 4.6 Create Frontend Environment Files

```bash
# Admin
echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com" > apps/admin/.env.local

# Agency
echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com" > apps/agency/.env.local

# User
echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com" > apps/user/.env.local

# Rebuild frontends
npm run build --workspace=apps/admin
npm run build --workspace=apps/agency
npm run build --workspace=apps/user
```

---

## Part 5: Start with PM2

### 5.1 Create PM2 Config

```bash
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: '6ad-api',
      script: 'apps/api/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
    {
      name: '6ad-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: './apps/admin',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: '6ad-agency',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      cwd: './apps/agency',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: '6ad-user',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      cwd: './apps/user',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
```

### 5.2 Start Applications

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command PM2 outputs
```

### 5.3 Verify

```bash
pm2 status
pm2 logs
```

---

## Part 6: Configure Nginx

### 6.1 Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/6ad
```

Add (replace `yourdomain.com`):

```nginx
# API Server
server {
    listen 80;
    server_name api.yourdomain.com;

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
        client_max_body_size 50M;
    }
}

# Admin Panel
server {
    listen 80;
    server_name admin.yourdomain.com;

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

# Agency Panel
server {
    listen 80;
    server_name agency.yourdomain.com;

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

# User Panel
server {
    listen 80;
    server_name app.yourdomain.com;

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
```

### 6.2 Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/6ad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Part 7: DNS & SSL Setup

### 7.1 Configure DNS Records

Add these A records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| A | api | YOUR_SERVER_IP |
| A | admin | YOUR_SERVER_IP |
| A | agency | YOUR_SERVER_IP |
| A | app | YOUR_SERVER_IP |

### 7.2 Install SSL (Free with Let's Encrypt)

```bash
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com -d agency.yourdomain.com -d app.yourdomain.com

# Follow prompts
# - Enter email
# - Agree to terms
# - Redirect HTTP to HTTPS (recommended)
```

---

## Part 8: Firewall Setup

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Part 9: MongoDB Backup

### 9.1 Create Backup Script

```bash
nano /home/deploy/backup-mongodb.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --uri="mongodb://coinest_user:YourAppPassword123!@localhost:27017/coinest?authSource=coinest" --out=$BACKUP_DIR/backup_$DATE

# Compress
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.tar.gz"
```

```bash
chmod +x /home/deploy/backup-mongodb.sh
```

### 9.2 Schedule Daily Backup

```bash
crontab -e
```

Add:

```
0 2 * * * /home/deploy/backup-mongodb.sh
```

### 9.3 Restore Backup

```bash
# Extract
tar -xzf backup_20240101_020000.tar.gz

# Restore
mongorestore --uri="mongodb://coinest_user:YourAppPassword123!@localhost:27017/coinest?authSource=coinest" backup_20240101_020000/coinest
```

---

## Quick Commands Reference

```bash
# ===== MongoDB =====
# Connect to MongoDB
mongosh "mongodb://coinest_user:YourAppPassword123!@localhost:27017/coinest?authSource=coinest"

# Check MongoDB status
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# ===== Application =====
# View all apps
pm2 status

# View logs
pm2 logs
pm2 logs 6ad-api

# Restart apps
pm2 restart all
pm2 restart 6ad-api

# ===== Update Application =====
cd /home/deploy/6ad
git pull origin main
npm install
npx prisma generate --schema packages/database/prisma/schema.prisma
npm run build --workspace=apps/api
npm run build --workspace=apps/admin
npm run build --workspace=apps/agency
npm run build --workspace=apps/user
pm2 restart all

# ===== Nginx =====
sudo nginx -t
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log

# ===== SSL =====
sudo certbot renew --dry-run
sudo certbot certificates
```

---

## Troubleshooting

### MongoDB Connection Failed

```bash
# Check if running
sudo systemctl status mongod

# Check logs
sudo tail -50 /var/log/mongodb/mongod.log

# Restart
sudo systemctl restart mongod
```

### App Not Starting

```bash
# Check PM2 logs
pm2 logs 6ad-api --lines 100

# Check if port in use
sudo lsof -i :5001
```

### Nginx 502 Bad Gateway

```bash
# Check if apps running
pm2 status

# Test nginx config
sudo nginx -t

# Restart everything
pm2 restart all
sudo systemctl restart nginx
```

### Out of Memory

```bash
# Check memory
free -m

# Add swap (if needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Cost Summary

| Item | Cost |
|------|------|
| Hostinger VPS (4GB) | $5.99/mo |
| MongoDB | $0 (self-hosted) |
| SSL Certificate | $0 (Let's Encrypt) |
| **Total** | **$5.99/month** |

**Storage**: Unlimited (based on VPS disk - 50GB+)
