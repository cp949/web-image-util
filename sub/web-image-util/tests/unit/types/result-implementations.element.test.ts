/**
 * ElementResultImpl의 속성 노출, canvas 변환, canvas mock 경유 변환을 단정한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElementResultImpl } from '../../../src/types/result-implementations.internal';

describe('ElementResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const img = document.createElement('img');
    const impl = new ElementResultImpl(img, 1024, 768, 30, { width: 2048, height: 1536 }, 'png');

    expect(impl.element).toBe(img);
    expect(impl.width).toBe(1024);
    expect(impl.height).toBe(768);
    expect(impl.processingTime).toBe(30);
    expect(impl.originalSize).toEqual({ width: 2048, height: 1536 });
    expect(impl.format).toBe('png');
  });

  it('선택 인자(originalSize, format) 없이 생성하면 undefined다', () => {
    const img = document.createElement('img');
    const impl = new ElementResultImpl(img, 100, 100, 1);

    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBeUndefined();
  });
});

describe('ElementResultImpl.toCanvas — 정상 경로', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canvas.width/height가 인스턴스 값으로 설정되고 ctx.drawImage가 (element, 0, 0)으로 호출된다', async () => {
    const img = document.createElement('img') as HTMLImageElement;
    const impl = new ElementResultImpl(img, 200, 150, 0);

    const mockCanvas = document.createElement('canvas');
    const mockCtx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(mockCanvas, 'getContext').mockReturnValue(mockCtx as any);

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') return mockCanvas as any;
      throw new Error(`예상치 못한 태그: ${tagName}`);
    });

    try {
      const result = await impl.toCanvas();

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(img, 0, 0);
      expect(result).toBe(mockCanvas);
    } finally {
      createElementSpy.mockRestore();
    }
  });
});

describe('ElementResultImpl.toCanvas — 2D context 부재 경계', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canvas.getContext("2d")가 null이면 CANVAS_CREATION_FAILED 오류를 던진다', async () => {
    const img = document.createElement('img') as HTMLImageElement;
    const impl = new ElementResultImpl(img, 100, 100, 0);

    // 먼저 canvas를 생성한 뒤 getContext만 null로 교체한다
    const mockCanvas = document.createElement('canvas');
    vi.spyOn(mockCanvas, 'getContext').mockReturnValue(null);

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') return mockCanvas as any;
      throw new Error(`예상치 못한 태그: ${tagName}`);
    });

    try {
      await expect(impl.toCanvas()).rejects.toMatchObject({ code: 'CANVAS_CREATION_FAILED' });
    } finally {
      createElementSpy.mockRestore();
    }
  });
});

describe('ElementResultImpl 변환 메서드 — canvas mock 경유', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** toCanvas를 mock canvas로 교체한 ElementResultImpl과 spy를 반환한다. */
  function buildElementImplWithMockCanvas(w = 100, h = 100) {
    const img = document.createElement('img') as HTMLImageElement;
    const impl = new ElementResultImpl(img, w, h, 0);
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = w;
    mockCanvas.height = h;
    const toBlobSpy = vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['payload'], { type: type! }));
    });
    vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);
    return { impl, toBlobSpy, mockCanvas };
  }

  it('toBlob() 옵션 없음 → canvas.toBlob을 image/png로 호출하고 Blob을 반환한다', async () => {
    const { impl, toBlobSpy } = buildElementImplWithMockCanvas();

    const result = await impl.toBlob();

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/png', undefined);
    expect(result).toBeInstanceOf(Blob);
  });

  it('toBlob({ format: "jpeg", quality: 0.8 }) → canvas.toBlob에 image/jpeg와 quality를 전달한다', async () => {
    const { impl, toBlobSpy } = buildElementImplWithMockCanvas();

    await impl.toBlob({ format: 'jpeg', quality: 0.8 });

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
  });

  it('toDataURL() → canvas.toDataURL을 image/png로 호출하고 string을 반환한다', async () => {
    const { impl, mockCanvas } = buildElementImplWithMockCanvas();

    const result = await impl.toDataURL();

    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png', undefined);
    expect(typeof result).toBe('string');
  });

  it('toFile(filename) → 지정한 파일명과 blob.type을 가진 File을 반환한다', async () => {
    const { impl } = buildElementImplWithMockCanvas();

    const file = await impl.toFile('output.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.png');
    expect(file.type).toBe('image/png');
  });

  it('toArrayBuffer() → blob payload를 ArrayBuffer로 반환한다', async () => {
    const { impl } = buildElementImplWithMockCanvas();

    const buf = await impl.toArrayBuffer();

    // mock canvas.toBlob이 'payload'(7바이트) Blob을 반환하므로 byteLength도 7이다
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(7);
  });
});
