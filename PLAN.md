# 6AD Platform - Development Plan

## Project Overview

**6AD** is a digital advertising accounts management platform with multi-tenant architecture.

| Subdomain | Role | Purpose |
|-----------|------|---------|
| `easy.6ad.in` | Admin | Manage agents, approve transactions, reports |
| `agency.6ad.in` | Agent | Manage users, view commissions, stats |
| `ads.6ad.in` | User | Buy ad accounts, wallet, manage accounts |

---

## Current Status

### ✅ Completed

| Task | Status |
|------|--------|
| Project structure (Turborepo monorepo) | ✅ Done |
| Database schema (Prisma + PostgreSQL) | ✅ Done |
| Railway PostgreSQL setup | ✅ Done |
| Backend API (Hono + Node.js) | ✅ Done |
| Authentication (JWT + bcrypt) | ✅ Done |
| All API routes (auth, agents, users, transactions, accounts, dashboard, settings) | ✅ Done |
| Test accounts seeded (admin, agent, user) | ✅ Done |
| Local build tested | ✅ Done |
| GitHub repo connected | ✅ Done |

### 🔄 In Progress

| Task | Status |
|------|--------|
| Railway deployment | 🔄 Deploying |

### ⏳ Pending

| Task | Status |
|------|--------|
| Admin Frontend (easy.6ad.in) | ⏳ Pending |
| Agent Frontend (agency.6ad.in) | ⏳ Pending |
| User Frontend (ads.6ad.in) | ⏳ Pending |
| Domain configuration | ⏳ Pending |

---

## Phase 1: Backend ✅ COMPLETE

```
apps/api/
├── src/
│   ├── index.ts              ✅ Entry point
│   ├── middleware/auth.ts    ✅ JWT auth
│   └── routes/
│       ├── auth.ts           ✅ Login, register, me
│       ├── agents.ts         ✅ CRUD agents
│       ├── users.ts          ✅ CRUD users
│       ├── transactions.ts   ✅ Deposits, withdrawals, refunds
│       ├── accounts.ts       ✅ Ad accounts (5 platforms)
│       ├── dashboard.ts      ✅ Admin/Agent/User stats
│       └── settings.ts       ✅ PayLinks, domains, modules
```

### API Endpoints

| Route | Methods | Description |
|-------|---------|-------------|
| `/auth/login` | POST | Login with email/password |
| `/auth/register` | POST | Register new user |
| `/auth/me` | GET | Get current user |
| `/agents` | GET, POST, PATCH, DELETE | Agent management |
| `/users` | GET, POST, PATCH | User management |
| `/transactions/deposits` | GET, POST, approve/reject | Deposits |
| `/transactions/withdrawals` | GET, POST, approve/reject | Withdrawals |
| `/transactions/refunds` | GET, POST, approve/reject | Refunds |
| `/accounts` | GET, POST, approve/reject | Ad accounts |
| `/accounts/:platform` | GET | Platform-specific accounts |
| `/dashboard/admin` | GET | Admin dashboard stats |
| `/dashboard/agent` | GET | Agent dashboard stats |
| `/dashboard/user` | GET | User dashboard stats |
| `/settings/paylinks` | GET, POST, PATCH | PayLink management |
| `/settings/domains` | GET, POST, approve/reject | Custom domains |
| `/settings/profile` | PATCH | Update profile |

---

## Phase 2: Admin Frontend (easy.6ad.in)

### Tech Stack
- **Next.js 15** - React framework
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Component library
- **TanStack Query** - Data fetching
- **Recharts** - Charts
- **Lucide Icons** - Icons

### Pages to Build

| Page | Components | Priority |
|------|------------|----------|
| `/login` | Login form | 🔴 High |
| `/dashboard` | Stats cards, Revenue chart, Top agents, Recent activity | 🔴 High |
| `/agents` | Agent list (grid/table), Add agent modal, Agent profile | 🔴 High |
| `/users` | User list, Add user modal, User profile | 🔴 High |
| `/transactions` | Tabs (Deposits/Withdrawals/Refunds), Approve/Reject | 🔴 High |
| `/facebook` | Account list, Stats, Add application, Approve | 🟡 Medium |
| `/google` | Same as Facebook | 🟡 Medium |
| `/snapchat` | Same as Facebook | 🟡 Medium |
| `/tiktok` | Same as Facebook | 🟡 Medium |
| `/bing` | Same as Facebook | 🟡 Medium |
| `/reports` | Platform stats, Income report, Refund report | 🟡 Medium |
| `/withdrawals` | Withdrawal requests, Approve/Reject | 🟡 Medium |
| `/user-settings` | PayLink status table | 🟢 Low |
| `/settings` | Profile settings, Site settings | 🟢 Low |
| `/domains` | Custom domain applications | 🟢 Low |

