# IronLog v2

A modern, secure rewrite of IronLog. Built with Next.js 15 (App Router), TypeScript, Tailwind, Firebase, and Google Gemini.

## What's new vs v1

**Security**
- Gemini API endpoint now requires a verified Firebase ID token, validates input with Zod, and rate-limits per user.
- Firestore Security Rules included and versioned.
- Strict Content Security Policy + standard hardening headers.
- All secrets server-side only; web env vars clearly separated with `NEXT_PUBLIC_` prefix.
- `.gitignore` explicitly excludes every `.env*` file.
- Email verification + password reset flow.
- Input validation on every write — no more NaN volumes.

**Features**
- Rest timer (auto-start on set complete, vibration on finish)
- 1RM estimator (Epley) with per-exercise progression chart
- Progressive overload prompts (last session pre-fill + "+X kg" suggestions)
- RPE / RIR per set
- Body-part heatmap from weekly volume
- Exercise library + autocomplete (prevents PR fragmentation)
- Plate calculator
- Imperial / metric toggle
- Workout templates / routines
- Body metrics tracking (weight log)
- Streaks + weekly goal badge
- AI Coach with persisted chat history across sessions
- PWA — installable, basic offline shell
- CSV + JSON export

**UI/UX**
- Persistent dark mode (localStorage + system pref)
- iOS-safe FAB (`env(safe-area-inset-bottom)`)
- `inputMode="decimal"` / `"numeric"` for proper mobile keyboards
- Toast system replaces every `alert()` / `window.confirm()`
- Real loading skeletons
- ErrorBoundary wrapping the app shell
- Coach is a real bottom-nav tab
- Tap targets meet 44pt minimum
- Generic auth error messages (no email enumeration)

## Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in your Firebase + Gemini credentials. See .env.example for details.

# 3. Run
npm run dev
```

## Deploying

```bash
# Deploy security rules (one-time / on rule changes)
npm run deploy:rules

# Vercel handles the app. Set the env vars from .env.example in the Vercel project.
```

## Architecture

```
src/
├── app/                    Next.js App Router pages
│   ├── (auth)/             Login, signup, forgot, verify
│   ├── (app)/              Authenticated app shell
│   │   ├── dashboard       Charts, PRs, heatmap, streaks
│   │   ├── log             Workout logger (timer, RPE, plate calc, voice)
│   │   ├── history         Past sessions
│   │   ├── coach           AI chat
│   │   ├── templates       Saved routines
│   │   ├── body            Body metrics
│   │   └── settings        Units, theme, export, account
│   └── api/                Server routes (gemini, health)
├── components/             React UI
├── hooks/                  Reusable state hooks
├── lib/                    Business logic
│   ├── firebase            Client + Admin SDK
│   ├── ai                  Gemini wrapper + system prompts
│   ├── analytics           1RM, volume, streaks, muscle groups
│   ├── data                Exercise library, repository
│   ├── units               kg/lb conversion
│   ├── validation          Zod schemas
│   └── voice               Speech → set parser
├── providers/              React context providers
└── types/                  Shared TypeScript types
```

## Migration from v1

Your v1 Firestore data lived under `artifacts/{appId}/users/{uid}/workouts/...`.
v2 uses `users/{uid}/workouts/...` directly. See `scripts/migrate.ts` (TODO) or
copy via the Firebase console.
