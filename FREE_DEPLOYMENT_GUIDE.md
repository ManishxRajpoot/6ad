# FREE Deployment Guide for 6AD Platform

This guide shows you how to deploy 6AD with **minimal or zero cost**.

## Architecture (Cheapest Setup)

```
┌─────────────────────────────────────────────┐
│          Vercel / Netlify (FREE)            │
│  ┌───────────┬───────────┬───────────┐     │
│  │  Admin    │  Agency   │   User    │     │
│  │  App      │  App      │   App     │     │
│  └───────────┴───────────┴───────────┘     │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      Railway / Render / Fly.io              │
│           API Server (~$5/mo)               │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│         Neon / Supabase (FREE)              │
│            PostgreSQL Database              │
└─────────────────────────────────────────────┘

Total Cost: $0 - $5/month
```

---

## Step 1: Database Setup (FREE)

### Option A: Neon (Recommended)

1. Go to [neon.tech](https://neon.tech) → Sign up with GitHub

2. Click **"New Project"**
   - Name: `6ad-production`
   - Region: `Asia Pacific (Singapore)` or closest to you
   - Click **Create Project**

3. Copy your connection string:
   ```
   postgresql://neondb_owner:xxxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

4. **Important**: Change database name from `neondb` to `coinest`:
   - Go to **Databases** tab → **New Database** → Name: `coinest`
   - Update connection string to use `coinest`

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) → Sign up

2. Click **"New Project"**
   - Name: `6ad-production`
   - Password: Generate strong password (save it!)
   - Region: Choose closest
   - Click **Create Project**

3. Go to **Settings** → **Database** → Copy **URI** connection string

---

## Step 2: Run Database Migration

```bash
# 1. Update your local .env file
cd /Users/manishrajpoot/Coinest_Share/6ad

# 2. Set DATABASE_URL (replace with your actual URL)
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/coinest?sslmode=require"

# 3. Push schema to database
npx prisma db push --schema packages/database/prisma/schema.prisma

# 4. Verify tables (opens browser)
npx prisma studio --schema packages/database/prisma/schema.prisma
```

---

## Step 3: Deploy API Server

### Option A: Railway (Easiest - $5/mo)

1. Go to [railway.app](https://railway.app) → Login with GitHub

2. Click **"New Project"** → **"Deploy from GitHub repo"**

3. Select your repository

4. Configure:
   - **Root Directory**: `/` (leave empty)
   - **Build Command**: `npm ci && npx prisma generate --schema=packages/database/prisma/schema.prisma && npm run build --workspace=apps/api`
   - **Start Command**: `node apps/api/dist/index.js`

5. Add **Environment Variables**:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/coinest?sslmode=require
   JWT_SECRET=your-super-secret-key-at-least-32-characters-long
   NODE_ENV=production
   PORT=5001
   ```

6. Click **Deploy**

7. Go to **Settings** → **Networking** → **Generate Domain**
   - You'll get: `your-app.up.railway.app`

### Option B: Render (Free tier available)

1. Go to [render.com](https://render.com) → Sign up

2. Click **"New"** → **"Web Service"**

3. Connect your GitHub repo

4. Configure:
   - **Name**: `6ad-api`
   - **Root Directory**: Leave empty
   - **Build Command**: `npm ci && npx prisma generate --schema=packages/database/prisma/schema.prisma && npm run build --workspace=apps/api`
   - **Start Command**: `node apps/api/dist/index.js`
   - **Plan**: Free (or Starter $7/mo)

5. Add **Environment Variables** (same as Railway)

6. Click **Create Web Service**

### Option C: Fly.io (Free tier)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Create app
cd /Users/manishrajpoot/Coinest_Share/6ad
fly launch --name 6ad-api

# Set secrets
fly secrets set DATABASE_URL="postgresql://..." JWT_SECRET="your-secret"

# Deploy
fly deploy
```

---

## Step 4: Deploy Frontend Apps (FREE)

### Option A: Vercel (Recommended for Next.js)

#### Deploy Admin App:

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub

2. Click **"Add New"** → **"Project"**

3. Import your repository

4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/admin`
   - **Build Command**: `cd ../.. && npm ci && npm run build --workspace=apps/admin`
   - **Output Directory**: `apps/admin/.next`

5. Add **Environment Variable**:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
   ```

6. Click **Deploy**

7. **Repeat for Agency and User apps** (change `admin` to `agency` and `user`)

### Option B: Netlify

1. Go to [netlify.com](https://netlify.com) → Sign up

2. Click **"Add new site"** → **"Import an existing project"**

3. Connect GitHub repo

4. Configure:
   - **Base directory**: `apps/admin`
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`

5. Add environment variable: `NEXT_PUBLIC_API_URL`

6. Deploy

---

## Step 5: Custom Domain (Optional)

### Free Domain Options:
- **Freenom**: Free .tk, .ml, .ga domains (unreliable)
- **GitHub Student**: Free .me domain
- **Namecheap**: ~$1/year for .xyz domains

### Configure DNS:

| Subdomain | Points To |
|-----------|-----------|
| api.yourdomain.com | Railway/Render URL |
| admin.yourdomain.com | Vercel URL |
| agency.yourdomain.com | Vercel URL |
| app.yourdomain.com | Vercel URL |

---

## Complete Setup Checklist

```
[ ] 1. Create Neon account and database
[ ] 2. Run prisma db push to create tables
[ ] 3. Deploy API to Railway/Render
[ ] 4. Note API URL (e.g., https://6ad-api.up.railway.app)
[ ] 5. Deploy Admin app to Vercel with NEXT_PUBLIC_API_URL
[ ] 6. Deploy Agency app to Vercel with NEXT_PUBLIC_API_URL
[ ] 7. Deploy User app to Vercel with NEXT_PUBLIC_API_URL
[ ] 8. Test all apps work correctly
[ ] 9. (Optional) Add custom domain
```

---

## Environment Variables Summary

### API Server (.env)
```bash
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/coinest?sslmode=require
JWT_SECRET=your-super-secret-key-minimum-32-characters
NODE_ENV=production
PORT=5001
```

### Frontend Apps (each app)
```bash
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

---

## Cost Breakdown

| Service | Free Tier | Notes |
|---------|-----------|-------|
| **Neon** | ✅ 0.5 GB | PostgreSQL |
| **Vercel** | ✅ 100 GB bandwidth | 3 frontend apps |
| **Railway** | $5 credits | API server |
| **Total** | **$0-5/month** | |

---

## Quick Commands

```bash
# Local development
npm run dev                    # Start all apps
npm run dev:api               # Start API only
npm run dev:admin             # Start admin only

# Database
npx prisma db push --schema packages/database/prisma/schema.prisma
npx prisma studio --schema packages/database/prisma/schema.prisma
npx prisma generate --schema packages/database/prisma/schema.prisma

# Build
npm run build --workspace=apps/api
npm run build --workspace=apps/admin
npm run build --workspace=apps/agency
npm run build --workspace=apps/user
```

---

## Troubleshooting

### "Connection refused" error
- Check DATABASE_URL is correct
- Ensure `?sslmode=require` is in the URL for Neon

### "Invalid token" error
- JWT_SECRET must be the same across all deployments

### "CORS error"
- Update API CORS settings to include your frontend URLs

### Build fails on Vercel
- Make sure root package.json has all dependencies
- Check build logs for specific errors
