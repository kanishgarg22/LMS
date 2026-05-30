# LMS — AI-Powered Labour Management System

A complete, production-ready Staff Management & Labour Payroll system for factory owners, contractors, and site managers.

---

## 🏗️ Architecture

```
lms2/
├── apps/
│   ├── api/          # Node.js + Express + Prisma backend
│   ├── web/          # Next.js 14 frontend (Tailwind + Shadcn)
│   └── mobile/       # React Native + Expo mobile app
├── packages/
│   └── shared/       # Shared TypeScript types
├── package.json      # Monorepo root
└── turbo.json
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase / Neon / local)
- OpenAI API key (for AI assistant)

### 1. Install dependencies

```bash
cd lms2
npm install
```

### 2. Setup backend

```bash
cd apps/api
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts   # Seeds demo data
```

### 3. Setup frontend

```bash
cd apps/web
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
```

### 4. Run everything

```bash
# From root, run all apps
npm run dev

# Or individually:
# Backend:  cd apps/api && npm run dev       → http://localhost:4000
# Frontend: cd apps/web && npm run dev       → http://localhost:3000
# Mobile:   cd apps/mobile && npm start      → Expo DevTools
```

### 5. Login

- **URL:** http://localhost:3000
- **Email:** admin@sharma.com
- **Password:** admin123

---

## 🌟 Features

### ✅ Attendance Management
- Register-style view (workers × dates)
- Last 5/7/10 days at a glance
- One-tap attendance marking
- Status: Present, Absent, Late, Half Day
- Overtime tracking with hours
- Bulk mark all present
- Real-time optimistic updates

### ✅ Worker Management
- Daily Wage & Monthly Salary workers
- Profile with photo upload
- Complete account dashboard
- Attendance history, payroll ledger
- Advance payment tracking

### ✅ Payroll Engine
- Auto-calculate from attendance
- Pro-rated salary for mid-month joiners
- Carry-forward logic with auto-notes
- Overtime pay (1.5x rate)
- Advance deduction
- Mark as paid

### ✅ AI Assistant (GPT-4)
- Natural language commands
- Hindi + English support
- Voice input (Whisper API)
- Executes real actions:
  - Mark attendance
  - Get payroll summary
  - Find absent workers
  - Check advances
  - Dashboard stats

### ✅ Reports
- Attendance report (PDF + Excel)
- Payroll summary (PDF + Excel)
- Salary slips (PDF)
- Print support

### ✅ Dashboard
- Real-time stats
- Attendance trend charts (Recharts)
- Monthly expense charts
- Quick action buttons

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register company + admin |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/workers | List workers |
| POST | /api/workers | Create worker |
| GET | /api/workers/:id/account | Worker account |
| GET | /api/attendance/register | Attendance register |
| POST | /api/attendance | Mark attendance |
| POST | /api/attendance/bulk | Bulk mark |
| GET | /api/payroll | List payroll |
| POST | /api/payroll/generate | Auto-generate |
| POST | /api/payroll/:id/pay | Mark paid |
| GET | /api/advances | List advances |
| POST | /api/advances | Create advance |
| GET | /api/dashboard/stats | Dashboard stats |
| GET | /api/dashboard/trends | Attendance trends |
| GET | /api/reports/attendance | Attendance report |
| GET | /api/reports/salary-slip/:id | Salary slip |
| POST | /api/ai/chat | AI chat |
| POST | /api/ai/voice | Voice transcription |

---

## 🚀 Deployment

### Backend → Railway / Render

```bash
cd apps/api
# Set environment variables in Railway dashboard
# DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
# Dockerfile is included for Railway
```

### Frontend → Vercel

```bash
cd apps/web
# vercel.json is included
# Set NEXT_PUBLIC_API_URL to your Railway/Render URL
vercel deploy
```

### Database → Neon / Supabase

```
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

### Mobile App → Expo EAS

```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas build --platform android
```

---

## 🔑 Environment Variables

### Backend (apps/api/.env)

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=4000
OPENAI_API_KEY="sk-..."
FRONTEND_URL="https://your-app.vercel.app"
```

### Frontend (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL="https://your-api.railway.app"
```

### Mobile (apps/mobile/.env)

```env
EXPO_PUBLIC_API_URL="https://your-api.railway.app"
```

---

## 📱 Mobile App

Built with React Native + Expo Router:

- **Dashboard** — Stats, quick actions
- **Attendance** — Scrollable register, one-tap marking
- **Workers** — Searchable list
- **Payroll** — Monthly payroll view
- **AI Chat** — Voice + text AI assistant

Supports Android, iOS, and Web.

---

## 🔐 Security

- JWT authentication with 7-day expiry
- Role-based access (SUPER_ADMIN, ADMIN, MANAGER, VIEWER)
- Rate limiting (500 req/15min)
- Helmet.js security headers
- CORS configured
- Parameterized queries via Prisma (SQL injection prevention)
- Audit logs for all actions

---

## 🗓️ Payroll Logic

### Daily Wage Workers
```
Net = (Present days + Late days + Half days × 0.5) × Daily Rate
    + Overtime hours × (Daily Rate / 8) × 1.5
    - Advance deductions
```

### Monthly Salary Workers
```
Daily Rate = Monthly Salary / Working days in month
Basic = Effective Present days × Daily Rate
OT Pay = OT hours × (Daily Rate / 8) × 1.5
Net = Basic + OT Pay - Advance deductions
```

### Mid-month Joining
- Salary calculated from joining date
- Carry-forward note added automatically

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| UI Components | Radix UI + custom Shadcn-style |
| Charts | Recharts |
| Mobile | React Native + Expo Router |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| AI | OpenAI GPT-4o-mini + Whisper |
| State | Zustand |
| HTTP Client | Axios |
| PDF | PDFKit |
| Excel | XLSX |
| Deploy | Vercel + Railway |
