# AWS EC2 Deployment Guide for 6AD Platform

## Overview
This guide covers deploying the 6AD monorepo to AWS EC2 with MongoDB Atlas.

## Architecture
```
                    ┌─────────────────┐
                    │   Route 53      │
                    │   (DNS)         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Load Balancer  │
                    │  (ALB/Nginx)    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ Admin   │        │ Agency  │        │  User   │
    │ :3001   │        │ :3002   │        │ :3003   │
    └─────────┘        └─────────┘        └─────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │     API         │
                    │    :5001        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  MongoDB Atlas  │
                    │   (Cloud)       │
                    └─────────────────┘
```

---

## Step 1: MongoDB Atlas Setup

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/atlas
2. Sign up or log in
3. Create a new project called "6ad-production"

### 1.2 Create a Cluster
1. Click "Build a Database"
2. Choose "M10" or higher for production (M0 free tier for testing)
3. Select AWS as provider
4. Choose region closest to your users (e.g., ap-south-1 for India)
5. Name your cluster: `6ad-cluster`

### 1.3 Configure Security
1. **Database Access**: Create a database user
   - Username: `6ad_admin`
   - Password: Generate a strong password (save it!)
   - Role: `Atlas admin`

2. **Network Access**: Add IP whitelist
   - For development: Add your current IP
   - For production: Add your EC2 instance IP (or 0.0.0.0/0 temporarily)

### 1.4 Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string, it looks like:
```
mongodb+srv://6ad_admin:<password>@6ad-cluster.xxxxx.mongodb.net/coinest?retryWrites=true&w=majority
```

---

## Step 2: EC2 Instance Setup

### 2.1 Launch EC2 Instance
1. Go to AWS Console → EC2 → Launch Instance
2. Configure:
   - **Name**: `6ad-production`
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: `t3.medium` (2 vCPU, 4GB RAM) minimum
     - For production: `t3.large` or `t3.xlarge` recommended
   - **Key pair**: Create new or use existing (download .pem file!)
   - **Security Group**: Create new with these rules:
     - SSH (22) - Your IP only
     - HTTP (80) - Anywhere
     - HTTPS (443) - Anywhere
     - Custom TCP (3001) - Anywhere (Admin)
     - Custom TCP (3002) - Anywhere (Agency)
     - Custom TCP (3003) - Anywhere (User)
     - Custom TCP (5001) - Anywhere (API)

### 2.2 Allocate Elastic IP
1. EC2 → Elastic IPs → Allocate
2. Associate with your instance
3. Note this IP - it won't change

### 2.3 Connect to EC2
```bash
# Make key file secure
chmod 400 your-key.pem

# Connect via SSH
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
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
node --version  # Should show v20.x
```

### 3.3 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 3.4 Install Nginx (Reverse Proxy)
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3.5 Install Git
```bash
sudo apt install -y git
```

---

## Step 4: Deploy Application

### 4.1 Clone Repository
```bash
cd /home/ubuntu
git clone YOUR_REPOSITORY_URL 6ad
cd 6ad
```

### 4.2 Install Dependencies
```bash
npm install
```

### 4.3 Create Production Environment Files

**API Environment** - Create `apps/api/.env`:
```env
# Database - MongoDB Atlas
DATABASE_URL="mongodb+srv://6ad_admin:YOUR_PASSWORD@6ad-cluster.xxxxx.mongodb.net/coinest?retryWrites=true&w=majority"

# JWT
JWT_SECRET="your-super-secure-jwt-secret-key-change-this"

# Server
PORT=5001
NODE_ENV=production

# Frontend URLs
ADMIN_URL="https://admin.yourdomain.com"
AGENCY_URL="https://agency.yourdomain.com"
USER_URL="https://app.yourdomain.com"
```

**Admin Environment** - Create `apps/admin/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Agency Environment** - Create `apps/agency/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**User Environment** - Create `apps/user/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 4.4 Generate Prisma Client
```bash
cd packages/database
npx prisma generate
cd ../..
```

### 4.5 Build All Apps
```bash
npm run build
```

### 4.6 Seed Database (First Time Only)
```bash
cd packages/database
DATABASE_URL="your-mongodb-atlas-url" npx tsx prisma/seed.ts
cd ../..
```

---

## Step 5: PM2 Process Management

### 5.1 Create PM2 Ecosystem File
Create `ecosystem.config.js` in project root:
```javascript
module.exports = {
  apps: [
    {
      name: '6ad-api',
      cwd: './apps/api',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    },
    {
      name: '6ad-admin',
      cwd: './apps/admin',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: '6ad-agency',
      cwd: './apps/agency',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },
    {
      name: '6ad-user',
      cwd: './apps/user',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      }
    }
  ]
}
```

### 5.2 Start All Apps
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to auto-start on reboot
```

### 5.3 Useful PM2 Commands
```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 logs 6ad-api    # View specific app logs
pm2 restart all     # Restart all apps
pm2 reload all      # Zero-downtime reload
```

---

## Step 6: Nginx Configuration

### 6.1 Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/6ad
```

Add this configuration:
```nginx
# API Server
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5001;
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

# Admin Panel
server {
    listen 80;
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
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

# Agency Panel
server {
    listen 80;
    server_name agency.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
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

# User Panel
server {
    listen 80;
    server_name app.yourdomain.com;

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
```

### 6.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/6ad /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## Step 7: SSL Certificates (HTTPS)

### 7.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Get SSL Certificates
```bash
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com -d agency.yourdomain.com -d app.yourdomain.com
```

### 7.3 Auto-Renewal
```bash
sudo certbot renew --dry-run  # Test renewal
```

---

## Step 8: Domain Setup (Route 53 or Your DNS Provider)

Create these DNS records pointing to your Elastic IP:

| Type | Name | Value |
|------|------|-------|
| A | api.yourdomain.com | YOUR_ELASTIC_IP |
| A | admin.yourdomain.com | YOUR_ELASTIC_IP |
| A | agency.yourdomain.com | YOUR_ELASTIC_IP |
| A | app.yourdomain.com | YOUR_ELASTIC_IP |

---

## Step 9: Deployment Script (For Updates)

Create `/home/ubuntu/deploy.sh`:
```bash
#!/bin/bash
cd /home/ubuntu/6ad

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
cd packages/database && npx prisma generate && cd ../..

echo "Building apps..."
npm run build

echo "Reloading PM2..."
pm2 reload all

echo "Deployment complete!"
```

Make executable: `chmod +x /home/ubuntu/deploy.sh`

Run with: `./deploy.sh`

---

## Quick Commands Reference

```bash
# Check app status
pm2 status

# View logs
pm2 logs
pm2 logs 6ad-api

# Restart apps
pm2 restart all
pm2 reload all  # Zero-downtime

# Check ports
sudo netstat -tlnp | grep -E '3001|3002|3003|5001'

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Estimated Monthly Costs

| Service | Cost |
|---------|------|
| EC2 t3.medium | ~\$30/month |
| Elastic IP | Free (if attached) |
| MongoDB Atlas M10 | ~\$57/month |
| Route 53 | ~\$0.50/month |
| **Total** | **~\$88/month** |

For testing: Use t3.small (\$15/mo) + MongoDB M0 (free) = ~\$15/month
