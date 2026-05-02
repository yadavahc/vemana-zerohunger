# Prasadam — Claude Code Guide

## What this project is
A real-time food redistribution platform connecting restaurant surplus to NGOs and beneficiaries.
Built with **Next.js 15 (App Router) + Firebase + multi-agent architecture**.

## Architecture
```
Frontend (Next.js)  →  Firebase (Auth + Firestore + Storage)
                    →  Agent API Routes (/api/agents/*)
                         ├── Coordinator — brain, orchestrates all agents
                         ├── Supply — finds best food listing match
                         ├── Dispatch — assigns volunteers, tracks delivery
                         └── Escalation — handles failures, SLA breaches
```

## Roles & entry points
| Role         | Dashboard path   | Key actions                        |
|--------------|------------------|------------------------------------|
| NGO          | `/ngo`           | Submit requests, track deliveries  |
| Restaurant   | `/restaurant`    | Post surplus, approve matches      |
| Volunteer    | `/volunteer`     | Accept & complete deliveries       |
| Admin        | `/admin`         | Monitor escalations, system health |
| Beneficiary  | `/beneficiary`   | View meal schedule                 |

## Core flow (NGO → Restaurant → Volunteer → Delivery)
1. NGO submits request → `/ngo/request` → `createRequest()` in Firestore
2. POST `/api/agents/coordinator` → `runCoordinatorAgent()` → finds best listing
3. Match created in Firestore → restaurant notified via in-app notification
4. Restaurant approves → `handleRestaurantApproval()` → `runDispatchAgent()`
5. Delivery created, open to volunteers → volunteer accepts → status updates
6. If any step fails → `runEscalationAgent()` handles retry/admin alert

## Key files
- `src/lib/types.ts` — all TypeScript types
- `src/lib/firebase/db.ts` — all Firestore CRUD + real-time subscriptions
- `src/lib/agents/coordinator.ts` — main orchestration logic
- `src/lib/agents/supply.ts` — listing scoring algorithm
- `src/lib/agents/dispatch.ts` — volunteer assignment
- `src/lib/agents/escalation.ts` — fallback + SLA handling
- `src/context/auth-context.tsx` — phone OTP auth + user profile
- `src/hooks/` — real-time Firestore listeners per role
- `firestore.rules` — security rules

## Design tokens
- Primary green: `#1D9E75`
- Harvest amber: `#EF9F27`
- Background: `#f8faf9`
- Rounded corners: `rounded-xl` / `rounded-2xl` / `rounded-3xl`

## Environment setup
1. Copy `.env.local.example` → `.env.local`
2. Create Firebase project, enable Phone Auth, Firestore, Storage
3. Paste Firebase config values into `.env.local`
4. Deploy `firestore.rules` via Firebase Console or `firebase deploy --only firestore:rules`

## Dev server
```bash
npm run dev
```

## Adding a new agent
1. Create `src/lib/agents/your-agent.ts` with an exported `runYourAgent()` function
2. Add an API route at `src/app/api/agents/your-agent/route.ts`
3. Call it from the Coordinator or relevant trigger point
4. Log decisions with `logAgentDecision()` from `src/lib/firebase/db.ts`

## Phase 2 additions (not yet built)
- WhatsApp Business API notifications (replace in-app notifications)
- Voice call confirmations via Vapi
- Surplus prediction agent (ML-based, Python microservice)
- Quality check agent (Claude Vision API on food photos)
- Meal planning agent (nutritional optimization)
