// Syncs public toilets from OpenStreetMap (via the Overpass API) into the database.
// Runs weekly as a Cloud Run Job; see docs/DEPLOYMENT.md.
//
//   pnpm sync:osm                 # all countries in EUROPEAN_COUNTRIES
//   OSM_COUNTRIES=LU,LI pnpm sync:osm
//
// Env: DATABASE_URL (required), OSM_COUNTRIES, OVERPASS_URL, OSM_RETIRE_UNSEEN=true
import { PrismaClient } from '@prisma/client';
import { EUROPEAN_COUNTRIES } from '../src/osm/european-countries.js';
import { DEFAULT_OVERPASS_URL, runOsmSync } from '../src/osm/osm-sync.js';

async function main() {
  const countries = process.env.OSM_COUNTRIES
    ? process.env.OSM_COUNTRIES.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    : [...EUROPEAN_COUNTRIES];

  const prisma = new PrismaClient();
  const startedAt = Date.now();
  console.log(`Syncing ${countries.length} countries from ${process.env.OVERPASS_URL ?? DEFAULT_OVERPASS_URL}`);

  try {
    const summary = await runOsmSync(prisma, {
      countries,
      overpassUrl: process.env.OVERPASS_URL,
      retireUnseen: process.env.OSM_RETIRE_UNSEEN === 'true',
    });

    const fetched = summary.succeeded.reduce((sum, r) => sum + r.fetched, 0);
    const removed = summary.succeeded.reduce((sum, r) => sum + r.removed, 0);
    const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
    console.log(
      `Done in ${minutes} min: ${summary.succeeded.length} countries synced, ${fetched} toilets, ` +
        `${removed} removed, ${summary.retired} retired, ${summary.failed.length} failed`,
    );

    // A non-zero exit marks the Cloud Run Job execution as failed, so failures are visible
    if (summary.failed.length > 0) {
      console.error(`Failed countries: ${summary.failed.map((f) => f.country).join(', ')}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
