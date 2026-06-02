/**
 * BlobResultImpl의 속성 노출, no-option 경로, 재인코딩, object URL 라이프사이클을 단정한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import { BlobResultImpl } from '../../../src/types/result-implementations';
import { createControlledImg } from './result-implementations.helpers';

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

    // toCanvas 거부 후 어떤 canvas의 toDataURL도 호출되지 않아야 한다(제목의 "호출하지 않고" 입증)
    const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

    await expect(impl.toDataURL()).rejects.toBe(loadError);
    expect(toDataURLSpy).not.toHaveBeenCalled();
  });
});
