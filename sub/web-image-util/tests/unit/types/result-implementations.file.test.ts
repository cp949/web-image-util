/**
 * FileResultImpl의 속성 노출, no-option 경로, 재인코딩, object URL 라이프사이클을 단정한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileResultImpl } from '../../../src/types/result-implementations.internal';
import { createControlledImg } from './result-implementations.helpers';

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
