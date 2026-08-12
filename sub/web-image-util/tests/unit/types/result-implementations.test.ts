/**
 * 결과 구현 5종이 각자 소유하는 부분만 검증한다.
 *
 * 파생 변환(toDataURL/toBlob/toFile/toArrayBuffer/toUint8Array)의 계약은
 * ResultBase가 소유하므로 result-base.test.ts에서 한 번만 단정한다.
 * 여기서 다루는 것은 소스별 로딩 경로, 재인코딩 없는 fast-path, 기본 MIME 차이다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BlobResultImpl,
  CanvasResultImpl,
  DataURLResultImpl,
  ElementResultImpl,
  FileResultImpl,
} from '../../../src/types/result-implementations.internal';
import { createTestCanvas } from '../../utils/canvas-helper';
import { createControlledImg, createRecordingCanvas, stubCreateElement } from './result-implementations.helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 상속 스모크 — 5구현이 각 인터페이스 표면을 실제로 갖췄는지 확인한다
// ---------------------------------------------------------------------------

/** 공통 메타데이터 인자 — 5구현이 같은 생성자 꼬리를 쓴다. */
const META = [320, 240, 12, { width: 640, height: 480 }, 'png'] as const;

/**
 * 각 구현의 payload 속성명과, 해당 인터페이스가 선언한 변환 메서드 목록이다.
 * 자기 자신에 해당하는 변환(예: ResultBlob의 toBlob)은 인터페이스에 없다.
 */
const IMPLEMENTATIONS = [
  {
    name: 'DataURLResultImpl',
    payloadKey: 'dataURL',
    methods: ['toCanvas', 'toBlob', 'toFile', 'toElement', 'toArrayBuffer', 'toUint8Array'],
    build: () => {
      const payload = 'data:image/png;base64,abc';
      return { impl: new DataURLResultImpl(payload, ...META), payload };
    },
  },
  {
    name: 'BlobResultImpl',
    payloadKey: 'blob',
    methods: ['toCanvas', 'toDataURL', 'toFile', 'toElement', 'toArrayBuffer', 'toUint8Array'],
    build: () => {
      const payload = new Blob(['mock'], { type: 'image/jpeg' });
      return { impl: new BlobResultImpl(payload, ...META), payload };
    },
  },
  {
    name: 'FileResultImpl',
    payloadKey: 'file',
    methods: ['toCanvas', 'toDataURL', 'toBlob', 'toElement', 'toArrayBuffer', 'toUint8Array'],
    build: () => {
      const payload = new File(['mock'], 'photo.jpg', { type: 'image/jpeg' });
      return { impl: new FileResultImpl(payload, ...META), payload };
    },
  },
  {
    name: 'CanvasResultImpl',
    payloadKey: 'canvas',
    methods: ['toBlob', 'toDataURL', 'toFile', 'toElement', 'toArrayBuffer', 'toUint8Array'],
    build: () => {
      const payload = createTestCanvas(320, 240, 'green');
      return { impl: new CanvasResultImpl(payload, ...META), payload };
    },
  },
  {
    name: 'ElementResultImpl',
    payloadKey: 'element',
    methods: ['toBlob', 'toDataURL', 'toFile', 'toCanvas', 'toArrayBuffer', 'toUint8Array'],
    build: () => {
      const payload = document.createElement('img');
      return { impl: new ElementResultImpl(payload, ...META), payload };
    },
  },
] as const;

describe.each(IMPLEMENTATIONS)('$name — 표면과 메타데이터', (entry) => {
  it('인터페이스가 선언한 변환 메서드를 모두 갖는다', () => {
    const { impl } = entry.build();
    const methods = impl as unknown as Record<string, unknown>;

    for (const method of entry.methods) {
      expect(typeof methods[method], `${entry.name}.${method}`).toBe('function');
    }
  });

  it('payload와 메타데이터가 공개 속성으로 노출된다', () => {
    const { impl, payload } = entry.build();

    expect((impl as unknown as Record<string, unknown>)[entry.payloadKey]).toBe(payload);
    expect(impl.width).toBe(320);
    expect(impl.height).toBe(240);
    expect(impl.processingTime).toBe(12);
    expect(impl.originalSize).toEqual({ width: 640, height: 480 });
    expect(impl.format).toBe('png');
  });
});

