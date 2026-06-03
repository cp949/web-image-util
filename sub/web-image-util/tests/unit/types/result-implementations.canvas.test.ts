/**
 * CanvasResultImpl의 속성 노출과 MIME/quality 전달 경로를 단정한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasResultImpl } from '../../../src/types/result-implementations.internal';
import { createTestCanvas } from '../../utils/canvas-helper';

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

    const result = await impl.toDataURL();

    expect(spy).toHaveBeenCalledWith('image/png', undefined);
    expect(result).toBe('data:image/png;base64,mock');
  });
});
