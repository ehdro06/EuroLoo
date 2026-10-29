# EuroLoo

[![CI](https://github.com/ehdro06/euroloo/actions/workflows/ci.yml/badge.svg)](https://github.com/ehdro06/euroloo/actions/workflows/ci.yml)

A privacy-first, community-driven public toilet finder for Europe, built as a full-stack portfolio demo app.

## Why

Access to sanitation is a fundamental human right. EuroLoo helps people quickly find clean, accessible, and free public toilets without sacrificing privacy.

## Architecture

EuroLoo runs on a distributed, serverless stack designed for rapid scaling and low maintenance overhead:

- **Frontend (Client):** [Next.js](https://nextjs.org/) on **Vercel** — SSR/SSG and edge routing
- **Backend (API):** [NestJS](https://nestjs.com/) on **GCP Cloud Run** — stateless, auto-scaling API
- **Database:** PostgreSQL with **PostGIS** on **Neon** — connection pooling via `pgbouncer`
- **Authentication:** [Clerk](https://clerk.dev/) for identity management and JWT verification
- **CI:** GitHub Actions (lint, type check, tests, migrations, builds)
- **CD:** Google Cloud Build builds the image, applies Prisma migrations, then deploys to Cloud Run (`server/cloudbuild.yaml`)

### Environment and Secret Management

- Secrets are configured in deployment dashboards (Vercel, GCP, Neon, Clerk).
- The Cloud Build migration step reads Neon's direct (non-pooled) connection string from the Secret Manager secret `euroloo-migrate-database-url`.
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
- All request bodies and query params are validated with DTOs (`class-validator`); unknown fields are rejected.
- Write routes require a Clerk JWT; admin routes additionally check the role stored in the database.
- Sensitive write routes are rate-limited per signed-in user (or per client IP for anonymous requests). `trust proxy` is set so a spoofed `X-Forwarded-For` header can't bypass the limit.
  - `RATE_LIMIT_TTL_MS` (default `60000`), `RATE_LIMIT_LIMIT` (default `60`), `TRUST_PROXY_HOPS` (default `1`)
- Photo uploads go straight to Google Cloud Storage via short-lived signed URLs. Only JPEG/PNG/WebP up to 5MB are accepted, and the API checks the stored object before saving it.
- Database migrations run in Cloud Build before each deploy.
- CI runs lint, type checks, unit tests, all migrations against a fresh PostGIS database, and production builds for both apps.

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

### Known Trade-offs

These are deliberate choices for the current scale:

- **In-memory cache and rate limiter**: both live in the Cloud Run instance's memory. With several instances, each keeps its own counters, and a cache clear only reaches the instance that handled the write (other instances serve results up to 1 hour old). The next step would be a shared store such as Redis (Memorystore).
- **Whole-cache invalidation**: any write clears the entire toilet cache instead of only the affected area. Simple and correct, but wasteful at higher write volumes.
- **Location check trusts the client**: the "within 50m" rule for adding a toilet uses coordinates reported by the browser, so it stops honest mistakes rather than determined abuse. Community reports and admin moderation cover the rest.

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

2. Install dependencies (client and server are separate packages):
   ```bash
   cd server && pnpm install && cd ..
   cd client && pnpm install && cd ..
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
   cd server
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

### Checks

Run in either `server/` or `client/`:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## License

MIT
