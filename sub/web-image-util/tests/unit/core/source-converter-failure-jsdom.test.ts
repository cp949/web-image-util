/**
 * source-converter 분기 커버리지 보강 테스트.
 *
 * 대상 소스 파일의 미커버 분기를 결정적으로 실행한다.
 * - src/core/source-converter/index.ts (convertToImageElement / getImageDimensions)
 * - src/core/source-converter/svg/loader.internal.ts (convertSvgToElement)
 * - src/core/source-converter/loaders/string.internal.ts (convertStringToElement)
 *
 * 실제 이미지 디코딩은 document.createElement('img')의 src setter를 가로채
 * onload/onerror를 동기적으로 발화시켜 결정적으로 구동한다(jsdom도 canvas가 있으면
 * 실제로 디코딩하지만, 성공·실패 시점이 환경에 좌우되므로 직접 구동해 결정성을 확보한다).
 * SVG 경로처럼 jsdom이 이벤트를 발화하지 않는 디코드는 디코드 어댑터를 주입해 우회한다.
 * fetch / URL.createObjectURL 등 모든 전역과 어댑터는 afterEach에서 복원한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageProcessError } from '../../../src/types';

/** 스니핑 판정에 충분한 최소 인라인 SVG 문자열 */
const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="1" height="1"/></svg>';

/** 1x1 투명 PNG data URL */
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const originalDocumentCreateElement = document.createElement;
const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

/**
 * src setter를 가로채 onload/onerror를 동기적으로 발화시키는 가짜 img를 만든다.
 *
 * @param result 'load'면 onload, 'error'면 onerror를 발화한다.
 * @returns 동작이 제어되는 HTMLImageElement
 */
function createControlledImage(result: 'load' | 'error'): HTMLImageElement {
  const img = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
  let assignedSrc = '';

  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      // src 할당은 동기 실행 중이므로, 핸들러가 이미 등록될 때까지 microtask로 미룬다.
      queueMicrotask(() => {
        if (result === 'load') {
          img.onload?.(new Event('load'));
        } else {
          img.onerror?.(new Event('error'));
        }
      });
    },
  });

  return img;
}

/**
 * document.createElement('img') 호출만 controlled image로 대체한다.
 * 그 외 태그는 원본 구현으로 위임한다.
 */
function stubImgCreation(result: 'load' | 'error'): HTMLImageElement {
  const img = createControlledImage(result);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'img') {
      return img;
    }
    return originalDocumentCreateElement.call(document, tagName);
  });
  return img;
}

/**
 * 현재 모듈 그래프에 디코드 어댑터를 주입한다.
 *
 * afterEach의 `vi.resetModules()` 때문에 어댑터 레지스트리는 테스트마다 새 인스턴스다.
 * 정적 import로는 테스트가 실제로 구동하는 인스턴스에 닿지 않으므로 동적 import를 쓴다.
 *
 * @param result 'load'면 즉시 성공, 'error'면 즉시 실패로 결정한다.
 */
async function stubDecodeAdapter(result: 'load' | 'error'): Promise<void> {
  const { setImageDecodeAdapter } = await import('../../../src/utils/image-decode.internal');
  setImageDecodeAdapter({
    decode: (img, src) => {
      if (src !== undefined) img.src = src;
      return result === 'load' ? Promise.resolve() : Promise.reject(new Error('스텁 디코드 실패'));
    },
  });
}

