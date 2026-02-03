#!/bin/bash
# 6AD Platform - Application Deployment Script
# Run this after vps-setup.sh completes

set -e

APP_DIR="/home/6ad"

echo "========================================="
echo "  6AD Platform - App Deployment"
echo "========================================="

# Check if app directory exists, clone if not
if [ ! -d "$APP_DIR" ]; then
    echo "Cloning repository..."
    git clone https://github.com/ManishxRajpoot/6ad.git $APP_DIR
fi

cd $APP_DIR

# Install dependencies
echo "[1/6] Installing dependencies..."
npm install

# Copy production environment files
echo "[2/6] Setting up environment files..."
cp production.env.api apps/api/.env
cp production.env.admin apps/admin/.env.local
cp production.env.agency apps/agency/.env.local
cp production.env.user apps/user/.env.local

# Generate Prisma client
echo "[3/6] Generating Prisma client..."
cd packages/database
npx prisma generate
cd ../..

# Build all apps
echo "[4/6] Building applications..."
npm run build

# Seed database
echo "[5/6] Seeding database..."
cd packages/database
npx tsx prisma/seed.ts
cd ../..

# Start with PM2
echo "[6/6] Starting applications with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "Apps running:"
echo "  - API:     http://localhost:5001"
echo "  - Admin:   http://localhost:3001 (super.6ad.in)"
echo "  - Agency:  http://localhost:3002 (partner.6ad.in)"
echo "  - User:    http://localhost:3003 (ads.6ad.in)"
echo ""
echo "Check status: pm2 status"
echo "View logs: pm2 logs"
echo ""
echo "Don't forget to:"
echo "1. Configure DNS A records pointing to 72.61.249.140"
echo "2. Run SSL: certbot --nginx -d api.6ad.in -d super.6ad.in -d partner.6ad.in -d ads.6ad.in"
