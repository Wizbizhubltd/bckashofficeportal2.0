/**
 * Shrinks a photo or scanned image on the device before it's uploaded, so staff on mobile data send
 * a few hundred KB instead of a multi-megabyte camera original, and storage holds less. The image is
 * scaled to fit `maxDimension` on its longest side and re-encoded as JPEG. PDFs and anything that
 * isn't a JPG/PNG/WebP pass through untouched, as does an image the browser can't decode — the
 * server's own checks still apply either way.
 */

/** Long-edge limits: documents keep enough detail for small print; portraits don't need it. */
export const DOCUMENT_MAX_DIMENSION = 2000;
export const PHOTO_MAX_DIMENSION = 1280;

const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/i;
const JPEG_QUALITY = 0.8;

export async function compressImage(file: File, maxDimension: number = PHOTO_MAX_DIMENSION): Promise<File> {
  if (!COMPRESSIBLE.test(file.type)) return file;

  try {
    const image = await decode(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    // JPEG has no transparency: give transparent PNGs a white background rather than black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.source, 0, 0, width, height);
    image.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    // Keep the original if re-encoding didn't help (an already small, well-compressed JPEG).
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** Decodes with the photo's EXIF rotation applied, so phone pictures don't upload sideways. */
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}
