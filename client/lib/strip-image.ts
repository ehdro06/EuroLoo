// Re-encodes a photo in the browser before upload. Drawing it onto a canvas and
// exporting a new JPEG drops all metadata (EXIF incl. GPS position, camera details),
// so the location never leaves the device. Large phone photos are also scaled down,
// which makes uploads faster. The server re-encodes again, so this is a privacy
// and speed measure, not the security boundary.

export const MAX_UPLOAD_DIMENSION = 2048

export async function stripImage(file: File): Promise<Blob> {
  // "from-image" applies the EXIF orientation, so the photo stays upright without the tag
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is not available")
    context.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo"))), "image/jpeg", 0.85),
    )
  } finally {
    bitmap.close()
  }
}
