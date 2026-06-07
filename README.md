# EuroLoo

A privacy-first, community-driven public toilet finder for Europe, built as a full-stack demo app.

## Why

Access to sanitation is a fundamental human right. EuroLoo helps people quickly find clean, accessible, and free public toilets without sacrificing privacy.

## Architecture

EuroLoo runs on a distributed, serverless stack designed for rapid scaling and low maintenance overhead:

- **Frontend (Client):** [Next.js](https://nextjs.org/) on **Vercel** — SSR/SSG and edge routing
- **Backend (API):** [NestJS](https://nestjs.com/) on **GCP Cloud Run** — stateless, auto-scaling API
- **Database:** PostgreSQL with **PostGIS** on **Neon** — connection pooling via `pgbouncer`
- **Authentication:** [Clerk](https://clerk.dev/) for identity management and JWT verification
- **CI/CD:** Google Cloud Build deploys from GitHub `main` to Cloud Run

### Environment and Secret Management

- Secrets are configured in deployment dashboards (Vercel, GCP, Neon, Clerk).
- No secrets should be committed to git.
- Only template files are committed:
  - `client/.env.example`
  - `server/.env.example`

## Links

- **Live URL**: [https://euroloo.app](https://euroloo.app)
- **Repository**: [https://github.com/ehdro06/euroloo](https://github.com/ehdro06/euroloo)

## Features

- **Open data map discovery** via OpenStreetMap
- **Community contributions** for add/report/verify flows
- **Privacy-first UX** with no invasive tracking model
- **Auth-protected actions** using Clerk + backend guards
- **Cache-backed API reads** for fast location queries

## Production Readiness Highlights

- `GET /health` is available as a lightweight liveness probe endpoint.
- Sensitive write routes are protected with route-level rate limiting.
- Rate-limit settings are controlled through:
  - `RATE_LIMIT_TTL_MS` (default `60000`)
  - `RATE_LIMIT_LIMIT` (default `60`)

## Tech Stack

### Client (Frontend)

- Next.js (App Router)
- Redux Toolkit + RTK Query
- Tailwind CSS + shadcn/ui
- Pigeon Maps
- Clerk

### Server (Backend)

- NestJS
- Prisma
- PostgreSQL
- Clerk SDK

## Future Work (Scale-Oriented)

- Per-route/per-user adaptive rate limits
- Structured logging + centralized log aggregation
- Tracing + service-level latency/error dashboards
- Background jobs for async enrichment and moderation
- CI/CD promotion gates with smoke checks

### Known Gaps / Next Steps

These are intentional scope boundaries for the current demo, not oversights:

- **Review update/delete**: `PATCH/DELETE /reviews/:id` are rate-limited but still return stub responses; implement real DB operations and decide auth rules (owner-only vs admin-only).
- **Review route auth**: add guards once ownership/policy is defined for edit and delete flows.
- **Admin toilet restore/delete**: currently auth-protected but not rate-limited; add limits only if abuse patterns appear.

## Local Development

### Prerequisites

- Node.js (v20+)
- pnpm
- Docker (for local database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ehdro06/euroloo.git
   cd euroloo
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in both `client` and `server`.
   - Fill Clerk and DB values with your own credentials.

4. Start local database:
   ```bash
   cd server
   docker-compose up -d
   ```

5. Run migrations:
   ```bash
   pnpm prisma migrate dev
   ```

6. Start development servers:
   - Server:
     ```bash
     cd server
     pnpm dev
     ```
   - Client:
     ```bash
     cd client
     pnpm dev
     ```

## License

MIT
