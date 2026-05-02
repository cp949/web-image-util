import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToBlob, convertToDataURL } from '../../../src/utils/converters';

describe('converter quality options', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should preserve explicit zero quality for Canvas to Blob conversion', async () => {
    const canvas = document.createElement('canvas');
    const canvasPrototype = Object.getPrototypeOf(canvas) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    await convertToBlob(canvas, { format: 'jpeg', quality: 0 });

    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0);
  });

  it('should preserve explicit zero quality for Canvas to Data URL conversion', async () => {
    const canvas = document.createElement('canvas');
    const canvasPrototype = Object.getPrototypeOf(canvas) as HTMLCanvasElement;
    const toDataURLSpy = vi.spyOn(canvasPrototype, 'toDataURL');

    await convertToDataURL(canvas, { format: 'webp', quality: 0 });

    expect(toDataURLSpy).toHaveBeenLastCalledWith('image/webp', 0);
  });
});
