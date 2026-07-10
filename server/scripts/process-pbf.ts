import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to the project root
const projectRoot = path.resolve(__dirname, '../../');
const pbfFileName = 'europe-latest.osm.pbf';
const pbfFilePath = path.join(projectRoot, pbfFileName);
const dockerImage = 'stefda/osmium-tool';

console.log(`\n===========================================`);
console.log(` EuroLoo PBF Processing & Extraction Script `);
console.log(`===========================================\n`);

// 1. Check if the PBF file exists
if (!fs.existsSync(pbfFilePath)) {
  console.error(`❌ ERROR: Could not find ${pbfFileName} in the project root:`);
  console.error(`   Expected path: ${pbfFilePath}`);
  console.error(`   Please download it from https://download.geofabrik.de/europe-latest.osm.pbf and place it there.`);
  process.exit(1);
}
console.log(`✅ Found PBF file: ${pbfFilePath}`);

// 2. Check if Docker is running
try {
  execSync('docker info', { stdio: 'ignore' });
} catch (e) {
  console.error(`❌ ERROR: Docker is not running or not installed.`);
  console.error(`   This script requires Docker to run the osmium-tool.`);
  process.exit(1);
}
console.log(`✅ Docker is running.`);

// Helper to run docker commands mapping the project root to /data
function runOsmiumCommand(args: string[], description: string) {
  console.log(`\n⏳ ${description}...`);
  // On Windows, the path needs to be properly formatted for Docker volume mounts, 
  // but usually Docker Desktop handles standard absolute paths fine.
  const dockerArgs = [
    'run', '--rm', 
    '-v', `${projectRoot}:/data`, 
    dockerImage, 
    'osmium',
    ...args
  ];
  
  const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
  
  if (result.error || result.status !== 0) {
    console.error(`\n❌ ERROR: Command failed: osmium ${args.join(' ')}`);
    if (result.status === null) {
       console.error(`   Process was interrupted or could not start.`);
    } else {
       console.error(`   Exit code: ${result.status}`);
    }
    process.exit(1);
  }
  console.log(`✅ ${description} completed successfully.`);
}

// 3. Structural Check (Defense against corrupted/incomplete 33GB downloads)
runOsmiumCommand(
  ['fileinfo', '-e', `/data/${pbfFileName}`],
  `Performing deep structural integrity check on ${pbfFileName}`
);

// 4. Extract Toilets to a smaller PBF
const tempPbf = 'toilets.osm.pbf';
runOsmiumCommand(
  ['tags-filter', `/data/${pbfFileName}`, 'n/amenity=toilets', '-o', `/data/${tempPbf}`, '--overwrite'],
  `Extracting toilet nodes into ${tempPbf}`
);

// 5. Convert to OPL format for the seed script
const finalOpl = 'toilets.opl';
runOsmiumCommand(
  ['cat', '-f', 'opl', `/data/${tempPbf}`, '-o', `/data/${finalOpl}`, '--overwrite'],
  `Converting extracted PBF to OPL format (${finalOpl})`
);

console.log(`\n🎉 SUCCESS! Extracted data to ${finalOpl} in the project root.`);
console.log(`You can now run 'pnpm ts-node prisma/seed.ts' to import the data into the database.`);