describe('결과 구현 — 선택 인자 생략', () => {
  it('originalSize·format을 생략하면 undefined다', () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 100, 100, 5);

    expect(impl.originalSize).toBeUndefined();
    expect(impl.format).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DataURLResultImpl — data URL을 직접 로드한다(object URL 불필요)
// ---------------------------------------------------------------------------

describe('DataURLResultImpl — 소스 로딩', () => {
  it('toCanvas()는 dataURL을 img.src로 로드해 결과 크기의 canvas에 그린다', async () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 200, 150, 0);
    const img = createControlledImg('load');
    const { canvas, drawImage } = createRecordingCanvas();
    stubCreateElement({ img, canvas });

    const result = await impl.toCanvas();

    expect(img.src).toBe('data:image/png;base64,abc');
    expect(result).toBe(canvas);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(drawImage).toHaveBeenCalledWith(img, 0, 0);
  });

  it('toElement()는 object URL을 만들지 않고 dataURL을 그대로 로드한다', async () => {
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 100, 100, 0);
    const img = createControlledImg('load');
    stubCreateElement({ img });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    const element = await impl.toElement();

    expect(element).toBe(img);
    expect(img.src).toBe('data:image/png;base64,abc');
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('파생 변환은 toCanvas()가 만든 canvas를 재인코딩 소스로 쓴다', async () => {
    // renderCanvas()는 protected라 직접 부르지 않는다 —
    // toCanvas()를 mock으로 바꾼 뒤 파생 변환이 그 canvas에 도달하는지로 배선을 확인한다
    const impl = new DataURLResultImpl('data:image/png;base64,abc', 100, 100, 0);
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, mime) => {
      callback(new Blob(['re-encoded'], { type: mime ?? '' }));
    });
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    const toCanvasSpy = vi.spyOn(impl, 'toCanvas').mockResolvedValue(canvas);

    await impl.toBlob({ format: 'jpeg', quality: 0.8 });
    await impl.toDataURL();

    expect(toCanvasSpy).toHaveBeenCalledTimes(2);
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
  });
});

// ---------------------------------------------------------------------------
// BlobResultImpl / FileResultImpl — object URL 경유, 무옵션 fast-path
// ---------------------------------------------------------------------------

const BLOB_BACKED = [
  {
    name: 'BlobResultImpl',
    build: (type: string) => {
      const payload = new Blob(['data'], { type });
      return { impl: new BlobResultImpl(payload, 100, 100, 0), payload };
    },
  },
  {
    name: 'FileResultImpl',
    build: (type: string) => {
      const payload = new File(['data'], 'photo.img', { type });
      return { impl: new FileResultImpl(payload, 100, 100, 0), payload };
    },
  },
] as const;

