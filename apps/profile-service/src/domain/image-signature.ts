export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
  return buffer.length >= offset + signature.length && signature.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Finds the real image type from the first bytes ("magic bytes").
 * The Content-Type header and the file name come from the client and can lie.
 */
export function detectImageType(buffer: Buffer): ImageMime | null {
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(buffer, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  // WebP is "RIFF", 4 bytes of size, then "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (startsWith(buffer, riff) && startsWith(buffer, webp, 8)) {
    return 'image/webp';
  }
  return null;
}

export const EXTENSION_BY_MIME: Record<ImageMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
