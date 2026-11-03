import { Prisma, PrismaClient } from '@prisma/client';
import { mapOsmElement, OsmToilet, OverpassElement } from './osm-toilet.js';

export const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'EuroLoo/1.0 (+https://github.com/ehdro06/euroloo)';
const UPSERT_BATCH_SIZE = 500;
// If a country suddenly returns far fewer toilets than we have, assume a partial
// Overpass response rather than mass deletions in OpenStreetMap
const MIN_RESULT_RATIO_FOR_REMOVALS = 0.5;

type Fetch = typeof fetch;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface SyncOptions {
  countries: readonly string[];
  overpassUrl?: string;
  delayBetweenCountriesMs?: number;
  maxAttempts?: number;
  // Soft-delete OSM toilets that no country query returned (e.g. rows from the old PBF import)
  retireUnseen?: boolean;
  fetchImpl?: Fetch;
  sleep?: (ms: number) => Promise<void>;
  logger?: Logger;
}

export interface CountryResult {
  country: string;
  fetched: number;
  removed: number;
  removalsSkipped: boolean;
}

export interface SyncSummary {
  succeeded: CountryResult[];
  failed: { country: string; error: string }[];
  retired: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function buildCountryQuery(countryCode: string): string {
  return [
    '[out:json][timeout:600];',
    `area["ISO3166-1"="${countryCode}"][admin_level=2]->.country;`,
    'nwr["amenity"="toilets"](area.country);',
    'out center tags;',
  ].join('\n');
}

export async function fetchCountryToilets(
  countryCode: string,
  { overpassUrl = DEFAULT_OVERPASS_URL, maxAttempts = 3, fetchImpl = fetch, sleep = defaultSleep, logger = console }: SyncOptions,
): Promise<OsmToilet[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetchImpl(overpassUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: buildCountryQuery(countryCode) }),
      });
      if (!response.ok) throw new Error(`Overpass responded with ${response.status}`);

      const body = (await response.json()) as { elements?: OverpassElement[]; remark?: string };
      // Overpass reports timeouts and memory limits as a remark on an otherwise valid response
      if (body.remark && /error|timed out|runtime/i.test(body.remark)) {
        throw new Error(`Overpass error: ${body.remark}`);
      }

      const toilets = (body.elements ?? []).map(mapOsmElement).filter((t): t is OsmToilet => t !== null);
      // An element on a border can appear twice; keep one
      return [...new Map(toilets.map((t) => [t.externalId, t])).values()];
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      const backoffMs = 30_000 * attempt;
      logger.warn(`${countryCode}: attempt ${attempt} failed (${errorMessage(error)}), retrying in ${backoffMs / 1000}s`);
      await sleep(backoffMs);
    }
  }
}

