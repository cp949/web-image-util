/**
 * ResultBase가 소유하는 파생 변환 5메서드의 계약을 검증한다.
 *
 * 5개 결과 구현이 이 계약을 각자 반복하지 않으므로, 여기서 한 번만 단정한다.
 * 구현별 고유 동작은 result-implementations.test.ts가 담당한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import { ResultBase } from '../../../src/types/result-base.internal';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * renderCanvas() 결과를 주입할 수 있는 테스트 전용 구현이다.
 *
 * MIME 기본값 훅은 생성자로 덮어써 오버라이드 반영 여부를 확인한다.
 */
class StubResult extends ResultBase {
  constructor(
    private readonly source: HTMLCanvasElement | Promise<never>,
    private readonly blobMime = 'image/png',
    private readonly dataURLMime = 'image/png'
  ) {
    super(100, 80, 0);
  }

  protected override defaultBlobMimeType(): string {
    return this.blobMime;
  }

  protected override defaultDataURLMimeType(): string {
    return this.dataURLMime;
  }

  protected async renderCanvas(): Promise<HTMLCanvasElement> {
    return this.source as HTMLCanvasElement;
  }
}

/** toBlob/toDataURL을 가로챈 mock canvas와 spy를 만든다. */
function createMockCanvas(payload = 'payload') {
  const canvas = document.createElement('canvas');
  const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
    callback(new Blob([payload], { type: type ?? '' }));
  });
  const toDataURLSpy = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mock');

  return { canvas, toBlobSpy, toDataURLSpy };
}

describe('ResultBase.toBlob', () => {
  it('format·quality 옵션을 canvas.toBlob에 전달한다', async () => {
    const { canvas, toBlobSpy } = createMockCanvas();

    const blob = await new StubResult(canvas).toBlob({ format: 'jpeg', quality: 0.9 });

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9);
    expect(blob.type).toBe('image/jpeg');
  });

  it('format이 없으면 defaultBlobMimeType()을 MIME으로 쓴다', async () => {
    const { canvas, toBlobSpy } = createMockCanvas();

    await new StubResult(canvas, 'image/webp').toBlob({ quality: 0.7 });

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.7);
  });

  it('canvas.toBlob 콜백이 null이면 CANVAS_TO_BLOB_FAILED로 거절한다', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
      callback(null);
    });

    await expect(new StubResult(canvas).toBlob()).rejects.toMatchObject({ code: 'CANVAS_TO_BLOB_FAILED' });
  });
});

describe('ResultBase.toDataURL', () => {
  it('format·quality 옵션을 canvas.toDataURL에 전달한다', async () => {
    const { canvas, toDataURLSpy } = createMockCanvas();

    const dataURL = await new StubResult(canvas).toDataURL({ format: 'jpeg', quality: 0.9 });

    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.9);
    expect(dataURL).toBe('data:image/png;base64,mock');
  });

  it('format이 없으면 defaultDataURLMimeType()을 MIME으로 쓴다', async () => {
    const { canvas, toDataURLSpy } = createMockCanvas();

    // blob 기본값과 dataURL 기본값이 서로 다를 수 있으므로 dataURL 쪽만 골라 쓴다
    await new StubResult(canvas, 'image/webp', 'image/png').toDataURL();

    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
  });
});

describe('ResultBase.toFile', () => {
  it('toBlob을 경유해 파일명과 blob.type을 가진 File을 만든다', async () => {
    const { canvas } = createMockCanvas();
    const result = new StubResult(canvas);

    const file = await result.toFile('output.jpg', { format: 'jpeg', quality: 0.9 });

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('output.jpg');
    expect(file.type).toBe('image/jpeg');
  });

  it('옵션을 toBlob에 그대로 위임한다', async () => {
    // File.type만 보면 quality 누락을 못 잡는다 — 위임 인자를 직접 단정한다
    const { canvas } = createMockCanvas();
    const result = new StubResult(canvas);
    const toBlobSpy = vi.spyOn(result, 'toBlob');

    await result.toFile('output.jpg', { format: 'jpeg', quality: 0.9 });

    expect(toBlobSpy).toHaveBeenCalledWith({ format: 'jpeg', quality: 0.9 });
  });

  it('옵션 없이 호출하면 defaultBlobMimeType()이 File.type이 된다', async () => {
    const { canvas } = createMockCanvas();

    const file = await new StubResult(canvas, 'image/webp').toFile('output.webp');

    expect(file.type).toBe('image/webp');
  });
});

describe('ResultBase.toArrayBuffer · toUint8Array', () => {
  it('toArrayBuffer는 toBlob 결과의 바이트를 그대로 담는다', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob([new Uint8Array([1, 2, 3])], { type: type ?? '' }));
    });

    const buffer = await new StubResult(canvas).toArrayBuffer();

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3]);
  });

  it('toUint8Array는 toBlob 결과의 바이트를 Uint8Array로 반환한다', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob([new Uint8Array([4, 5, 6])], { type: type ?? '' }));
    });

    const bytes = await new StubResult(canvas).toUint8Array();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([4, 5, 6]);
  });
});

describe('ResultBase — renderCanvas 실패 전파', () => {
  it('renderCanvas가 거절하면 canvas 인코딩을 시도하지 않고 오류를 그대로 전파한다', async () => {
    const loadError = new ImageProcessError('Image load failed', 'IMAGE_LOAD_FAILED');
    const result = new StubResult(Promise.reject(loadError) as Promise<never>);

    const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
    const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

    await expect(result.toDataURL()).rejects.toBe(loadError);
    await expect(result.toBlob()).rejects.toBe(loadError);
    await expect(result.toFile('x.png')).rejects.toBe(loadError);
    await expect(result.toArrayBuffer()).rejects.toBe(loadError);
    await expect(result.toUint8Array()).rejects.toBe(loadError);

    expect(toDataURLSpy).not.toHaveBeenCalled();
    expect(toBlobSpy).not.toHaveBeenCalled();
  });
});

describe('ResultBase — 기본 MIME 훅', () => {
  it('오버라이드하지 않으면 toBlob·toDataURL 모두 image/png를 쓴다', async () => {
    const { canvas, toBlobSpy, toDataURLSpy } = createMockCanvas();

    class BareResult extends ResultBase {
      protected async renderCanvas(): Promise<HTMLCanvasElement> {
        return canvas;
      }
    }

    const result = new BareResult(10, 10, 0);
    await result.toBlob();
    await result.toDataURL();

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/png', undefined);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png', undefined);
  });
});

describe('ResultBase — 메타데이터 노출', () => {
  it('생성자 인자가 공개 속성으로 노출된다', () => {
    class MetaResult extends ResultBase {
      protected async renderCanvas(): Promise<HTMLCanvasElement> {
        return document.createElement('canvas');
      }
    }

    const result = new MetaResult(800, 600, 20, { width: 1600, height: 1200 }, 'jpeg');

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.processingTime).toBe(20);
    expect(result.originalSize).toEqual({ width: 1600, height: 1200 });
    expect(result.format).toBe('jpeg');
  });

  it('선택 인자를 생략하면 undefined다', () => {
    class MetaResult extends ResultBase {
      protected async renderCanvas(): Promise<HTMLCanvasElement> {
        return document.createElement('canvas');
      }
    }

    const result = new MetaResult(100, 100, 1);

    expect(result.originalSize).toBeUndefined();
    expect(result.format).toBeUndefined();
  });
});
