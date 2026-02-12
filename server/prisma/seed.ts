import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

const prisma = new PrismaClient();

// Path to the OPL file (assumed to be in the project root or server root)
// Adjust if the user kept it in c:\dev\EuroLoo
// The docker command mapped ${PWD} (c:\dev\EuroLoo) to /data.
// And output to /data/toilets.opl -> c:\dev\EuroLoo\toilets.opl
const OPL_FILE_PATH = path.resolve('../toilets.opl');

function decodeOplString(s: string): string {
  // OPL escapes: % -> %25, , -> %2c, = -> %3d
  // We can use decodeURIComponent but we must be robust against bad encoding or null bytes
  try {
    // Stage 1: Fix obvious patterns reported by user
    // Replace "%20%" with "%20" to avoid "Space + %" artifacts
    let fixed = s.replace(/%20%/g, '%20');

    // Stage 2: Escape any remaining % that is not followed by two hex digits
    // This allows decodeURIComponent to process valid codes and ignore the rest
    fixed = fixed.replace(/%(?![0-9a-fA-F]{2})/g, '%25').replace(/\+/g, '%20');
    
    const decoded = decodeURIComponent(fixed);
    
    // Stage 3: Cleanup Control Characters (0x00-0x1F) 
    // Remove null bytes, backspaces, etc., but keep Newlines (\n \r) and Tabs (\t)
    // Range \x00-\x08 matches null to backspace. \x0B-\x0C matches VT, FF. \x0E-\x1F matches others.
    return decoded.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); 
  } catch (e) {
    // Fallback: simple text replacement if strict decoding fails entirely
    return s
      .replace(/%20%/g, ' ') // Handle the specific artifact
      .replace(/%20/g, ' ')
      .replace(/%2C/gi, ',')
      .replace(/%3D/gi, '=')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
}

function parseTags(tagString: string): Record<string, string> {
  const tags: Record<string, string> = {};
  if (!tagString) return tags;

  // OPL tags are just key=value,key=value...
  // But wait, if value contains comma? It is escaped as %2c.
  // So we can safely split by comma.
  // The tag string follows 'T' prefix (which we should have stripped before calling this, or strip here)
  
  // Example: Tname=Public Toilet,amenity=toilets
  const clean = tagString.startsWith('T') ? tagString.substring(1) : tagString;
  
  const parts = clean.split(',');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    
    // keys and values are URL encoded in OPL
    const key = decodeOplString(part.substring(0, eqIndex));
    const val = decodeOplString(part.substring(eqIndex + 1));
    tags[key] = val;
  }
  return tags;
}

async function main() {
  console.log(`Looking for OPL file at: ${OPL_FILE_PATH}`);
  
  if (!fs.existsSync(OPL_FILE_PATH)) {
    console.error(`File not found: ${OPL_FILE_PATH}`);
    console.error('Please ensure the osmium command finished and the file is in the root of the workspace.');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(OPL_FILE_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const batchSize = 1000;
  let batch: any[] = [];
  let count = 0;
  let skippedWays = 0;

  console.log('Starting import...');

  for await (const line of rl) {
    if (!line) continue;

    // We only handle Nodes (lines starting with 'n') for now because they have coordinates.
    // Ways (w) and Relations (r) in OPL do not contain coordinates unless pre-processed.
    if (line.startsWith('w') || line.startsWith('r')) {
      skippedWays++;
      continue;
    }

    if (!line.startsWith('n')) continue;

    // Parse OPL Line
    // Format: n123 v1 ... x13.4 y52.5 Tkey=val,key=val
    const parts = line.split(' ');
    
    let id: string = '';
    let lat: number | null = null;
    let lon: number | null = null;
    let tagsStr: string = '';

    for (const part of parts) {
      const char = part.charAt(0);
      const val = part.substring(1);

      if (char === 'n') id = val;
      else if (char === 'x') lon = parseFloat(val);
      else if (char === 'y') lat = parseFloat(val);
      else if (char === 'T') tagsStr = part; // Keep the 'T' for now
    }

    if (!id || lat === null || lon === null) continue;

    const tags = parseTags(tagsStr);

    // CRITICAL: Filter out nodes that don't have 'amenity=toilets'.
    // Osmium output includes untagged nodes that are part of Ways (buildings),
    // but they are just geometry points, not the POI itself.
    if (tags['amenity'] !== 'toilets') {
       continue;
    }

    const fee = tags['fee'] || null;
    const isFree = fee === 'no' || fee === '0';
    const isPaid = fee === 'yes' || (fee && (fee.includes('cent') || fee.includes('eur') || fee.includes('€'))) ? true : false;
    const wheelchair = tags['wheelchair'] || null;
    const isAccessible = wheelchair === 'yes' || wheelchair === 'designated';

    batch.push({
      externalId: `node/${id}`,
      lat,
      lon,
      name: tags['name'] || null,
      operator: tags['operator'] || null,
      fee: fee,
      isFree,
      isPaid,
      openingHours: tags['opening_hours'] || null,
      wheelchair,
      isAccessible,
      // Default Trust for OSM data
      isVerified: true,
      verifyCount: 3, 
      updatedAt: new Date(),
    });

    if (batch.length >= batchSize) {
      await saveBatch(batch);
      count += batch.length;
      console.log(`Imported ${count} toilets...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await saveBatch(batch);
    count += batch.length;
  }

  console.log(`\nImport complete!`);
  console.log(`Total Nodes imported: ${count}`);
  console.log(`Skipped Ways/Relations: ${skippedWays} (OPL format doesn't include geometry for these)`);
}

async function saveBatch(toilets: any[]) {
    // We use transaction to ensure data integrity, though createMany is also atomic-ish.
    // However, we want to skip duplicates or upsert.
    // Prisma createMany does not support upsert (on conflict update) natively in all dialects easily with full update logic,
    // but createMany has skipDuplicates: true.
    // Since we want to update existing records with fresh data, we ideally want UPSERT.
    // Upserting 1000 records one by one is slow.
    // 'skipDuplicates: true' is fast but won't update old data.
    // For this seed/migration, we'll assume we want to fill the DB.
    
    // Strategy: Use createMany with skipDuplicates for speed. 
    // If you need to update, you'd typically truncate or use raw query.
    
    await prisma.toilet.createMany({
      data: toilets,
      skipDuplicates: true,
    });

    // PostGIS Sync manually after batch insert
    // Since createMany ignores the 'location' column (it's unsupported in Prisma Client DTO), 
    // we must populate it manually.
    // Efficient approach: Update any row where location is NULL.
    await prisma.$executeRaw`
      UPDATE "Toilet" 
      SET location = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
      WHERE location IS NULL
    `;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
