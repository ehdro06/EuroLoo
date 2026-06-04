# EuroLoo wc 🇪🇺

A privacy-first, community-driven public toilet finder for Europe, built as a full-stack showcase demo app.

## Why

Access to sanitation is a fundamental human right. EuroLoo helps people quickly find clean, accessible, and free public toilets without sacrificing privacy.

## Showcase Demo Architecture

### Deployment Target (What Runs Where)

- **Frontend**: Vercel (Next.js app)
- **Backend**: GCP Cloud Run (NestJS API)
- **Database**: Neon (PostgreSQL)

### Environment and Secret Management

- Secrets are configured in deployment dashboards (Vercel, GCP, Neon, Clerk).
- No secrets should be committed to git.
- Only template files are committed:
  - `client/.env.example`
  - `server/.env.example`

## Links

- **Live URL**: [https://euroloo.app](https://euroloo.app)
- **Repository**: [https://github.com/ehdro06/euroloo](https://github.com/ehdro06/euroloo)
- **README**: [https://github.com/ehdro06/euroloo#readme](https://github.com/ehdro06/euroloo#readme)

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

## System Architecture

EuroLoo operates on a distributed, serverless architecture designed for rapid scaling and low maintenance overhead:

- **Frontend (Client):** [Next.js](https://nextjs.org/) deployed on **Vercel**. Handles SSR/SSG and edge routing.
- **Backend (API):** [NestJS](https://nestjs.com/) deployed on **Google Cloud Run**. Stateless, auto-scaling microVMs processing business logic and REST endpoints.
- **Database:** PostgreSQL with **PostGIS** extension, hosted on **Neon** serverless database. Utilizes connection pooling (`pgbouncer`) for rapid container scaling.
- **Authentication:** [Clerk](https://clerk.dev/) for identity management and JWT verification.
- **CI/CD:** Google Cloud Build automates the Docker pipeline from GitHub `main` branch directly to Cloud Run.

## Future Work (Scale-Oriented)

- Per-route/per-user adaptive rate limits
- Structured logging + centralized log aggregation
- Tracing + service-level latency/error dashboards
- Background jobs for async enrichment and moderation
- CI/CD promotion gates with smoke checks

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
