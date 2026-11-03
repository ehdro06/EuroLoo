# Deployment

How EuroLoo is deployed and which settings each piece needs. Values marked `<...>` are placeholders; real secrets live only in the dashboards, never in git.

```
Browser ──► Vercel (Next.js, client/) ──► Cloud Run (NestJS, server/) ──► Neon (Postgres + PostGIS)
   │                                            │
   └──── direct photo upload (signed URL) ────► Cloud Storage bucket
```

| Piece | Service | Deploys when |
|---|---|---|
| Frontend | Vercel project with Root Directory `client` | Every push (previews for PRs, production for `main`) |
| API | Cloud Run service `euroloo-git` in `europe-west1` | Cloud Build trigger on pushes to `main` (`server/cloudbuild.yaml`) |
| Database | Neon Postgres with PostGIS | Migrations run by Cloud Build before each API deploy |
| Photos | Cloud Storage bucket in `europe-west1` | — |
| Toilet data | Cloud Run Job `euroloo-osm-sync`, triggered weekly by Cloud Scheduler | Image updated by Cloud Build on each deploy |
| Auth | Clerk | — |

## Neon (database)

Neon gives two connection strings for the same database:

- **Pooled** (host contains `-pooler`): used by the running API. Many Cloud Run instances share a small number of real connections.
- **Direct** (no `-pooler`): used only for migrations, which need session-level locks that the pooler doesn't support.

## Secret Manager

| Secret | Value | Read by |
|---|---|---|
| `euroloo-database-url` | Neon **pooled** URL | Cloud Run service (as `DATABASE_URL`) |
| `euroloo-migrate-database-url` | Neon **direct** URL | Cloud Build `migrate` step |

Both service accounts that read them need **Secret Manager Secret Accessor** on the secret. On this project both Cloud Run and Cloud Build run as the default compute service account (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`); check the trigger's settings if that changes.

## Cloud Run (API)

Environment variables on the `euroloo-git` service:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | secret `euroloo-database-url:latest` | Pooled URL |
| `CLERK_SECRET_KEY` | Clerk secret key | Verifies session tokens |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | For `/api/webhooks/clerk` |
| `GCS_BUCKET_NAME` | `<photo bucket name>` | Required for photo uploads |
| `CORS_ORIGINS` | optional, default `https://euroloo.vercel.app` | Comma-separated; add any custom domain here |
| `TRUST_PROXY_HOPS` | optional, default `1` | Proxies in front of the API |
| `RATE_LIMIT_TTL_MS` / `RATE_LIMIT_LIMIT` | optional, defaults `60000` / `60` | Write-route rate limit |

`NODE_ENV=production` is set in the Dockerfile. The deploy step only swaps the container image, so these settings persist across deploys.

```bash
# Example: point the service at the runtime secret and the photo bucket
gcloud run services update euroloo-git --region europe-west1 \
  --update-secrets=DATABASE_URL=euroloo-database-url:latest \
  --update-env-vars=GCS_BUCKET_NAME=<bucket>
```

## Cloud Storage (photos)

Photos are uploaded straight from the browser to the bucket using a short-lived signed URL from the API, then the API checks the stored file (type and size) before saving it.

```bash
BUCKET=<bucket>
SA=<PROJECT_NUMBER>-compute@developer.gserviceaccount.com

gcloud storage buckets create gs://$BUCKET --location=europe-west1 --uniform-bucket-level-access

# Photos are shown by public URL
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=allUsers --role=roles/storage.objectViewer

# Let the website upload directly
cat > cors.json <<'JSON'
[{"origin": ["https://euroloo.vercel.app"], "method": ["PUT"],
  "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
JSON
gcloud storage buckets update gs://$BUCKET --cors-file=cors.json

# The API checks and deletes uploaded objects, and signs upload URLs as itself
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$SA --role=roles/storage.objectAdmin
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member=serviceAccount:$SA --role=roles/iam.serviceAccountTokenCreator
```

If you add a custom domain, add it to the bucket CORS `origin` list as well as `CORS_ORIGINS`.

## Cloud Build (CI/CD for the API)

`server/cloudbuild.yaml` runs on pushes to `main`:

1. **build** the Docker image from `server/`
2. **push** it to Artifact Registry (`europe-west1-docker.pkg.dev/<PROJECT_ID>/cloud-run-source-deploy/euroloo-backend`)
3. **migrate**: `prisma migrate deploy` using `euroloo-migrate-database-url`; if this fails, nothing is deployed
4. **deploy** the image to the `euroloo-git` Cloud Run service

## OpenStreetMap sync (toilet data)

Toilet data comes from OpenStreetMap through the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API). `server/scripts/sync-osm.ts` queries each country in `server/src/osm/european-countries.ts` for `amenity=toilets` (points and buildings), then:

