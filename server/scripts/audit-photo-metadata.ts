// Reports stored photos that still contain metadata (EXIF incl. GPS, XMP, IPTC),
// e.g. photos uploaded before uploads were sanitized. Read-only by default.
//
//   GCS_BUCKET_NAME=<bucket> pnpm audit:photos          # report only
//   GCS_BUCKET_NAME=<bucket> pnpm audit:photos --fix    # rewrite affected photos in place
//
// --fix re-encodes each affected photo in its original format under the same name,
// so existing URLs keep working. Uses Application Default Credentials
// (gcloud auth application-default login) with read/write access to the bucket.
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import exifr from 'exifr';

const bucketName = process.env.GCS_BUCKET_NAME;
const fix = process.argv.includes('--fix');

async function main() {
  if (!bucketName) throw new Error('Set GCS_BUCKET_NAME');
  const bucket = new Storage().bucket(bucketName);
  const [files] = await bucket.getFiles();
  // pending/ holds raw uploads that are never published and expire on their own
  const photos = files.filter((file) => !file.name.startsWith('pending/'));

  let withMetadata = 0;
  let withGps = 0;
  for (const file of photos) {
    const [buffer] = await file.download();
    const meta = await sharp(buffer).metadata();
    const hasMetadata = Boolean(meta.exif || meta.xmp || meta.iptc);
    if (!hasMetadata) continue;

    withMetadata += 1;
    const gps = await exifr.gps(buffer).catch(() => undefined);
    if (gps) withGps += 1;
    console.log(`${file.name}: metadata${gps ? ' incl. GPS' : ''}`);

    if (fix) {
      const format = meta.format === 'png' || meta.format === 'webp' ? meta.format : 'jpeg';
      // Without withMetadata(), sharp writes no EXIF/XMP/IPTC
      const cleaned = await sharp(buffer).rotate().toFormat(format).toBuffer();
      await file.save(cleaned, { contentType: `image/${format}`, resumable: false });
      console.log(`  -> rewritten without metadata`);
    }
  }

  console.log(
    `\nChecked ${photos.length} photos: ${withMetadata} with metadata (${withGps} with GPS).` +
      (withMetadata && !fix ? ' Run again with --fix to clean them.' : ''),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