describe.each(BLOB_BACKED)('$name — 무옵션 fast-path', (entry) => {
  /**
   * 재인코딩 경로를 mock canvas로 열어 두고 그 입구(toCanvas)를 관측한다.
   *
   * jsdom은 blob URL 이미지를 로드하지 못하므로, 경로를 열어 두지 않으면
   * fast-path 회귀가 단정이 아니라 IMAGE_LOAD_FAILED로 죽어 원인이 드러나지 않는다.
   * `HTMLCanvasElement.prototype.toBlob`을 관측하면 이 환경에서는 영영 도달하지 못한다.
   */
  function openRenderPath(impl: { toCanvas(): Promise<HTMLCanvasElement> }) {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback, mime) => {
      callback(new Blob(['re-encoded'], { type: mime ?? '' }));
    });
    return vi.spyOn(impl, 'toCanvas').mockResolvedValue(canvas);
  }

  it('toBlob() 옵션 없음 → 보유 중인 인스턴스를 그대로 반환한다(재인코딩 없음)', async () => {
    const { impl, payload } = entry.build('image/png');
    const toCanvasSpy = openRenderPath(impl);

    // 동일 참조여야 한다 — canvas 경유 재인코딩이 일어나면 다른 인스턴스다
    await expect(impl.toBlob()).resolves.toBe(payload);
    expect(toCanvasSpy).not.toHaveBeenCalled();
  });

  it('toFile() 옵션 없음 → canvas를 거치지 않고 보유 바이트를 File로 래핑한다', async () => {
    const { impl } = entry.build('image/png');
    const toCanvasSpy = openRenderPath(impl);

    const file = await impl.toFile('output.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.png');
    // type은 원본 payload.type을 그대로 쓴다
    expect(file.type).toBe('image/png');
    expect(toCanvasSpy).not.toHaveBeenCalled();
  });

  it('toArrayBuffer()·toUint8Array()도 canvas를 거치지 않고 보유 바이트를 읽는다', async () => {
    const { impl, payload } = entry.build('image/png');
    const expected = new Uint8Array(await payload.arrayBuffer());
    const toCanvasSpy = openRenderPath(impl);

    const buffer = await impl.toArrayBuffer();
    const bytes = await impl.toUint8Array();

    // 무옵션 toBlob() fast-path를 경유하므로 재인코딩 바이트가 아니라 원본 바이트다
    expect(new Uint8Array(buffer)).toEqual(expected);
    expect(bytes).toEqual(expected);
    expect(toCanvasSpy).not.toHaveBeenCalled();
  });
});

describe.each(BLOB_BACKED)('$name — 기본 MIME', (entry) => {
  /** toCanvas를 mock canvas로 교체해 실제 디코딩을 우회한다. */
  function withMockCanvas(type: string) {
    const { impl, payload } = entry.build(type);
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, mime) => {
      callback(new Blob(['re-encoded'], { type: mime ?? '' }));
    });
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    vi.spyOn(impl, 'toCanvas').mockResolvedValue(canvas);
    return { impl, payload, toBlobSpy, toDataURLSpy };
  }

  it('toBlob({ quality })는 format이 없으면 원본 payload.type으로 재인코딩한다', async () => {
    const { impl, toBlobSpy } = withMockCanvas('image/webp');

    await impl.toBlob({ quality: 0.7 });

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.7);
  });

  it('toBlob({ format })은 지정한 format이 원본 타입을 이긴다', async () => {
    const { impl, toBlobSpy } = withMockCanvas('image/png');

    const result = await impl.toBlob({ format: 'webp' });

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', undefined);
    expect(result.type).toBe('image/webp');
  });

  it('toDataURL()은 원본 payload.type이 아니라 image/png를 기본값으로 쓴다', async () => {
    // toBlob과 다른 기본값이다. 의도된 비대칭이며 ResultBase가 훅 두 개로 분리해 유지한다.
    const { impl, toDataURLSpy } = withMockCanvas('image/jpeg');

    await impl.toDataURL();

    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
  });
});

