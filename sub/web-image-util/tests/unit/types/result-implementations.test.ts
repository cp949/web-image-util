/**
 * 5개 Result 구현 클래스의 속성 노출, no-option 변환 경로, 옵션 있는 변환 분기를 단정한다.
 *
 * 속성 노출과 no-option 동일 참조 반환, 옵션 있는 canvas 경유 재인코딩 경로,
 * element 생성과 URL revoke 라이프사이클, 2D context 부재 경계를 다룬다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BlobResultImpl,
  CanvasResultImpl,
  DataURLResultImpl,
  ElementResultImpl,
  FileResultImpl,
} from '../../../src/types/result-implementations';
import { ImageProcessError } from '../../../src/types';
import { createTestCanvas } from '../../utils/canvas-helper';

// ─── DataURLResultImpl ────────────────────────────────────────────────────

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

// ─── BlobResultImpl ───────────────────────────────────────────────────────

describe('BlobResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const blob = new Blob(['mock'], { type: 'image/jpeg' });
    const impl = new BlobResultImpl(blob, 800, 600, 20, { width: 1600, height: 1200 }, 'jpeg');

    expect(impl.blob).toBe(blob);
    expect(impl.width).toBe(800);
    expect(impl.height).toBe(600);
    expect(impl.processingTime).toBe(20);
    expect(impl.originalSize).toEqual({ width: 1600, height: 1200 });
    expect(impl.format).toBe('jpeg');
  });
});

describe('BlobResultImpl no-option 경로', () => {
  it('toBlob() 옵션 없음 → 기존 blob 인스턴스 그대로 반환(재인코딩 없음)', async () => {
    const original = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(original, 100, 100, 0);

    const result = await impl.toBlob();

    // 동일 참조여야 한다 — canvas 경유 재인코딩이 발생하면 다른 인스턴스다
    expect(result).toBe(original);
  });

  it('toFile() 옵션 없음 → 기존 blob을 래핑한 File 반환(canvas 경유 없음)', async () => {
    const original = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(original, 100, 100, 0);

    const file = await impl.toFile('output.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.png');
    // type은 원본 blob.type을 그대로 사용한다
    expect(file.type).toBe('image/png');
  });
});

// ─── FileResultImpl ───────────────────────────────────────────────────────

describe('FileResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    const impl = new FileResultImpl(file, 400, 300, 8, undefined, 'jpeg');

    expect(impl.file).toBe(file);
    expect(impl.width).toBe(400);
    expect(impl.height).toBe(300);
    expect(impl.processingTime).toBe(8);
    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBe('jpeg');
  });
});

describe('FileResultImpl no-option 경로', () => {
  it('toBlob() 옵션 없음 → 기존 File 인스턴스 그대로 반환(File은 Blob의 서브클래스)', async () => {
    const file = new File(['data'], 'img.png', { type: 'image/png' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const result = await impl.toBlob();

    // File은 Blob 서브클래스이므로 원본 file 참조여야 한다
    expect(result).toBe(file);
  });
});

// ─── CanvasResultImpl ─────────────────────────────────────────────────────

describe('CanvasResultImpl 속성 노출', () => {
  it('생성자 인자가 공개 속성으로 올바르게 노출된다', () => {
    const canvas = createTestCanvas(200, 150, 'green');
    const impl = new CanvasResultImpl(canvas, 200, 150, 15, { width: 400, height: 300 }, 'webp');

    expect(impl.canvas).toBe(canvas);
    expect(impl.width).toBe(200);
    expect(impl.height).toBe(150);
    expect(impl.processingTime).toBe(15);
    expect(impl.originalSize).toEqual({ width: 400, height: 300 });
    expect(impl.format).toBe('webp');
  });
});

// ─── ElementResultImpl ────────────────────────────────────────────────────

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

// ─── 추가: 변환 메서드 행동 검증 ─────────────────────────────────────────

/** img src 할당 시 즉시 load 이벤트를 발생시키는 제어 img 생성 헬퍼. */
function createControlledImg(outcome: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img') as HTMLImageElement;
  let assignedSrc = '';
  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      if (outcome === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });
  return img;
}

// ─── CanvasResultImpl 변환 행동 ───────────────────────────────────────────

describe('CanvasResultImpl.toBlob — MIME·quality 전달', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('format·quality 옵션을 지정하면 canvas.toBlob에 올바른 MIME 타입과 quality를 전달한다', async () => {
    const canvas = createTestCanvas(100, 100, 'red');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    const spy = vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['x'], { type: type! }));
    });

    await impl.toBlob({ format: 'jpeg', quality: 0.8 });

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
  });

  it('format 옵션이 없으면 canvas.toBlob에 image/png를 기본값으로 전달한다', async () => {
    const canvas = createTestCanvas(100, 100, 'blue');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    const spy = vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['x'], { type: type! }));
    });

    await impl.toBlob();

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/png', undefined);
  });

  it('canvas.toBlob 콜백이 null을 반환하면 CANVAS_TO_BLOB_FAILED 오류를 던진다', async () => {
    const canvas = createTestCanvas(100, 100, 'green');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    vi.spyOn(canvas, 'toBlob').mockImplementation((cb) => {
      cb(null);
    });

    await expect(impl.toBlob()).rejects.toMatchObject({ code: 'CANVAS_TO_BLOB_FAILED' });
  });
});

