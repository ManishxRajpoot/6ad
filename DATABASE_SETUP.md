# Database Setup Guide - Cheap PostgreSQL Options

## Quick Comparison

| Provider | Free Tier | Paid | Best For |
|----------|-----------|------|----------|
| **Neon** | 0.5 GB, unlimited projects | $19/mo | Serverless, auto-pause |
| **Supabase** | 500 MB, 2 projects | $25/mo | Full backend features |
| **Railway** | $5 credits | ~$5-10/mo | Easy setup, pay-per-use |
| **Render** | 90 days free | $7/mo | Simple PostgreSQL |
| **AWS RDS** | None | $15-30/mo | Enterprise, AWS ecosystem |

---

## Option 1: Neon (Recommended - FREE)

Neon is a serverless PostgreSQL that scales to zero when not in use.

### Setup Steps:

1. **Sign up**: Go to [neon.tech](https://neon.tech) and create account

2. **Create Project**:
   - Click "New Project"
   - Name: `6ad-production`
   - Region: Choose closest to your users (e.g., `ap-south-1` for India)
   - PostgreSQL version: 15 or 16

3. **Get Connection String**:
   - Go to Dashboard → Connection Details
   - Copy the connection string
   - It looks like:
   ```
   postgresql://username:password@ep-cool-name-123456.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```

4. **Update your .env**:
   ```bash
   DATABASE_URL=postgresql://username:password@ep-cool-name-123456.ap-south-1.aws.neon.tech/coinest?sslmode=require
   ```

5. **Run migrations**:
   ```bash
   npx prisma db push --schema packages/database/prisma/schema.prisma
   ```

### Neon Free Tier Includes:
- ✅ 0.5 GB storage
- ✅ 3 GB data transfer/month
- ✅ Unlimited projects
- ✅ Auto-suspend after 5 minutes of inactivity
- ✅ Branching for development

---

## Option 2: Supabase (FREE with extras)

Supabase gives you PostgreSQL + Auth + Storage + Realtime.

### Setup Steps:

1. **Sign up**: Go to [supabase.com](https://supabase.com)

2. **Create Project**:
   - Click "New Project"
   - Name: `6ad-production`
   - Database password: Generate a strong password
   - Region: Choose closest region

3. **Get Connection String**:
   - Go to Settings → Database
   - Scroll to "Connection string" → URI
   - Copy the string (use "Transaction" mode for Prisma)
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```

4. **Update .env**:
   ```bash
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres?schema=public
   ```

5. **For Prisma, also add** (in .env):
   ```bash
   # Use connection pooling for Prisma
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```

6. **Update schema.prisma** (if using Supabase pooling):
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

### Supabase Free Tier Includes:
- ✅ 500 MB database
- ✅ 2 GB bandwidth
- ✅ 50,000 monthly active users (auth)
- ✅ 1 GB file storage
- ⚠️ Paused after 1 week of inactivity

---

## Option 3: Railway (Pay-per-use)

You're already using Railway! Just create a PostgreSQL database there.

### Setup Steps:

1. **Go to your Railway project**

2. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
   - Wait for provisioning

3. **Get Connection String**:
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - Copy `DATABASE_URL`

4. **Update your .env**:
   ```bash
   DATABASE_URL=postgresql://postgres:xxx@xxx.railway.app:5432/railway
   ```

### Railway Pricing:
- $5/month free credits
- ~$0.000231/GB-hour for database
- Typically $5-15/month for small apps

---

## Option 4: Render (Simple & Cheap)

### Setup Steps:

1. **Sign up**: Go to [render.com](https://render.com)

2. **Create PostgreSQL**:
   - Dashboard → New → PostgreSQL
   - Name: `6ad-database`
   - Plan: Free (90 days) or Starter ($7/mo)
   - Region: Choose closest

3. **Get Connection String**:
   - Go to database → Info
   - Copy "External Database URL"

4. **Update .env**:
   ```bash
   DATABASE_URL=postgresql://user:pass@xxx.render.com:5432/dbname
   ```

### Render Pricing:
- Free: 90 days, then $7/month
- Starter: $7/month for 1 GB

---

## Migration Commands

After setting up any database:

```bash
# Navigate to project
cd /Users/manishrajpoot/Coinest_Share/6ad

# Push schema to database
npx prisma db push --schema packages/database/prisma/schema.prisma

# Generate Prisma client
npx prisma generate --schema packages/database/prisma/schema.prisma

# Open Prisma Studio to verify
npx prisma studio --schema packages/database/prisma/schema.prisma
```

---

## Recommended Setup for Your Case

Since you want to host on AWS but save on database costs:

```
┌─────────────────────────────────────────────┐
│           AWS (Compute Only)                │
│  ┌─────────────────────────────────────┐   │
│  │  App Runner / EC2 / ECS             │   │
│  │  (API Server - $20-40/month)        │   │
│  └─────────────────────────────────────┘   │
│                    │                        │
│  ┌─────────────────────────────────────┐   │
│  │  Amplify (Frontend Apps)            │   │
│  │  ($5-15/month)                      │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│              Neon (FREE)                    │
│         Serverless PostgreSQL               │
│         (0.5 GB free tier)                  │
└─────────────────────────────────────────────┘

Total Monthly Cost: $25-55 (vs $66-107 with RDS)
```

---

## Quick Start with Neon

```bash
# 1. Sign up at neon.tech and create project

# 2. Copy connection string and update .env
echo 'DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/coinest?sslmode=require' > .env

# 3. Run migrations
npx prisma db push --schema packages/database/prisma/schema.prisma

# 4. Verify tables
npx prisma studio --schema packages/database/prisma/schema.prisma
```

That's it! Your database is ready for production.
