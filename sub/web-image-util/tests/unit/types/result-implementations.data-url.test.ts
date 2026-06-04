/**
 * DataURLResultImpl의 속성 노출과 canvas 경유 변환 경로를 단정한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataURLResultImpl } from '../../../src/types/result-implementations.internal';

// 각 테스트 후 spy/mock을 일괄 복원한다
afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataURLResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 320, 240, 12, { width: 640, height: 480 }, 'png');

    expect(impl.dataURL).toBe('data:image/png;base64,abc');
    expect(impl.width).toBe(320);
    expect(impl.height).toBe(240);
    expect(impl.processingTime).toBe(12);
    expect(impl.originalSize).toEqual({ width: 640, height: 480 });
    expect(impl.format).toBe('png');
  });

  it('선택 인자(originalSize, format) 없이 생성하면 undefined다', () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 100, 100, 5);

    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBeUndefined();
  });
});

describe('DataURLResultImpl 변환 메서드 — canvas 경유 검증', () => {
  /** toCanvas를 mock canvas로 교체한 impl과 canvas spy를 반환한다. */
  function buildImplWithMockCanvas(dataURL = 'data:image/png;base64,abc', w = 100, h = 100) {
    const impl = new DataURLResultImpl(dataURL, w, h, 0);
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = w;
    mockCanvas.height = h;
    const canvasSpy = vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['payload'], { type: type! }));
    });
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);
    return { impl, canvasSpy };
  }

  it('toBlob() 옵션 없음 → canvas.toBlob을 image/png로 호출하고 Blob을 반환한다', async () => {
    const { impl, canvasSpy } = buildImplWithMockCanvas();

    const result = await impl.toBlob();

    expect(canvasSpy).toHaveBeenCalledWith(expect.any(Function), 'image/png', undefined);
    expect(result).toBeInstanceOf(Blob);
  });

  it('toBlob({ format: "jpeg" }) → canvas.toBlob을 image/jpeg와 quality로 호출한다', async () => {
    const { impl, canvasSpy } = buildImplWithMockCanvas();

    await impl.toBlob({ format: 'jpeg', quality: 0.85 });

    expect(canvasSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });

  it('toFile(filename) → 지정한 파일명과 blob.type을 가진 File을 반환한다', async () => {
    const { impl } = buildImplWithMockCanvas();

    const file = await impl.toFile('output.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.png');
    expect(file.type).toBe('image/png');
  });

  it('toArrayBuffer() → blob payload를 ArrayBuffer로 반환한다', async () => {
    const { impl } = buildImplWithMockCanvas();

    const buf = await impl.toArrayBuffer();

    // mock canvas.toBlob이 'payload'(7바이트) Blob을 반환하므로 byteLength도 7이다
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(7);
  });
});

describe('DataURLResultImpl.toFile — format 옵션 재인코딩 MIME 반영', () => {
  it('format 옵션을 지정하면 재인코딩된 blob.type이 File.type으로 전파된다', async () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 100, 100, 0);

    // toCanvas를 mock canvas로 교체해 실제 이미지 디코딩을 우회한다.
    const mockCanvas = document.createElement('canvas');
    vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['re-encoded'], { type: type! }));
    });
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const file = await impl.toFile('output.jpg', { format: 'jpeg', quality: 0.85 });

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.jpg');
    // data URL은 canvas 재인코딩을 거치므로 File.type은 옵션 format을 따른다.
    expect(file.type).toBe('image/jpeg');
  });
});
