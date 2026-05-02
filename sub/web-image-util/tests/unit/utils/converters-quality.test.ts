import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertToBlob,
  convertToDataURL,
  ensureBlob,
  ensureDataURL,
  ensureFile,
  isDataURLString,
} from '../../../src/utils/converters';

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

  it('should detect Data URL strings', () => {
    expect(isDataURLString('data:image/png;base64,abc')).toBe(true);
    expect(isDataURLString('https://example.com/image.png')).toBe(false);
    expect(isDataURLString('<svg viewBox="0 0 1 1"></svg>')).toBe(false);
    expect(isDataURLString(null)).toBe(false);
  });

  it('should preserve existing Data URL strings even when output options are provided', async () => {
    const dataURL = 'data:image/png;base64,already-data-url';

    await expect(ensureDataURL(dataURL, { format: 'jpeg', quality: 0.95 })).resolves.toBe(dataURL);
  });

  it('should encode Blob sources to Data URL with output options', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toDataURLSpy = vi.spyOn(canvasPrototype, 'toDataURL');

    await ensureDataURL(blob, { format: 'jpeg', quality: 0.95 });

    expect(toDataURLSpy).toHaveBeenLastCalledWith('image/jpeg', 0.95);
  });

  it('should preserve explicit zero quality when ensuring Blob sources as Data URL', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toDataURLSpy = vi.spyOn(canvasPrototype, 'toDataURL');

    await ensureDataURL(blob, { format: 'webp', quality: 0 });

    expect(toDataURLSpy).toHaveBeenLastCalledWith('image/webp', 0);
  });

  it('should reuse Blob sources when Blob output needs no re-encoding', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });

    await expect(ensureBlob(blob)).resolves.toBe(blob);
    await expect(ensureBlob(blob, { format: 'png' })).resolves.toBe(blob);
  });

  it('should re-encode Blob sources when quality is explicitly provided', async () => {
    const blob = new Blob(['mock'], { type: 'image/png' });
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    const result = await ensureBlob(blob, { format: 'png', quality: 0.5 });

    expect(result).not.toBe(blob);
    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/png', 0.5);
  });

  it('should reuse File sources when filename and output options do not require changes', async () => {
    const file = new File(['mock'], 'image.png', { type: 'image/png' });

    await expect(ensureFile(file, 'image.png', { format: 'png' })).resolves.toBe(file);
  });

  it('should recreate File sources when filename or output options require changes', async () => {
    const file = new File(['mock'], 'image.png', { type: 'image/png' });

    const renamed = await ensureFile(file, 'renamed.png');
    const reencoded = await ensureFile(file, 'image.jpg', { format: 'jpeg', quality: 0.8 });

    expect(renamed).not.toBe(file);
    expect(renamed.name).toBe('renamed.png');
    expect(reencoded).not.toBe(file);
    expect(reencoded.name).toBe('image.jpg');
    expect(reencoded.type).toBe('image/jpeg');
  });
});
