import { describe, expect, it, vi } from 'vitest';
import { processImage } from '../../../../src/processor';
import { createTestImageBlob } from '../../../utils/image-helper';

describe('출력 포맷', () => {
  it('Blob으로 출력한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'red');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('Canvas로 출력한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'blue');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();

    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('Data URL로 출력한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'green');
    const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toDataURL();

    expect(typeof result.dataURL).toBe('string');
    expect(result.dataURL).toMatch(/^data:image\//);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('quality: 0을 명시하면 그대로 전달한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'red');
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    await processImage(testBlob)
      .resize({ fit: 'cover', width: 200, height: 200 })
      .toBlob({ format: 'jpeg', quality: 0 });

    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0);
    toBlobSpy.mockRestore();
  });

  it('브라우저가 fallback MIME을 반환하면 실제 포맷을 보고한다 (null 없음)', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'red');
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      _quality?: number,
    ) {
      if (type === 'image/avif') {
        callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: 'image/png' }));
        return;
      }
      callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: type || 'image/png' }));
    });

    try {
      const result = await processImage(testBlob)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toBlob({ format: 'avif', fallbackFormat: 'png' });

      expect(toBlobSpy).toHaveBeenCalledTimes(1);
      expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/avif', expect.any(Number));
      expect(result.blob.type).toBe('image/png');
      expect(result.format).toBe('png');
    } finally {
      toBlobSpy.mockRestore();
    }
  });

  it('요청한 포맷 생성 실패 시 fallback 포맷으로 재시도한다', async () => {
    const testBlob = await createTestImageBlob(400, 300, 'red');
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      _quality?: number,
    ) {
      if (type === 'image/avif') {
        callback(null);
        return;
      }
      callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: type || 'image/png' }));
    });

    try {
      const result = await processImage(testBlob)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toBlob({ format: 'avif', fallbackFormat: 'png' });

      expect(toBlobSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 'image/avif', expect.any(Number));
      expect(toBlobSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 'image/png', expect.any(Number));
      expect(result.blob.type).toBe('image/png');
      expect(result.format).toBe('png');
    } finally {
      toBlobSpy.mockRestore();
    }
  });
});