describe('CanvasResultImpl.toFile — 파일명 및 MIME 타입', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('지정한 파일명과 canvas.toBlob의 타입을 가진 File을 반환한다', async () => {
    const canvas = createTestCanvas(100, 100, 'red');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['x'], { type: type! }));
    });

    const file = await impl.toFile('result.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('result.png');
    expect(file.type).toBe('image/png');
  });

  it('format 옵션을 지정하면 File.type이 해당 MIME 타입이다', async () => {
    const canvas = createTestCanvas(100, 100, 'blue');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    vi.spyOn(canvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['x'], { type: type! }));
    });

    const file = await impl.toFile('photo.jpg', { format: 'jpeg', quality: 0.9 });

    expect(file.name).toBe('photo.jpg');
    expect(file.type).toBe('image/jpeg');
  });
});

// ─── BlobResultImpl — format 옵션 재인코딩 ───────────────────────────────

describe('BlobResultImpl.toBlob — format 옵션 지정 시 canvas 재인코딩', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('format 옵션을 지정하면 toCanvas 결과에서 올바른 MIME·quality로 canvas.toBlob을 호출한다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const canvasSpy = vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['re-encoded'], { type: type! }));
    });
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const result = await impl.toBlob({ format: 'jpeg', quality: 0.9 });

    expect(canvasSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9);
    expect(result).toBeInstanceOf(Blob);
  });

  it('format 없이 quality만 지정하면 원본 blob.type을 MIME 타입으로 canvas.toBlob을 호출한다', async () => {
    const blob = new Blob(['data'], { type: 'image/webp' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const canvasSpy = vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['re-encoded'], { type: type! }));
    });
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    // format 없이 quality만 전달하면 원본 blob.type을 사용한다
    await impl.toBlob({ quality: 0.7 });

    expect(canvasSpy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.7);
  });
});

// ─── FileResultImpl — format 옵션 재인코딩 ───────────────────────────────

describe('FileResultImpl.toBlob — format 옵션 지정 시 canvas 재인코딩', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('format 옵션을 지정하면 toCanvas 결과에서 올바른 MIME 타입으로 canvas.toBlob을 호출한다', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const canvasSpy = vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['re-encoded'], { type: type! }));
    });
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const result = await impl.toBlob({ format: 'webp' });

    expect(canvasSpy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', undefined);
    expect(result.type).toBe('image/webp');
  });

  it('format 없이 quality만 지정하면 원본 file.type을 MIME 타입으로 canvas.toBlob을 호출한다', async () => {
    const file = new File(['data'], 'photo.jpeg', { type: 'image/jpeg' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const canvasSpy = vi.spyOn(mockCanvas, 'toBlob').mockImplementation((cb, type) => {
      cb(new Blob(['re-encoded'], { type: type! }));
    });
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    await impl.toBlob({ quality: 0.7 });

    expect(canvasSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.7);
  });
});

// ─── BlobResultImpl.toElement — object URL 라이프사이클 ──────────────────

describe('BlobResultImpl.toElement — object URL 라이프사이클', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toElement() 성공 시 objectURL을 생성하고 이미지 load 후 revoke한다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-fake-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const controlledImg = createControlledImg('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return controlledImg as any;
      throw new Error(`예상치 못한 태그: ${tagName}`);
    });

    try {
      const element = await impl.toElement();

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
      expect(element).toBe(controlledImg);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-fake-url');
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('toElement() 실패 시에도 objectURL을 revoke한다(메모리 누수 없음)', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-fake-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const controlledImg = createControlledImg('error');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return controlledImg as any;
      throw new Error(`예상치 못한 태그: ${tagName}`);
    });

    try {
      await expect(impl.toElement()).rejects.toThrow();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-fake-url');
    } finally {
      createElementSpy.mockRestore();
    }
  });
});

// ─── DataURLResultImpl 변환 메서드 ───────────────────────────────────────

describe('DataURLResultImpl 변환 메서드 — canvas 경유 검증', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

// ─── ElementResultImpl.toCanvas ──────────────────────────────────────────

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

// ─── BlobResultImpl.toFile — format 옵션 재인코딩 분기 ───────────────────

describe('BlobResultImpl.toFile — format 옵션 재인코딩 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('format 옵션 지정 시 toBlob을 경유해 재인코딩하고 반환 File의 name·type이 올바르다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    // toBlob 경유를 검증하기 위해 spy로 교체한다
    const toBlobSpy = vi.spyOn(impl, 'toBlob').mockResolvedValue(new Blob(['re-encoded'], { type: 'image/jpeg' }));

    const file = await impl.toFile('output.jpg', { format: 'jpeg', quality: 0.9 });

    expect(toBlobSpy).toHaveBeenCalledWith({ format: 'jpeg', quality: 0.9 });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.jpg');
    // 재인코딩 후 blob.type이 File.type으로 전파되어야 한다
    expect(file.type).toBe('image/jpeg');
  });
});