afterEach(async () => {
  // resetModules 전에 되돌려야 실제로 주입된 인스턴스가 복원된다.
  const { resetImageDecodeAdapter } = await import('../../../src/utils/image-decode.internal');
  resetImageDecodeAdapter();

  vi.restoreAllMocks();
  // vi.doMock 팩토리 등록은 resetModules로 지워지지 않으므로 명시적으로 해제한다.
  vi.doUnmock('../../../src/core/source-converter/loaders/canvas.internal');
  vi.doUnmock('../../../src/core/source-converter/loaders/blob.internal');
  vi.doUnmock('../../../src/core/source-converter/loaders/string.internal');
  vi.doUnmock('../../../src/core/source-converter/detect.internal');
  vi.doUnmock('../../../src/utils/svg-compatibility/index');
  vi.doUnmock('../../../src/svg-sanitizer');
  vi.doUnmock('../../../src/core/svg-complexity-analyzer');
  vi.doUnmock('../../../src/utils/debug.internal');
  vi.doUnmock('../../../src/utils/svg-dimensions');
  vi.resetModules();
  document.createElement = originalDocumentCreateElement;
  globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('convertToImageElement — index.ts 분기', () => {
  it('아직 로드되지 않은 HTMLImageElement는 Promise로 onload를 기다린 뒤 반환한다', async () => {
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    // complete=false, naturalWidth=0인 미로드 img를 만든다.
    const img = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
    Object.defineProperty(img, 'complete', { configurable: true, value: false });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 });

    const promise = convertToImageElement(img);
    // 핸들러 등록 후 onload를 발화한다.
    queueMicrotask(() => img.onload?.(new Event('load')));

    await expect(promise).resolves.toBe(img);
  });

  it('미로드 HTMLImageElement가 onerror로 실패하면 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    const img = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
    Object.defineProperty(img, 'complete', { configurable: true, value: false });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 });

    const promise = convertToImageElement(img);
    queueMicrotask(() => img.onerror?.(new Event('error')));

    await expect(promise).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
  });

  it('이미 로드된 HTMLImageElement는 즉시 그대로 반환한다', async () => {
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    const img = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
    Object.defineProperty(img, 'complete', { configurable: true, value: true });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 5 });

    await expect(convertToImageElement(img)).resolves.toBe(img);
  });

  it('instanceof가 아니어도 getContext/toDataURL을 가진 객체는 Canvas 경로로 위임한다', async () => {
    // canvas 로더를 mock해 라우팅만 검증한다.
    vi.doMock('../../../src/core/source-converter/loaders/canvas.internal', () => ({
      convertCanvasToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertCanvasToElement } = await import('../../../src/core/source-converter/loaders/canvas.internal');

    const fakeCanvas = {
      getContext: () => null,
      toDataURL: () => PNG_DATA_URL,
    };

    await convertToImageElement(fakeCanvas as any);

    expect(vi.mocked(convertCanvasToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertCanvasToElement).mock.calls[0]![0]).toBe(fakeCanvas);
  });

  it('instanceof가 아니어도 type/size/slice를 가진 객체는 Blob 경로로 위임한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/blob.internal', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertBlobToElement } = await import('../../../src/core/source-converter/loaders/blob.internal');

    const fakeBlob = {
      type: 'image/png',
      size: 10,
      slice: () => fakeBlob,
    };

    await convertToImageElement(fakeBlob as any);

    expect(vi.mocked(convertBlobToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement).mock.calls[0]![0]).toBe(fakeBlob);
  });

  it('Blob은 비동기 판정 결과를 Blob 로더에 그대로 전달한다', async () => {
    const detectedType = 'svg-blob';
    const detectSourceTypeAsync = vi.fn(() => Promise.resolve(detectedType));
    const image = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
    const convertBlobToElement = vi.fn(() => Promise.resolve(image));

    vi.doMock('../../../src/core/source-converter/detect.internal', () => ({ detectSourceTypeAsync }));
    vi.doMock('../../../src/core/source-converter/loaders/blob.internal', () => ({
      convertBlobToElement,
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const blob = new Blob([MINIMAL_SVG], { type: '' });

    await expect(convertToImageElement(blob)).resolves.toBe(image);
    expect(detectSourceTypeAsync).toHaveBeenCalledWith(blob, 100 * 1024 * 1024);
    expect(convertBlobToElement).toHaveBeenCalledWith(blob, detectedType, undefined);
  });

  it('ArrayBuffer 입력은 MIME을 감지해 Blob 경로로 위임한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/blob.internal', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertBlobToElement, detectMimeTypeFromBuffer } = await import(
      '../../../src/core/source-converter/loaders/blob.internal'
    );

    const buffer = new ArrayBuffer(8);
    await convertToImageElement(buffer);

    expect(vi.mocked(detectMimeTypeFromBuffer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement).mock.calls[0]![0]).toBeInstanceOf(Blob);
  });

  it('Uint8Array 입력(ArrayBuffer 백킹)은 buffer.slice 경로로 Blob을 만든다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/blob.internal', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertBlobToElement } = await import('../../../src/core/source-converter/loaders/blob.internal');

    // 일반 Uint8Array는 buffer가 ArrayBuffer이므로 L93(slice) 경로를 탄다.
    const u8 = new Uint8Array([1, 2, 3, 4]);
    expect(u8.buffer instanceof ArrayBuffer).toBe(true);

    await convertToImageElement(u8);

    expect(vi.mocked(convertBlobToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement).mock.calls[0]![0]).toBeInstanceOf(Blob);
  });

  it('지원하지 않는 타입(number)은 INVALID_SOURCE로 거부한다', async () => {
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    await expect(convertToImageElement(123 as never)).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('try 내부에서 동기 예외가 발생하면 SOURCE_LOAD_FAILED로 감싸고 cause를 보존한다', async () => {
    // detectMimeTypeFromBuffer는 ArrayBuffer 경로에서 try 내부 동기로 호출된다.
    // 문자열/Blob 로더는 `return loader(...)` 형태라 rejection이 try/catch를 우회하므로(await 없음)
    // catch(L105-113)의 비-ImageProcessError 래핑은 이런 동기 throw로만 도달한다.
    const cause = new Error('mime sniff boom');
    vi.doMock('../../../src/core/source-converter/loaders/blob.internal', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => {
        throw cause;
      }),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    await expect(convertToImageElement(new ArrayBuffer(8))).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      cause,
    });
  });

  it('문자열 로더가 던진 ImageProcessError는 promise adoption으로 동일 오류가 전파된다', async () => {
    // `return convertStringToElement(...)`는 await가 없어 rejection이 try/catch를 거치지 않고
    // 호출자에게 그대로 전파된다. 동일 인스턴스 보존을 확인한다.
    const original = new ImageProcessError('inner ipe', 'INVALID_SOURCE');
    vi.doMock('../../../src/core/source-converter/loaders/string.internal', () => ({
      convertStringToElement: vi.fn(() => Promise.reject(original)),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    await expect(convertToImageElement('relative/path.png')).rejects.toBe(original);
  });

  it('비동기 문자열 판정 결과를 문자열 로더에 그대로 전달한다', async () => {
    const detectedType = 'svg-path';
    const detectSourceTypeAsync = vi.fn(() => Promise.resolve(detectedType));
    const image = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
    const convertStringToElement = vi.fn(() => Promise.resolve(image));

    vi.doMock('../../../src/core/source-converter/detect.internal', () => ({ detectSourceTypeAsync }));
    vi.doMock('../../../src/core/source-converter/loaders/string.internal', () => ({ convertStringToElement }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    await expect(convertToImageElement('./assets/icon.svg')).resolves.toBe(image);
    expect(detectSourceTypeAsync).toHaveBeenCalledOnce();
    expect(convertStringToElement).toHaveBeenCalledWith('./assets/icon.svg', detectedType, undefined);
  });
});

describe('getImageDimensions — index.ts 폴백 분기', () => {
  it('naturalWidth/Height가 0이면 width/height 속성으로 폴백한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/string.internal', () => {
      const el = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
      Object.defineProperty(el, 'naturalWidth', { configurable: true, value: 0 });
      Object.defineProperty(el, 'naturalHeight', { configurable: true, value: 0 });
      Object.defineProperty(el, 'width', { configurable: true, value: 40 });
      Object.defineProperty(el, 'height', { configurable: true, value: 30 });
      return {
        convertStringToElement: vi.fn(() => Promise.resolve(el)),
      };
    });
    const { getImageDimensions } = await import('../../../src/core/source-converter/index');

    await expect(getImageDimensions('relative/path.png')).resolves.toEqual({ width: 40, height: 30 });
  });

  it('naturalWidth/Height가 양수면 그 값을 사용한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/string.internal', () => {
      const el = originalDocumentCreateElement.call(document, 'img') as HTMLImageElement;
      Object.defineProperty(el, 'naturalWidth', { configurable: true, value: 12 });
      Object.defineProperty(el, 'naturalHeight', { configurable: true, value: 8 });
      Object.defineProperty(el, 'width', { configurable: true, value: 99 });
      Object.defineProperty(el, 'height', { configurable: true, value: 99 });
      return {
        convertStringToElement: vi.fn(() => Promise.resolve(el)),
      };
    });
    const { getImageDimensions } = await import('../../../src/core/source-converter/index');

    await expect(getImageDimensions('relative/path.png')).resolves.toEqual({ width: 12, height: 8 });
  });
});

