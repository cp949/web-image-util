/**
 * 디코드 단일 소유 모듈의 계약 테스트다.
 *
 * 두 층을 나눠 검증한다. 모듈 정책(속성 설정 순서, objectURL 수명, 오류 조립,
 * 즉시 반환 분기)은 주입한 어댑터로 확인하고, 기본 브라우저 어댑터의 핸들러 해제
 * 규칙은 src setter를 가로챈 img로 직접 구동해 확인한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageProcessError } from '../../../src/types';
import {
  decodeExistingImage,
  decodeImageFromBlob,
  decodeImageFromUrl,
  type ImageDecodeAdapter,
  resetImageDecodeAdapter,
  setImageDecodeAdapter,
} from '../../../src/utils/image-decode.internal';

/** 어댑터가 관찰한 호출 인자를 기록하는 스텁을 만든다. */
function createRecordingAdapter(result: 'load' | 'error'): {
  adapter: ImageDecodeAdapter;
  calls: Array<{ img: HTMLImageElement; src?: string; crossOrigin: string | null; decoding: string }>;
} {
  const calls: Array<{ img: HTMLImageElement; src?: string; crossOrigin: string | null; decoding: string }> = [];

  const adapter: ImageDecodeAdapter = {
    decode: (img, src) => {
      // 속성이 src 할당 전에 설정됐는지 보려면 구동 시점 값을 그대로 남겨야 한다.
      calls.push({ img, src, crossOrigin: img.crossOrigin, decoding: img.decoding });
      if (src !== undefined) img.src = src;
      return result === 'load' ? Promise.resolve() : Promise.reject(new Error('스텁 디코드 실패'));
    },
  };

  return { adapter, calls };
}

/**
 * src setter를 가로채 자동 로드를 막은 img를 만든다.
 *
 * jsdom은 이미지를 실제로 로드하지 않으므로 테스트가 직접 이벤트를 발화시킨다.
 */
function createControlledImg(): { img: HTMLImageElement; triggerLoad: () => void; triggerError: () => void } {
  const createElement = document.createElement.bind(document);
  const img = createElement('img');
  let assignedSrc = '';

  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
    },
  });

  // img 생성만 가로채고 나머지 태그는 원본으로 위임한다.
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
    tagName === 'img' ? img : createElement(tagName)) as never);

  return {
    img,
    triggerLoad: () => img.onload?.(new Event('load')),
    triggerError: () => img.onerror?.(new Event('error')),
  };
}

afterEach(() => {
  resetImageDecodeAdapter();
  vi.restoreAllMocks();
});

describe('decodeImageFromUrl', () => {
  it('crossOrigin과 decoding을 src 할당 전에 설정한다', async () => {
    const { adapter, calls } = createRecordingAdapter('load');
    setImageDecodeAdapter(adapter);

    await decodeImageFromUrl('https://example.com/a.png', {
      errorCode: 'SOURCE_LOAD_FAILED',
      crossOrigin: 'anonymous',
      decoding: 'async',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.crossOrigin).toBe('anonymous');
    expect(calls[0]!.decoding).toBe('async');
    expect(calls[0]!.src).toBe('https://example.com/a.png');
  });

  it('디코드 실패를 주입된 errorCode와 message로 감싸고 원인을 보존한다', async () => {
    const { adapter } = createRecordingAdapter('error');
    setImageDecodeAdapter(adapter);

    await expect(
      decodeImageFromUrl('https://example.com/a.png', {
        errorCode: 'SOURCE_LOAD_FAILED',
        message: 'Failed to load image: https://example.com/a.png',
      })
    ).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: 'Failed to load image: https://example.com/a.png',
      cause: expect.any(Error),
    });
  });

  it('message를 생략하면 Image loading failed로 떨어진다', async () => {
    const { adapter } = createRecordingAdapter('error');
    setImageDecodeAdapter(adapter);

    await expect(decodeImageFromUrl('bad', { errorCode: 'IMAGE_LOAD_FAILED' })).rejects.toMatchObject({
      message: 'Image loading failed',
    });
  });
});