// ─── FileResultImpl.toElement — object URL 라이프사이클 ──────────────────

describe('FileResultImpl.toElement — object URL 라이프사이클', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toElement() 성공 시 file을 인자로 objectURL을 생성하고 load 후 revoke한다', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-file-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const controlledImg = createControlledImg('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return controlledImg as any;
      throw new Error(`예상치 못한 태그: ${tagName}`);
    });

    try {
      const element = await impl.toElement();

      expect(createObjectURLSpy).toHaveBeenCalledWith(file);
      expect(element).toBe(controlledImg);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-file-url');
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('toElement() 실패 시에도 objectURL을 revoke한다(메모리 누수 없음)', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-file-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const controlledImg = createControlledImg('error');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return controlledImg as any;
      throw new Error(`예상치 못한 태그: ${tagName}`);
    });

    try {
      await expect(impl.toElement()).rejects.toThrow();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-file-url');
    } finally {
      createElementSpy.mockRestore();
    }
  });
});

// ─── BlobResultImpl.toDataURL — format/quality 분기 ──────────────────────

describe('BlobResultImpl.toDataURL — format/quality 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('옵션 없음 → canvas.toDataURL을 image/png, undefined로 호출한다', async () => {
    const blob = new Blob(['data'], { type: 'image/jpeg' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const toDataURLSpy = vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const result = await impl.toDataURL();

    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
    expect(typeof result).toBe('string');
  });

  it('{ format: "jpeg", quality: 0.9 } → canvas.toDataURL을 image/jpeg, 0.9로 호출한다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const toDataURLSpy = vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,mock');
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const result = await impl.toDataURL({ format: 'jpeg', quality: 0.9 });

    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.9);
    expect(typeof result).toBe('string');
  });
});

// ─── FileResultImpl.toDataURL — format/quality 분기 ──────────────────────

describe('FileResultImpl.toDataURL — format/quality 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('옵션 없음 → canvas.toDataURL을 image/png, undefined로 호출한다', async () => {
    const file = new File(['data'], 'photo.jpeg', { type: 'image/jpeg' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const toDataURLSpy = vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const result = await impl.toDataURL();

    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
    expect(typeof result).toBe('string');
  });

  it('{ format: "jpeg", quality: 0.9 } → canvas.toDataURL을 image/jpeg, 0.9로 호출한다', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const impl = new FileResultImpl(file, 100, 100, 0);

    const mockCanvas = document.createElement('canvas');
    const toDataURLSpy = vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,mock');
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(mockCanvas);

    const result = await impl.toDataURL({ format: 'jpeg', quality: 0.9 });

    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.9);
    expect(typeof result).toBe('string');
  });
});

// ─── ElementResultImpl 변환 메서드 ───────────────────────────────────────

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

// ─── CanvasResultImpl.toDataURL — MIME·quality 전달 ──────────────────────

describe('CanvasResultImpl.toDataURL — MIME·quality 전달', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('format·quality 옵션을 지정하면 canvas.toDataURL에 올바른 MIME 타입과 quality를 전달한다', async () => {
    const canvas = createTestCanvas(100, 100, 'red');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    const spy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,mock');

    const result = await impl.toDataURL({ format: 'jpeg', quality: 0.8 });

    expect(spy).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(result).toBe('data:image/jpeg;base64,mock');
  });

  it('format 옵션이 없으면 canvas.toDataURL에 image/png를 기본값으로 전달한다', async () => {
    const canvas = createTestCanvas(100, 100, 'blue');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);

    const spy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');

    await impl.toDataURL();

    expect(spy).toHaveBeenCalledWith('image/png', undefined);
  });
});

// ─── BlobResultImpl.toDataURL — toCanvas 실패 전파 ──────────────────────

describe('BlobResultImpl.toDataURL — toCanvas 실패 전파', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toCanvas가 실패하면 canvas.toDataURL을 호출하지 않고 오류를 그대로 전파한다', async () => {
    const blob = new Blob(['data'], { type: 'image/png' });
    const impl = new BlobResultImpl(blob, 100, 100, 0);

    // 이미지 로드 실패 등으로 toCanvas가 거부되는 상황을 모사한다.
    const loadError = new ImageProcessError('Image load failed', 'IMAGE_LOAD_FAILED');
    vi.spyOn(impl, 'toCanvas').mockRejectedValue(loadError);

    await expect(impl.toDataURL()).rejects.toBe(loadError);
  });
});

// ─── DataURLResultImpl.toFile — format 옵션 재인코딩 MIME 반영 ───────────

describe('DataURLResultImpl.toFile — format 옵션 재인코딩 MIME 반영', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