describe('convertStringToElement — string.ts fetch 분기', () => {
  it('문자열 판정 union에 없는 타입은 INVALID_SOURCE로 거부한다', async () => {
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('whatever', 'arrayBuffer' as never)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('대문자 HTTP(S) 비-SVG URL도 원격 응답 크기 가드를 적용한다', async () => {
    stubImgCreation('load');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response('12345', {
          status: 200,
          headers: { 'content-type': 'image/png', 'content-length': '5' },
        })
      )
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(
      convertStringToElement('HTTPS://example.com/photo.png', 'url', { maxSourceBytes: 4 })
    ).rejects.toMatchObject({ code: 'SOURCE_BYTES_EXCEEDED' });
  });

  it.each([
    'application/octet-stream',
    'text/plain',
  ])('Blob URL의 %s SVG 응답은 공통 스니핑 후 SVG 경로로 처리한다', async (contentType) => {
    await stubDecodeAdapter('load');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(MINIMAL_SVG, { status: 200, headers: { 'content-type': contentType } }))
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('blob:http://localhost/svg', 'bloburl')).resolves.toBeInstanceOf(
      HTMLImageElement
    );
  });

  it.each([
    'application/rss+xml',
    'text/xml-external-parsed-entity',
    'application/xml-external-parsed-entity',
  ])('원격 %s SVG 응답은 공통 XML MIME 판정 후 SVG 경로로 처리한다', async (contentType) => {
    await stubDecodeAdapter('load');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(MINIMAL_SVG, { status: 200, headers: { 'content-type': contentType } }))
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('https://example.com/image', 'url')).resolves.toBeInstanceOf(HTMLImageElement);
  });

  it('원격 SVG URL 응답이 ok가 아니면 SOURCE_LOAD_FAILED로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('nope', { status: 404 }))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('https://example.com/icon.svg', 'svg-url')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });

  it('원격 SVG URL fetch가 AbortError로 실패하면 aborted로 표시된 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    globalThis.fetch = vi.fn(() => Promise.reject(abortErr)) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('https://example.com/icon.svg', 'svg-url')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      details: { kind: 'aborted' },
    });
  });

  it('원격 SVG URL fetch가 일반 오류로 실패하면 검증 불가 INVALID_SOURCE로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('network down'))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('https://example.com/icon.svg', 'svg-url')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('원격 SVG URL이 검증된 본문을 반환하면 SVG 로더로 위임한다(성공 경로)', async () => {
    await stubDecodeAdapter('load');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(MINIMAL_SVG, { status: 200, headers: { 'content-type': 'image/svg+xml' } }))
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    // 주입한 어댑터가 즉시 성공으로 결정해 실제 디코딩 없이 img가 반환된다.
    const result = await convertStringToElement('https://example.com/icon.svg', 'svg-url');
    expect(result).toBeInstanceOf(HTMLImageElement);
  });

  it('상대 SVG 경로 응답이 ok가 아니면 SOURCE_LOAD_FAILED로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('./assets/icon.svg', 'svg-path')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });

  it('상대 SVG 경로 fetch가 AbortError로 실패하면 aborted SOURCE_LOAD_FAILED로 거부한다', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    globalThis.fetch = vi.fn(() => Promise.reject(abortErr)) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('./assets/icon.svg', 'svg-path')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      details: { kind: 'aborted' },
    });
  });

  it('상대 SVG 경로 fetch가 일반 오류로 실패하면 검증 불가 INVALID_SOURCE로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('fs error'))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('/assets/icon.svg', 'svg-path')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('차단된 프로토콜을 가진 SVG 경로(javascript:..svg)는 프로토콜 차단 오류를 전파한다', async () => {
    // checkAllowedProtocol에서 프로토콜 차단으로 판정한 INVALID_SOURCE는 그대로 전파한다.
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('should not fetch'))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    await expect(convertStringToElement('javascript:alert(1)//x.svg', 'svg-path')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('상대 SVG 경로가 검증된 본문을 반환하면 SVG 로더로 위임한다(성공 경로)', async () => {
    await stubDecodeAdapter('load');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(MINIMAL_SVG, { status: 200, headers: { 'content-type': 'image/svg+xml' } }))
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string.internal');

    const result = await convertStringToElement('./assets/icon.svg', 'svg-path');
    expect(result).toBeInstanceOf(HTMLImageElement);
  });
});