describe.each(BLOB_BACKED)('$name — object URL 라이프사이클', (entry) => {
  it('toElement() 성공 시 payload로 object URL을 만들고 load 후 revoke한다', async () => {
    const { impl, payload } = entry.build('image/png');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    const img = createControlledImg('load');
    stubCreateElement({ img });

    const element = await impl.toElement();

    expect(createObjectURLSpy).toHaveBeenCalledWith(payload);
    expect(element).toBe(img);
    expect(img.src).toBe('blob:test-url');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('toElement() 실패 시에도 object URL을 revoke한다(메모리 누수 없음)', async () => {
    const { impl } = entry.build('image/png');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    stubCreateElement({ img: createControlledImg('error') });

    await expect(impl.toElement()).rejects.toThrow();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('toCanvas()는 object URL이 살아 있는 동안 그리고 나서 revoke한다', async () => {
    const { impl, payload } = entry.build('image/png');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    const img = createControlledImg('load');
    const { canvas, drawImage } = createRecordingCanvas();
    stubCreateElement({ img, canvas });

    // drawImage 시점에는 아직 revoke 전이어야 한다
    drawImage.mockImplementation(() => {
      expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    });

    const result = await impl.toCanvas();

    expect(URL.createObjectURL).toHaveBeenCalledWith(payload);
    expect(result).toBe(canvas);
    expect(drawImage).toHaveBeenCalledWith(img, 0, 0);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('toCanvas() 실패 시에도 object URL을 revoke한다', async () => {
    const { impl } = entry.build('image/png');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    stubCreateElement({ img: createControlledImg('error') });

    await expect(impl.toCanvas()).rejects.toThrow();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });
});

// ---------------------------------------------------------------------------
// CanvasResultImpl — 보유 canvas를 복사 없이 인코딩 소스로 쓴다
// ---------------------------------------------------------------------------

describe('CanvasResultImpl — 보유 canvas 재사용', () => {
  it('toBlob()은 보유 canvas를 복사 없이 그대로 인코딩한다', async () => {
    const canvas = createTestCanvas(100, 100, 'red');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob(['x'], { type: type ?? '' }));
    });

    await impl.toBlob({ format: 'jpeg', quality: 0.8 });

    // 보유 canvas 자신이 호출돼야 한다 — 새 canvas로 복사하면 이 spy가 안 잡힌다
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
  });

  it('toDataURL()은 보유 canvas를 복사 없이 그대로 인코딩한다', async () => {
    const canvas = createTestCanvas(100, 100, 'blue');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');

    const result = await impl.toDataURL();

    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
    expect(result).toBe('data:image/png;base64,mock');
  });

  it('toElement()는 toDataURL을 경유해 이미지를 로드한다', async () => {
    const canvas = createTestCanvas(100, 100, 'green');
    const impl = new CanvasResultImpl(canvas, 100, 100, 5);
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    const img = createControlledImg('load');
    stubCreateElement({ img });

    const element = await impl.toElement();

    expect(element).toBe(img);
    expect(img.src).toBe('data:image/png;base64,mock');
  });
});

// ---------------------------------------------------------------------------
// ElementResultImpl — 보유 element를 바로 그린다(로딩 불필요)
// ---------------------------------------------------------------------------

describe('ElementResultImpl — 보유 element 재사용', () => {
  it('toCanvas()는 결과 크기의 canvas에 보유 element를 원점 정렬로 그린다', async () => {
    const element = document.createElement('img');
    const impl = new ElementResultImpl(element, 200, 150, 0);
    const { canvas, drawImage } = createRecordingCanvas();
    stubCreateElement({ canvas });

    const result = await impl.toCanvas();

    expect(result).toBe(canvas);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(drawImage).toHaveBeenCalledWith(element, 0, 0);
  });

  it('toCanvas()에서 2D context를 얻지 못하면 CANVAS_CREATION_FAILED로 던진다', async () => {
    const element = document.createElement('img');
    const impl = new ElementResultImpl(element, 100, 100, 0);
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    stubCreateElement({ canvas });

    await expect(impl.toCanvas()).rejects.toMatchObject({ code: 'CANVAS_CREATION_FAILED' });
  });

  it('파생 변환은 toCanvas()가 만든 canvas를 재인코딩 소스로 쓴다', async () => {
    // renderCanvas()는 protected라 직접 부르지 않는다 —
    // toCanvas()를 mock으로 바꾼 뒤 파생 변환이 그 canvas에 도달하는지로 배선을 확인한다
    const impl = new ElementResultImpl(document.createElement('img'), 100, 100, 0);
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, mime) => {
      callback(new Blob(['re-encoded'], { type: mime ?? '' }));
    });
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    const toCanvasSpy = vi.spyOn(impl, 'toCanvas').mockResolvedValue(canvas);

    await impl.toBlob({ format: 'jpeg', quality: 0.8 });
    await impl.toDataURL();

    expect(toCanvasSpy).toHaveBeenCalledTimes(2);
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
  });
});