export async function upsertToilets(
  prisma: PrismaClient,
  toilets: OsmToilet[],
  countryCode: string,
  syncedAt: Date,
): Promise<void> {
  for (let i = 0; i < toilets.length; i += UPSERT_BATCH_SIZE) {
    const rows = toilets.slice(i, i + UPSERT_BATCH_SIZE).map(
      (t) => Prisma.sql`(
        ${t.externalId}, ${t.lat}::float8, ${t.lon}::float8, ${t.name}, ${t.operator}, ${t.fee}, ${t.isFree}, ${t.isPaid},
        ${t.openingHours}, ${t.wheelchair}, ${t.isAccessible}, ${t.access}, ${t.isIndoor}, ${t.hasChangingTable},
        ${t.hasDrinkingWater}, ${t.isUnisex}, ${t.isFemale}, ${t.isMale}, ${t.description},
        ST_SetSRID(ST_MakePoint(${t.lon}::float8, ${t.lat}::float8), 4326),
        ${countryCode}, ${syncedAt}, ${syncedAt}, true, 3
      )`,
    );

    // Only OSM-owned fields are updated; community data (votes, reviews, hidden state) is kept
    await prisma.$executeRaw`
      INSERT INTO "Toilet" (
        "externalId", lat, lon, name, operator, fee, "isFree", "isPaid",
        "openingHours", wheelchair, "isAccessible", access, "isIndoor", "hasChangingTable",
        "hasDrinkingWater", "isUnisex", "isFemale", "isMale", description,
        location, "countryCode", "osmSyncedAt", "updatedAt", "isVerified", "verifyCount"
      )
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("externalId") DO UPDATE SET
        lat = EXCLUDED.lat, lon = EXCLUDED.lon, name = EXCLUDED.name, operator = EXCLUDED.operator,
        fee = EXCLUDED.fee, "isFree" = EXCLUDED."isFree", "isPaid" = EXCLUDED."isPaid",
        "openingHours" = EXCLUDED."openingHours", wheelchair = EXCLUDED.wheelchair,
        "isAccessible" = EXCLUDED."isAccessible", access = EXCLUDED.access, "isIndoor" = EXCLUDED."isIndoor",
        "hasChangingTable" = EXCLUDED."hasChangingTable", "hasDrinkingWater" = EXCLUDED."hasDrinkingWater",
        "isUnisex" = EXCLUDED."isUnisex", "isFemale" = EXCLUDED."isFemale", "isMale" = EXCLUDED."isMale",
        description = EXCLUDED.description, location = EXCLUDED.location,
        "countryCode" = EXCLUDED."countryCode", "osmSyncedAt" = EXCLUDED."osmSyncedAt",
        "osmDeletedAt" = NULL, "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

// Soft-deletes toilets of this country that the latest query no longer returned
async function removeMissing(prisma: PrismaClient, countryCode: string, syncedAt: Date): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Toilet" SET "osmDeletedAt" = ${syncedAt}
    WHERE "countryCode" = ${countryCode}
      AND "osmDeletedAt" IS NULL
      AND "osmSyncedAt" < ${syncedAt}
  `;
}

export async function syncCountry(
  prisma: PrismaClient,
  countryCode: string,
  options: SyncOptions,
): Promise<CountryResult> {
  const syncedAt = new Date();
  const toilets = await fetchCountryToilets(countryCode, options);

  const existing = await prisma.toilet.count({ where: { countryCode, osmDeletedAt: null } });
  await upsertToilets(prisma, toilets, countryCode, syncedAt);

  const removalsSkipped = existing > 0 && toilets.length < existing * MIN_RESULT_RATIO_FOR_REMOVALS;
  if (removalsSkipped) {
    (options.logger ?? console).warn(
      `${countryCode}: got ${toilets.length} toilets but ${existing} are stored; skipping removals this run`,
    );
  }
  const removed = removalsSkipped ? 0 : await removeMissing(prisma, countryCode, syncedAt);

  return { country: countryCode, fetched: toilets.length, removed, removalsSkipped };
}

export async function runOsmSync(prisma: PrismaClient, options: SyncOptions): Promise<SyncSummary> {
  const { countries, delayBetweenCountriesMs = 10_000, sleep = defaultSleep, logger = console } = options;
  const runStartedAt = new Date();
  const summary: SyncSummary = { succeeded: [], failed: [], retired: 0 };

  for (const [index, country] of countries.entries()) {
    if (index > 0) await sleep(delayBetweenCountriesMs); // Be polite to the shared Overpass server
    try {
      const result = await syncCountry(prisma, country, options);
      summary.succeeded.push(result);
      logger.log(`${country}: ${result.fetched} toilets, ${result.removed} removed`);
    } catch (error) {
      summary.failed.push({ country, error: errorMessage(error) });
      logger.error(`${country}: sync failed: ${errorMessage(error)}`);
    }
  }

  // Only safe after every country succeeded, otherwise toilets of a failed country would be retired
  if (options.retireUnseen && summary.failed.length === 0) {
    summary.retired = await prisma.$executeRaw`
      UPDATE "Toilet" SET "osmDeletedAt" = ${runStartedAt}
      WHERE "osmSyncedAt" IS NULL AND "osmDeletedAt" IS NULL AND "isUserCreated" = false
    `;
    logger.log(`Retired ${summary.retired} toilets from the old import that OpenStreetMap no longer has`);
  }

  return summary;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