describe('convertSvgToElement — svg/loader.ts 분기', () => {
  it('sanitizerMode 미지정 + unsafe-pass-through는 skip으로 해석되고 호환성 보정을 건너뛴다', async () => {
    const enhanceSpy = vi.fn((s: string) => s);
    vi.doMock('../../../src/utils/svg-compatibility/index', () => ({
      enhanceSvgForBrowser: enhanceSpy,
    }));
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    const img = stubImgCreation('load');

    const result = await convertSvgToElement(MINIMAL_SVG, undefined, undefined, {
      passthroughMode: 'unsafe-pass-through',
    });

    expect(result).toBe(img);
    // unsafe-pass-through는 enhanceSvgForBrowser를 호출하지 않는다(L118-119).
    expect(enhanceSpy).not.toHaveBeenCalled();
  });

  it("sanitizerMode 'strict'는 동적 import한 strict sanitizer를 실행한다", async () => {
    const strictSpy = vi.fn((s: string) => s);
    vi.doMock('../../../src/svg-sanitizer', () => ({
      sanitizeSvgStrict: strictSpy,
    }));
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    const img = stubImgCreation('load');

    const result = await convertSvgToElement(MINIMAL_SVG, undefined, undefined, { sanitizerMode: 'strict' });

    expect(result).toBe(img);
    expect(strictSpy).toHaveBeenCalledTimes(1);
    expect(strictSpy.mock.calls[0]![0]).toBe(MINIMAL_SVG);
  });

  it("알 수 없는 sanitizerMode는 'Unsupported SVG sanitizer mode' INVALID_SOURCE로 거부한다", async () => {
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');

    await expect(
      convertSvgToElement(MINIMAL_SVG, undefined, undefined, { sanitizerMode: 'bogus' as any })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('명시 quality(high)는 복잡도 분석을 건너뛴다', async () => {
    const analyzeSpy = vi.fn(() => ({ recommendedQuality: 'low' }));
    vi.doMock('../../../src/core/svg-complexity-analyzer', () => ({
      analyzeSvgComplexity: analyzeSpy,
    }));
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    stubImgCreation('load');

    await convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' });

    // 명시 quality 경로(L133-134)는 analyzeSvgComplexity를 호출하지 않는다.
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it('작은 SVG는 Base64 경로로 로드하고 onload 후 핸들러를 해제한다', async () => {
    const createObjSpy = vi.spyOn(URL, 'createObjectURL');
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    const img = stubImgCreation('load');

    const result = await convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' });

    expect(result).toBe(img);
    // 50KB 미만이므로 Base64 경로 — createObjectURL을 쓰지 않는다.
    expect(createObjSpy).not.toHaveBeenCalled();
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });

  it('큰 SVG(>50KB)는 Blob URL 경로로 로드하고 onload 후 objectURL을 revoke한다', async () => {
    const createObjSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-large');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    const img = stubImgCreation('load');

    // 50KB를 초과하도록 큰 주석을 채운 SVG를 만든다(skip 모드로 size limit 통과).
    const filler = `<!--${'x'.repeat(60 * 1024)}-->`;
    const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${filler}<rect width="1" height="1"/></svg>`;

    const result = await convertSvgToElement(largeSvg, undefined, undefined, {
      quality: 'high',
      passthroughMode: 'unsafe-pass-through',
    });

    expect(result).toBe(img);
    expect(createObjSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:svg-large');
  });

  it('Blob URL 생성이 실패하면 Base64로 폴백하고 경고를 남긴다', async () => {
    const warnSpy = vi.fn();
    vi.doMock('../../../src/utils/debug.internal', () => ({
      debugLog: { log: vi.fn() },
      productionLog: { warn: warnSpy },
    }));
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('createObjectURL unavailable');
    });
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    const img = stubImgCreation('load');

    const filler = `<!--${'x'.repeat(60 * 1024)}-->`;
    const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${filler}<rect width="1" height="1"/></svg>`;

    const result = await convertSvgToElement(largeSvg, undefined, undefined, {
      quality: 'high',
      passthroughMode: 'unsafe-pass-through',
    });

    expect(result).toBe(img);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // 폴백된 src는 base64 data URL이어야 한다.
    expect(img.src.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('큰 SVG의 디코드가 실패하면 Base64로 폴백하지 않고 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const warnSpy = vi.fn();
    vi.doMock('../../../src/utils/debug.internal', () => ({
      debugLog: { log: vi.fn() },
      productionLog: { warn: warnSpy },
    }));
    // objectURL 준비는 성공시키고 디코드만 실패시켜 두 실패를 가르는 분기를 겨눈다.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-large');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    stubImgCreation('error');

    const filler = `<!--${'x'.repeat(60 * 1024)}-->`;
    const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${filler}<rect width="1" height="1"/></svg>`;

    await expect(
      convertSvgToElement(largeSvg, undefined, undefined, {
        quality: 'high',
        passthroughMode: 'unsafe-pass-through',
      })
    ).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });

    // 폴백이 일어났다면 경고가 남는다. 디코드 실패는 폴백 대상이 아니다.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('이미지 로드 실패(onerror)는 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');
    stubImgCreation('error');

    await expect(convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' })).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });

  it('try 내부에서 일반 Error가 발생하면 SOURCE_LOAD_FAILED로 감싼다', async () => {
    // extractSvgDimensions가 일반 Error를 던지게 해 catch(L214-220) 래핑 경로를 실행한다.
    vi.doMock('../../../src/utils/svg-dimensions', () => ({
      extractSvgDimensions: vi.fn(() => {
        throw new Error('dimension parse boom');
      }),
    }));
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');

    await expect(convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' })).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });

  it('try 내부에서 ImageProcessError가 발생하면 동일 오류를 그대로 전파한다', async () => {
    // resetModules 이후 동적 import한 loader는 새 모듈 그래프의 ImageProcessError를 본다.
    // instanceof 분기(L213-215)를 정확히 타려면 같은 그래프의 클래스로 오류를 만들어야 한다.
    let ipe: Error;
    vi.doMock('../../../src/utils/svg-dimensions', () => ({
      extractSvgDimensions: vi.fn(() => {
        throw ipe;
      }),
    }));
    const { ImageProcessError: FreshImageProcessError } = await import('../../../src/types');
    ipe = new FreshImageProcessError('inner svg ipe', 'INVALID_SOURCE');
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader.internal');

    await expect(convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' })).rejects.toBe(ipe);
  });
});
