import { JPEG_BYTES, PNG_BYTES, WEBP_BYTES } from '../testing/fakes';
import { detectImageType } from './image-signature';

describe('detectImageType', () => {
  it('recognises png, jpeg and webp by their first bytes', () => {
    expect(detectImageType(PNG_BYTES)).toBe('image/png');
    expect(detectImageType(JPEG_BYTES)).toBe('image/jpeg');
    expect(detectImageType(WEBP_BYTES)).toBe('image/webp');
  });

  it('rejects other content, even when it pretends', () => {
    expect(detectImageType(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    // RIFF container, but not WebP (this is a WAV file)
    expect(detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]))).toBeNull();
  });
});