### Shared Components

```
packages/ui/
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── StatsCard.tsx
│   ├── DataTable.tsx
│   ├── Modal.tsx
│   ├── StatusBadge.tsx
│   ├── Charts/
│   │   ├── LineChart.tsx
│   │   └── PieChart.tsx
│   └── Forms/
│       ├── LoginForm.tsx
│       ├── AgentForm.tsx
│       └── UserForm.tsx
```

### Design System (from Figma)

| Element | Value |
|---------|-------|
| Sidebar BG | `#1E1E2D` (dark blue) |
| Page BG | `#F6F6F6` (light gray) |
| Primary | `#8B5CF6` (purple) |
| Success | `#22C55E` (green) |
| Warning | `#F59E0B` (orange) |
| Danger | `#EF4444` (red) |
| Border Radius | `12px` |
| Font | Urbanist / Inter |

---

## Phase 3: Agent Frontend (agency.6ad.in)

### Pages

| Page | Description |
|------|-------------|
| `/login` | Agent login |
| `/dashboard` | Agent stats, User overview |
| `/users` | Manage users under agent |
| `/transactions` | View transactions |
| `/facebook` - `/bing` | View accounts |
| `/reports` | Agent reports |
| `/settings` | Profile settings |

---

## Phase 4: User Frontend (ads.6ad.in)

### Pages

| Page | Description |
|------|-------------|
| `/login` | User login |
| `/register` | User registration |
| `/dashboard` | User wallet, Account overview |
| `/wallet` | Deposit, Withdraw |
| `/facebook` - `/bing` | Apply for accounts, Manage |
| `/settings` | Profile settings |

---

## Phase 5: Deployment & Domain Setup

### Vercel Deployment

```
apps/admin   → easy.6ad.in
apps/agency  → agency.6ad.in
apps/user    → ads.6ad.in
```

### Railway (Backend)

```
apps/api → api.6ad.in
```

### DNS Configuration (6ad.in)

| Record | Type | Value |
|--------|------|-------|
| api | CNAME | railway-app-url |
| easy | CNAME | vercel-app-url |
| agency | CNAME | vercel-app-url |
| ads | CNAME | vercel-app-url |

---

## Execution Order

### Week 1: Admin Frontend Core
1. ⬜ Setup Next.js 15 app for admin
2. ⬜ Create shared UI components (Sidebar, Header, DataTable)
3. ⬜ Build Login page
4. ⬜ Build Dashboard page
5. ⬜ Build Agents page (list + add/edit)
6. ⬜ Build Users page

### Week 2: Admin Frontend Complete
7. ⬜ Build Transactions page (Deposits/Withdrawals/Refunds)
8. ⬜ Build Platform pages (Facebook, Google, etc.)
9. ⬜ Build Reports page
10. ⬜ Build Settings page

### Week 3: Agent & User Frontend
11. ⬜ Setup Agent frontend
12. ⬜ Setup User frontend
13. ⬜ Reuse shared components
14. ⬜ Customize per role

### Week 4: Polish & Deploy
15. ⬜ Testing
16. ⬜ Deploy to Vercel
17. ⬜ Configure domains
18. ⬜ Final testing

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@6ad.in | 123456 |
| Agent | agent@6ad.in | 123456 |
| User | user@6ad.in | 123456 |

---

## Next Immediate Steps

1. **Wait for Railway deploy** to complete
2. **Start Admin Frontend**:
   - Create `apps/admin` with Next.js 15
   - Setup Tailwind + shadcn/ui
   - Build Login page
   - Build Dashboard with real API

---

## Commands Reference

```bash
# Development
npm run dev:api      # Run backend
npm run dev:admin    # Run admin frontend

# Database
npm run db:push      # Push schema to DB
npm run db:studio    # Open Prisma Studio

# Build
npm run build        # Build all
```

---

*Last Updated: January 12, 2026*
