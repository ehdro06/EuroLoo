import sharp from 'sharp';

export const MAX_IMAGE_DIMENSION = 2048;

// Re-encodes an uploaded photo so it is safe to publish:
// - applies the EXIF orientation, so the photo still shows upright
// - drops ALL metadata (EXIF incl. GPS position, camera serial, author; XMP; IPTC; ICC)
//   because sharp writes no metadata unless asked to
// - caps the size at 2048px and outputs JPEG, regardless of the uploaded format
// Throws if the input isn't a decodable image.
export async function sanitizeImage(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
