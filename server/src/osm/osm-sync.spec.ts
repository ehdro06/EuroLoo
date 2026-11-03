import type { PrismaClient } from '@prisma/client';
import { buildCountryQuery, fetchCountryToilets, runOsmSync, SyncOptions } from './osm-sync.js';

const silentLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
const noSleep = jest.fn().mockResolvedValue(undefined);

const overpassResponse = (elements: unknown[], status = 200, remark?: string) =>
  ({ ok: status === 200, status, json: async () => ({ elements, remark }) }) as Response;

const toiletNode = (id: number) => ({ type: 'node', id, lat: 50, lon: 10, tags: { amenity: 'toilets' } });

const baseOptions = (fetchImpl: jest.Mock): SyncOptions => ({
  countries: ['LU'],
  fetchImpl: fetchImpl as unknown as typeof fetch,
  sleep: noSleep,
  logger: silentLogger,
});

describe('buildCountryQuery', () => {
  it('queries nodes, ways and relations in the country area with centers', () => {
    const query = buildCountryQuery('DE');
    expect(query).toContain('area["ISO3166-1"="DE"][admin_level=2]');
    expect(query).toContain('nwr["amenity"="toilets"]');
    expect(query).toContain('out center tags;');
  });
});

describe('fetchCountryToilets', () => {
  it('retries after a server error and dedupes elements', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(overpassResponse([], 504))
      .mockResolvedValueOnce(overpassResponse([toiletNode(1), toiletNode(1), toiletNode(2)]));

    const toilets = await fetchCountryToilets('LU', baseOptions(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(toilets.map((t) => t.externalId)).toEqual(['node/1', 'node/2']);
  });

  it('treats an Overpass timeout remark as a failure', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(overpassResponse([], 200, 'runtime error: Query timed out'));

    await expect(fetchCountryToilets('LU', { ...baseOptions(fetchImpl), maxAttempts: 2 })).rejects.toThrow(
      'Overpass error',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('runOsmSync', () => {
  const createPrisma = (existingCount: number) => ({
    toilet: { count: jest.fn().mockResolvedValue(existingCount) },
    $executeRaw: jest.fn().mockResolvedValue(0),
  });

  it('keeps going when one country fails and reports it', async () => {
    const prisma = createPrisma(0);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(overpassResponse([], 500))
      .mockResolvedValueOnce(overpassResponse([toiletNode(1)]));

    const summary = await runOsmSync(prisma as unknown as PrismaClient, {
      ...baseOptions(fetchImpl),
      countries: ['XX', 'LU'],
      maxAttempts: 1,
      retireUnseen: true,
    });

    expect(summary.failed).toEqual([{ country: 'XX', error: 'Overpass responded with 500' }]);
    expect(summary.succeeded).toMatchObject([{ country: 'LU', fetched: 1 }]);
    // Retiring old rows is unsafe when a country failed
    expect(summary.retired).toBe(0);
  });

  it('skips removals when a country returns far fewer toilets than stored', async () => {
    const prisma = createPrisma(100);
    const fetchImpl = jest.fn().mockResolvedValue(overpassResponse([toiletNode(1)]));

    const summary = await runOsmSync(prisma as unknown as PrismaClient, baseOptions(fetchImpl));

    expect(summary.succeeded[0]).toMatchObject({ fetched: 1, removed: 0, removalsSkipped: true });
    // Only the upsert ran, not the removal UPDATE
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('removes toilets that disappeared when the result looks complete', async () => {
    const prisma = createPrisma(2);
    prisma.$executeRaw.mockResolvedValueOnce(2).mockResolvedValueOnce(1); // upsert, then removal
    const fetchImpl = jest.fn().mockResolvedValue(overpassResponse([toiletNode(1), toiletNode(2)]));

    const summary = await runOsmSync(prisma as unknown as PrismaClient, baseOptions(fetchImpl));

    expect(summary.succeeded[0]).toMatchObject({ fetched: 2, removed: 1, removalsSkipped: false });
  });
});