- **upserts** them by `externalId` (`node/123`, `way/456`), updating only OpenStreetMap fields; votes, reviews, photos and moderation state are kept
- **hides** toilets of that country that OpenStreetMap no longer has (`osmDeletedAt`), unless the country returned less than half of what's stored, which usually means a partial Overpass response
- never touches toilets added by users

It runs as a Cloud Run Job using the API's Docker image, waiting 10 seconds between countries to stay within the public Overpass server's fair-use limits. A failed country doesn't stop the others; the execution is marked failed so it shows up in the console.

### One-time setup

```bash
PROJECT_ID=<PROJECT_ID>
SA=<PROJECT_NUMBER>-compute@developer.gserviceaccount.com
IMAGE=$(gcloud run services describe euroloo-git --region europe-west1 \
  --format='value(spec.template.spec.containers[0].image)')

# The job reuses the API image; migrations need the direct URL, and so does this long batch job
gcloud run jobs create euroloo-osm-sync --region europe-west1 --image "$IMAGE" \
  --command node --args dist/scripts/sync-osm.js \
  --set-secrets DATABASE_URL=euroloo-migrate-database-url:latest \
  --task-timeout 3h --max-retries 0 --memory 1Gi

# Quick test with one small country
gcloud run jobs execute euroloo-osm-sync --region europe-west1 --update-env-vars OSM_COUNTRIES=LU --wait

# First full run; OSM_RETIRE_UNSEEN also hides rows from the old PBF import that OpenStreetMap no longer has
gcloud run jobs execute euroloo-osm-sync --region europe-west1 --update-env-vars OSM_RETIRE_UNSEEN=true

# Weekly schedule: Sundays 03:17 Berlin time
gcloud run jobs add-iam-policy-binding euroloo-osm-sync --region europe-west1 \
  --member serviceAccount:$SA --role roles/run.invoker
gcloud scheduler jobs create http euroloo-osm-sync-weekly --location europe-west1 \
  --schedule "17 3 * * 0" --time-zone Europe/Berlin \
  --uri "https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/europe-west1/jobs/euroloo-osm-sync:run" \
  --http-method POST --oauth-service-account-email $SA
```

Settings (env vars on the job or per execution): `OSM_COUNTRIES` (comma-separated ISO codes, default all), `OVERPASS_URL` (default `https://overpass-api.de/api/interpreter`), `OSM_RETIRE_UNSEEN=true`.

Locally: `cd server && OSM_COUNTRIES=LU pnpm sync:osm`.

## Vercel (frontend)

Project settings: Root Directory `client`, framework Next.js. Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Cloud Run service URL (`https://euroloo-git-<PROJECT_NUMBER>.europe-west1.run.app`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key (used by `proxy.ts`) |

`NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.

## Clerk

- Webhook endpoint: `<Cloud Run URL>/api/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted`. Its signing secret goes into `CLERK_WEBHOOK_SECRET`.
- Admin role: the API reads roles from the database (change them on the `/admin` page). The client shows the Admin link based on Clerk's `publicMetadata.role`, which the API updates on role changes; `server/scripts/sync-roles.ts` re-syncs all users from the database to Clerk.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Failed to load toilets" but Cloud Run shows 200s | The site's origin isn't in `CORS_ORIGINS` |
| Cloud Build fails at `migrate` | Migration secret holds the pooled URL, or Cloud Build can't read the secret |
| New Cloud Run instances fail to start | `euroloo-database-url` deleted or not readable by the service account |
| "Authentication is not configured on the server" (500) | `CLERK_SECRET_KEY` missing on Cloud Run; the API also logs `Missing environment variables` at startup |
| OSM sync execution failed | Check its logs for `sync failed`; usually an Overpass timeout or rate limit for one country. Rerun with `OSM_COUNTRIES=<code>` |
| Photo upload: "Failed while requesting an upload URL" | `GCS_BUCKET_NAME` unset, or missing Token Creator role |
| Photo upload: "Failed while uploading to storage" | Bucket CORS doesn't include the site's origin |
| Photo upload: "Failed while saving the photo" | Missing `storage.objectAdmin` on the bucket, or the file is over 5MB / not JPEG, PNG or WebP |
