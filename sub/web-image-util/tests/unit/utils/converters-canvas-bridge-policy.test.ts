/**
 * canvas-bridge / policy 변환 경계 단위 테스트.
 *
 * canvasToBlob fallback, imageElementToCanvas context 오류, shouldReencodeBlob,
 * getBlobReencodeOptions, shouldReuseFile 분기를 각각 잠근다.
 * getBlobDimensions는 이벤트 revoke 계약만 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import {
  canvasToBlob,
  canvasToDataURL,
  getBlobDimensions,
  imageElementToCanvas,
} from '../../../src/utils/converters/canvas-bridge';
import { getBlobReencodeOptions, shouldReencodeBlob, shouldReuseFile } from '../../../src/utils/converters/policy';

// ─────────────────────────────────────────────
// shouldReencodeBlob
// ─────────────────────────────────────────────

describe('shouldReencodeBlob — 재인코딩 필요 여부 판정', () => {
  it('quality가 명시되면 true를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(shouldReencodeBlob(blob, { quality: 0.8 })).toBe(true);
  });

  it('quality: 0도 명시 값이므로 true를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    expect(shouldReencodeBlob(blob, { quality: 0 })).toBe(true);
  });

  it('format이 없으면 false를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(shouldReencodeBlob(blob, {})).toBe(false);
  });

  it('format png이고 blob MIME도 image/png이면 첫 항 단락으로 false를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    // blob.type === `image/png` 이므로 첫 비교가 false → 단락평가 → false
    expect(shouldReencodeBlob(blob, { format: 'png' })).toBe(false);
  });

  it('format 별칭(jpg)의 MIME이 blob MIME(image/jpeg)과 동일하면 false를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    // 'jpg' → formatToMimeType('jpg') = 'image/jpeg' = blob.type 이므로 재인코딩 불필요
    expect(shouldReencodeBlob(blob, { format: 'jpg' })).toBe(false);
  });

  it('format 불일치이면 true를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(shouldReencodeBlob(blob, { format: 'jpeg' })).toBe(true);
  });
});

// ─────────────────────────────────────────────
// getBlobReencodeOptions
// ─────────────────────────────────────────────

describe('getBlobReencodeOptions — 재인코딩 옵션 보완', () => {
  it('format이 명시되어 있으면 원 options 객체를 그대로 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const options = { format: 'png' as const };
    expect(getBlobReencodeOptions(blob, options)).toBe(options);
  });

  it('format이 없고 blob MIME이 image/jpeg이면 format: jpeg를 채운 새 객체를 반환한다', () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const options = { quality: 0.9 };
    const result = getBlobReencodeOptions(blob, options);
    expect(result.format).toBe('jpeg');
    expect(result.quality).toBe(0.9);
    // 원 옵션 객체가 변형되지 않아야 한다
    expect('format' in options).toBe(false);
    // 새 객체가 반환되어야 한다
    expect(result).not.toBe(options);
  });

  it('format이 없고 blob MIME이 image/png이면 format: png를 채운다', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const result = getBlobReencodeOptions(blob, {});
    expect(result.format).toBe('png');
  });

  it('format이 없고 MIME이 알 수 없는 경우 원 options를 그대로 반환한다', () => {
    const blob = new Blob(['x'], { type: 'application/octet-stream' });
    const options = { quality: 0.7 };
    expect(getBlobReencodeOptions(blob, options)).toBe(options);
  });
});

// ─────────────────────────────────────────────
// shouldReuseFile
// ─────────────────────────────────────────────

describe('shouldReuseFile — File 원본 재사용 여부 판정', () => {
  it('파일명·확장자·재인코딩 모두 만족하면 true를 반환한다', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    // format 없음 → getFinalFilename = 'photo.png', shouldReencodeBlob = false
    expect(shouldReuseFile(file, 'photo.png', {})).toBe(true);
  });

  it('파일명 불일치이면 false를 반환한다', () => {
    const file = new File(['x'], 'other.png', { type: 'image/png' });
    expect(shouldReuseFile(file, 'photo.png', {})).toBe(false);
  });

  it('format 변환으로 최종 파일명이 달라지면 false를 반환한다', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    // format: 'jpeg' → getFinalFilename = 'photo.jpeg' ≠ 'photo.png'
    expect(shouldReuseFile(file, 'photo.png', { format: 'jpeg' })).toBe(false);
  });

  it('quality 명시로 재인코딩이 필요하면 false를 반환한다', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    expect(shouldReuseFile(file, 'photo.png', { quality: 0.8 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// canvasToBlob
// ─────────────────────────────────────────────

describe('canvasToBlob — toBlob fallback 경로', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('첫 toBlob 호출이 성공하면 해당 Blob을 반환하고 올바른 MIME·quality로 호출한다', async () => {
    const canvas = document.createElement('canvas');
    const expectedBlob = new Blob(['mock'], { type: 'image/png' });

    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, _type?: string, _quality?: number) => {
        callback(expectedBlob);
      }
    );

    const result = await canvasToBlob(canvas, { format: 'png' });

    expect(result).toBe(expectedBlob);
    // format 'png' → 'image/png', quality 미지정 → 0.8 기본값
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/png', 0.8);
  });

  it('사용자가 quality를 명시하면 그 값을 toBlob에 그대로 전달한다', async () => {
    const canvas = document.createElement('canvas');
    const expectedBlob = new Blob(['mock'], { type: 'image/jpeg' });

    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, _type?: string, _quality?: number) => {
        callback(expectedBlob);
      }
    );

    const result = await canvasToBlob(canvas, { format: 'jpeg', quality: 0.4 });

    expect(result).toBe(expectedBlob);
    // 명시한 quality 0.4가 기본값 0.8 대신 그대로 흘러야 한다
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.4);
  });

  it('옵션이 없으면 format png, quality 0.8 기본값으로 toBlob을 호출한다', async () => {
    const canvas = document.createElement('canvas');
    const defaultBlob = new Blob(['default'], { type: 'image/png' });

    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, _type?: string, _quality?: number) => {
        callback(defaultBlob);
      }
    );

    const result = await canvasToBlob(canvas, {});

    expect(result).toBe(defaultBlob);
    // 빈 옵션 → format 기본 'png', fallbackFormat 기본 'png', quality 기본 0.8
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/png', 0.8);
  });

  it('첫 toBlob이 null이면 fallbackFormat으로 재시도하고 Blob을 반환한다', async () => {
    const canvas = document.createElement('canvas');
    const fallbackBlob = new Blob(['fb'], { type: 'image/png' });
    let callCount = 0;

    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, _type?: string, _quality?: number) => {
        callCount++;
        callback(callCount === 1 ? null : fallbackBlob);
      }
    );

    const result = await canvasToBlob(canvas, { format: 'webp', fallbackFormat: 'png' });

    expect(result).toBe(fallbackBlob);
    // 첫 시도: webp, 재시도: fallback png
    expect(spy).toHaveBeenNthCalledWith(1, expect.any(Function), 'image/webp', 0.8);
    expect(spy).toHaveBeenNthCalledWith(2, expect.any(Function), 'image/png', 0.8);
  });

  it('첫 toBlob null이고 fallback도 null이면 에러 메시지와 함께 reject한다', async () => {
    const canvas = document.createElement('canvas');

    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(null);
    });

    await expect(canvasToBlob(canvas, { format: 'png' })).rejects.toThrow('Canvas to Blob conversion failed');
    // fallback 경로까지 실행됐는지 확인 (단순 첫 실패로 즉시 reject한 것이 아님)
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────
// canvasToDataURL
// ─────────────────────────────────────────────

describe('canvasToDataURL — 인자 전달 및 반환값 확인', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('format과 quality를 toDataURL에 그대로 전달하고 반환값을 그대로 돌려준다', () => {
    const canvas = document.createElement('canvas');
    const mockReturn = 'data:image/jpeg;base64,mockdata';
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(mockReturn);

    const result = canvasToDataURL(canvas, { format: 'jpeg', quality: 0.75 });

    expect(spy).toHaveBeenCalledWith('image/jpeg', 0.75);
    expect(result).toBe(mockReturn);
  });

  it('옵션이 없으면 image/png, quality 0.8 기본값으로 toDataURL을 호출하고 반환값을 돌려준다', () => {
    const canvas = document.createElement('canvas');
    const mockReturn = 'data:image/png;base64,defaultdata';
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(mockReturn);

    const result = canvasToDataURL(canvas, {});

    expect(spy).toHaveBeenCalledWith('image/png', 0.8);
    expect(result).toBe(mockReturn);
  });
});

// ─────────────────────────────────────────────
// imageElementToCanvas
// ─────────────────────────────────────────────

describe('imageElementToCanvas — 이미지 → Canvas 변환', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getContext가 null을 반환하면 CANVAS_CREATION_FAILED 코드로 reject한다', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const img = document.createElement('img') as HTMLImageElement;
    img.width = 100;
    img.height = 50;

    await expect(imageElementToCanvas(img)).rejects.toMatchObject({
      code: 'CANVAS_CREATION_FAILED',
    });
  });

  it('정상 경로에서 이미지 width·height를 canvas에 반영하고 drawImage(img, 0, 0)을 호출한다', async () => {
    // node-canvas는 drawImage에 전달된 HTMLImageElement를 자체 Image 타입으로 변환하므로
    // getContext를 mock해 drawImage spy를 직접 주입하면 원본 참조를 검증할 수 있다
    const drawImageSpy = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: drawImageSpy } as any);

    const img = document.createElement('img') as HTMLImageElement;
    img.width = 120;
    img.height = 80;

    const resultCanvas = await imageElementToCanvas(img);

    expect(resultCanvas.width).toBe(120);
    expect(resultCanvas.height).toBe(80);
    expect(resultCanvas).toBeInstanceOf(HTMLCanvasElement);
    // 이미지를 실제로 캔버스에 그렸는지, 올바른 좌표로 그렸는지 확인한다
    expect(drawImageSpy).toHaveBeenCalledWith(img, 0, 0);
  });

  it('반환된 에러는 ImageProcessError 인스턴스다', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const img = document.createElement('img') as HTMLImageElement;

    try {
      await imageElementToCanvas(img);
      expect.fail('에러가 발생해야 한다');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageProcessError);
    }
  });
});

// ─────────────────────────────────────────────
// getBlobDimensions — revoke 호출 계약
// ─────────────────────────────────────────────

describe('getBlobDimensions — URL revoke 계약', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('onload 이벤트 발생 시 createObjectURL URL을 revoke하고 치수를 반환한다', async () => {
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-load');

    let capturedImg: HTMLImageElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    const createElementMock = (tagName: string): HTMLElement => {
      const el = originalCreateElement(tagName);
      if (tagName === 'img') capturedImg = el as HTMLImageElement;
      return el;
    };
    vi.spyOn(document, 'createElement').mockImplementation(createElementMock as any);

    const blob = new Blob(['x'], { type: 'image/png' });
    const promise = getBlobDimensions(blob);

    expect(capturedImg).toBeDefined();
    // onload 핸들러가 읽을 치수를 미리 설정한다
    Object.defineProperty(capturedImg!, 'width', { value: 200, configurable: true });
    Object.defineProperty(capturedImg!, 'height', { value: 100, configurable: true });
    capturedImg!.dispatchEvent(new Event('load'));

    const dims = await promise;

    expect(dims).toEqual({ width: 200, height: 100 });
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-load');
  });

  it('onerror 이벤트 발생 시 URL을 revoke하고 reject한다', async () => {
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-error');

    let capturedImg: HTMLImageElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    const createElementMock = (tagName: string): HTMLElement => {
      const el = originalCreateElement(tagName);
      if (tagName === 'img') capturedImg = el as HTMLImageElement;
      return el;
    };
    vi.spyOn(document, 'createElement').mockImplementation(createElementMock as any);

    const blob = new Blob(['invalid'], { type: 'image/png' });
    const promise = getBlobDimensions(blob);

    expect(capturedImg).toBeDefined();
    capturedImg!.dispatchEvent(new Event('error'));

    await expect(promise).rejects.toThrow('Unable to read Blob size information');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-error');
  });
});
