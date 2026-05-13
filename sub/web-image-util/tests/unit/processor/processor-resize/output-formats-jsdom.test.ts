/**
 * processImage 출력 포맷 검증 중 Canvas 입력만 사용해 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - Blob 입력 흐름은 `output-formats.test.ts`(happy-dom)에 남긴다.
 * - Canvas 입력은 source-converter가 그대로 통과시켜 출력 메서드까지 jsdom에서 동작한다.
 * - toBlob spy / fallback MIME mock 케이스는 출력 함수 호출 자체를 강제하므로 입력 타입에 무관하지만,
 *   일관성을 위해 jsdom 분리본도 Canvas 입력으로 통일한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { processImage } from '../../../../src/processor';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('출력 포맷 (Canvas 입력, jsdom-safe)', () => {
  it('Blob으로 출력한다', async () => {
    const canvas = createTestCanvas(400, 300, 'red');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('Canvas로 출력한다', async () => {
    const canvas = createTestCanvas(400, 300, 'blue');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();

    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('Data URL로 출력한다', async () => {
    const canvas = createTestCanvas(400, 300, 'green');
    const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toDataURL();

    expect(typeof result.dataURL).toBe('string');
    expect(result.dataURL).toMatch(/^data:image\//);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('quality: 0을 명시하면 그대로 전달한다', async () => {
    const canvas = createTestCanvas(400, 300, 'red');
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

    await processImage(canvas)
      .resize({ fit: 'cover', width: 200, height: 200 })
      .toBlob({ format: 'jpeg', quality: 0 });

    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0);
    toBlobSpy.mockRestore();
  });

  it('브라우저가 fallback MIME을 반환하면 실제 포맷을 보고한다 (null 없음)', async () => {
    const canvas = createTestCanvas(400, 300, 'red');
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      _quality?: number
    ) {
      if (type === 'image/avif') {
        callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: 'image/png' }));
        return;
      }
      callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: type || 'image/png' }));
    });

    try {
      const result = await processImage(canvas)
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
    const canvas = createTestCanvas(400, 300, 'red');
    const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      _quality?: number
    ) {
      if (type === 'image/avif') {
        callback(null);
        return;
      }
      callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: type || 'image/png' }));
    });

    try {
      const result = await processImage(canvas)
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