describe('기본 브라우저 어댑터', () => {
  it('로드 성공 시 onload와 onerror를 모두 해제한다', async () => {
    const { img, triggerLoad } = createControlledImg();

    const promise = decodeImageFromUrl('data:image/png;base64,iVBORw0KGgo=', { errorCode: 'IMAGE_LOAD_FAILED' });
    triggerLoad();

    await expect(promise).resolves.toBe(img);
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });

  it('로드 실패 시 핸들러를 해제하고 ImageProcessError로 거부한다', async () => {
    const { img, triggerError } = createControlledImg();

    const promise = decodeImageFromUrl('invalid', { errorCode: 'IMAGE_LOAD_FAILED' });
    triggerError();

    await expect(promise).rejects.toBeInstanceOf(ImageProcessError);
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });
});

describe('decodeImageFromBlob', () => {
  it('성공 경로에서 objectURL을 revoke한다', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decode-ok');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { adapter, calls } = createRecordingAdapter('load');
    setImageDecodeAdapter(adapter);

    await decodeImageFromBlob(new Blob(['x']), { errorCode: 'SOURCE_LOAD_FAILED' });

    expect(calls[0]!.src).toBe('blob:decode-ok');
    expect(revokeSpy).toHaveBeenCalledWith('blob:decode-ok');
  });

  it('실패 경로에서도 objectURL을 revoke한다', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decode-fail');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { adapter } = createRecordingAdapter('error');
    setImageDecodeAdapter(adapter);

    await expect(decodeImageFromBlob(new Blob(['x']), { errorCode: 'SOURCE_LOAD_FAILED' })).rejects.toBeInstanceOf(
      ImageProcessError
    );
    expect(revokeSpy).toHaveBeenCalledWith('blob:decode-fail');
  });

  it('createObjectURL 실패는 objectUrlErrorCode와 objectUrlMessage로 감싼다', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('createObjectURL unavailable');
    });
    setImageDecodeAdapter(createRecordingAdapter('load').adapter);

    await expect(
      decodeImageFromBlob(new Blob(['x']), {
        errorCode: 'IMAGE_LOAD_FAILED',
        message: 'Image loading failed',
        objectUrlErrorCode: 'OUTPUT_FAILED',
        objectUrlMessage: 'Error occurred during Element conversion',
      })
    ).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      message: 'Error occurred during Element conversion',
    });
  });

  it('objectUrlErrorCode를 생략하면 errorCode로 떨어진다', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('createObjectURL unavailable');
    });
    setImageDecodeAdapter(createRecordingAdapter('load').adapter);

    await expect(decodeImageFromBlob(new Blob(['x']), { errorCode: 'SOURCE_LOAD_FAILED' })).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });
});

describe('decodeExistingImage', () => {
  it('이미 로드된 element는 어댑터를 거치지 않고 즉시 반환한다', async () => {
    const { adapter, calls } = createRecordingAdapter('load');
    setImageDecodeAdapter(adapter);

    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { configurable: true, value: true });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 7 });

    await expect(decodeExistingImage(img, { errorCode: 'SOURCE_LOAD_FAILED' })).resolves.toBe(img);
    expect(calls).toHaveLength(0);
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });

  it('미로드 element는 src를 재할당하지 않고 완료만 기다린다', async () => {
    const { adapter, calls } = createRecordingAdapter('load');
    setImageDecodeAdapter(adapter);

    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { configurable: true, value: false });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 });

    await expect(decodeExistingImage(img, { errorCode: 'SOURCE_LOAD_FAILED' })).resolves.toBe(img);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.img).toBe(img);
    expect(calls[0]!.src).toBeUndefined();
  });
});

describe('어댑터 레지스트리', () => {
  it('resetImageDecodeAdapter는 기본 브라우저 어댑터로 되돌린다', async () => {
    setImageDecodeAdapter(createRecordingAdapter('error').adapter);
    resetImageDecodeAdapter();

    const { img, triggerLoad } = createControlledImg();
    const promise = decodeImageFromUrl('data:image/png;base64,iVBORw0KGgo=', { errorCode: 'IMAGE_LOAD_FAILED' });
    triggerLoad();

    await expect(promise).resolves.toBe(img);
  });
});
