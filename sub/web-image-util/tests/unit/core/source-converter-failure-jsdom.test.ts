/**
 * source-converter 분기 커버리지 보강 테스트.
 *
 * 대상 소스 파일의 미커버 분기를 결정적으로 실행한다.
 * - src/core/source-converter/index.ts (convertToImageElement / getImageDimensions)
 * - src/core/source-converter/svg/loader.ts (convertSvgToElement)
 * - src/core/source-converter/loaders/string.ts (convertStringToElement)
 *
 * 실제 이미지 디코딩은 document.createElement('img')의 src setter를 가로채
 * onload/onerror를 동기적으로 발화시켜 결정적으로 구동한다(jsdom에서 SVG 디코딩은
 * 실제로 발화하지 않으므로 직접 구동이 필요하다).
 * fetch / URL.createObjectURL / _SVG_MOCK_MODE 등 모든 전역은 afterEach에서 복원한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  vi.restoreAllMocks();
  // vi.doMock 팩토리 등록은 resetModules로 지워지지 않으므로 명시적으로 해제한다.
  vi.doUnmock('../../../src/core/source-converter/loaders/canvas');
  vi.doUnmock('../../../src/core/source-converter/loaders/blob');
  vi.doUnmock('../../../src/core/source-converter/loaders/string');
  vi.doUnmock('../../../src/core/source-converter/detect');
  vi.doUnmock('../../../src/utils/svg-compatibility/index');
  vi.doUnmock('../../../src/svg-sanitizer');
  vi.doUnmock('../../../src/core/svg-complexity-analyzer');
  vi.doUnmock('../../../src/utils/debug');
  vi.doUnmock('../../../src/utils/svg-dimensions');
  vi.resetModules();
  document.createElement = originalDocumentCreateElement;
  globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  delete (globalThis as any)._SVG_MOCK_MODE;
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
    vi.doMock('../../../src/core/source-converter/loaders/canvas', () => ({
      convertCanvasToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertCanvasToElement } = await import('../../../src/core/source-converter/loaders/canvas');

    const fakeCanvas = {
      getContext: () => null,
      toDataURL: () => PNG_DATA_URL,
    };

    await convertToImageElement(fakeCanvas as any);

    expect(vi.mocked(convertCanvasToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertCanvasToElement).mock.calls[0]![0]).toBe(fakeCanvas);
  });

  it('instanceof가 아니어도 type/size/slice를 가진 객체는 Blob 경로로 위임한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/blob', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertBlobToElement } = await import('../../../src/core/source-converter/loaders/blob');

    const fakeBlob = {
      type: 'image/png',
      size: 10,
      slice: () => fakeBlob,
    };

    await convertToImageElement(fakeBlob as any);

    expect(vi.mocked(convertBlobToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement).mock.calls[0]![0]).toBe(fakeBlob);
  });

  it('ArrayBuffer 입력은 MIME을 감지해 Blob 경로로 위임한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/blob', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertBlobToElement, detectMimeTypeFromBuffer } = await import(
      '../../../src/core/source-converter/loaders/blob'
    );

    const buffer = new ArrayBuffer(8);
    await convertToImageElement(buffer);

    expect(vi.mocked(detectMimeTypeFromBuffer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertBlobToElement).mock.calls[0]![0]).toBeInstanceOf(Blob);
  });

  it('Uint8Array 입력(ArrayBuffer 백킹)은 buffer.slice 경로로 Blob을 만든다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/blob', () => ({
      convertBlobToElement: vi.fn(() => Promise.resolve(document.createElement('img'))),
      detectMimeTypeFromBuffer: vi.fn(() => 'image/png'),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');
    const { convertBlobToElement } = await import('../../../src/core/source-converter/loaders/blob');

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
    vi.doMock('../../../src/core/source-converter/loaders/blob', () => ({
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
    vi.doMock('../../../src/core/source-converter/loaders/string', () => ({
      convertStringToElement: vi.fn(() => Promise.reject(original)),
    }));
    const { convertToImageElement } = await import('../../../src/core/source-converter/index');

    await expect(convertToImageElement('relative/path.png')).rejects.toBe(original);
  });
});

describe('getImageDimensions — index.ts 폴백 분기', () => {
  it('naturalWidth/Height가 0이면 width/height 속성으로 폴백한다', async () => {
    vi.doMock('../../../src/core/source-converter/loaders/string', () => {
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
    vi.doMock('../../../src/core/source-converter/loaders/string', () => {
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
  beforeEach(() => {
    // 성공 경로의 downstream SVG 디코딩이 멈추지 않도록 mock 모드를 켠다.
    (globalThis as any)._SVG_MOCK_MODE = true;
  });

  it('detectSourceType이 알 수 없는 타입을 반환하면 INVALID_SOURCE로 거부한다', async () => {
    // detect를 mock해 switch default(L184)를 결정적으로 실행한다.
    vi.doMock('../../../src/core/source-converter/detect', () => ({
      detectSourceType: vi.fn(() => 'arrayBuffer'),
    }));
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('whatever')).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('원격 SVG URL 응답이 ok가 아니면 SOURCE_LOAD_FAILED로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('nope', { status: 404 }))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('https://example.com/icon.svg')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });

  it('원격 SVG URL fetch가 AbortError로 실패하면 aborted로 표시된 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    globalThis.fetch = vi.fn(() => Promise.reject(abortErr)) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('https://example.com/icon.svg')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      details: { kind: 'aborted' },
    });
  });

  it('원격 SVG URL fetch가 일반 오류로 실패하면 검증 불가 INVALID_SOURCE로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('network down'))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('https://example.com/icon.svg')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('원격 SVG URL이 검증된 본문을 반환하면 SVG 로더로 위임한다(성공 경로)', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(MINIMAL_SVG, { status: 200, headers: { 'content-type': 'image/svg+xml' } }))
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    // mock 모드로 인해 1x1 PNG img가 반환된다(디코딩 우회).
    const result = await convertStringToElement('https://example.com/icon.svg');
    expect(result).toBeInstanceOf(HTMLImageElement);
  });

  it('상대 SVG 경로 응답이 ok가 아니면 SOURCE_LOAD_FAILED로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('./assets/icon.svg')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
    });
  });

  it('상대 SVG 경로 fetch가 AbortError로 실패하면 aborted SOURCE_LOAD_FAILED로 거부한다', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    globalThis.fetch = vi.fn(() => Promise.reject(abortErr)) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('./assets/icon.svg')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      details: { kind: 'aborted' },
    });
  });

  it('상대 SVG 경로 fetch가 일반 오류로 실패하면 검증 불가 INVALID_SOURCE로 차단한다', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('fs error'))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('/assets/icon.svg')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('차단된 프로토콜을 가진 SVG 경로(javascript:..svg)는 프로토콜 차단 오류를 전파한다', async () => {
    // checkAllowedProtocol catch(L120-127)에서 isProtocolBlocked가 true면 재throw한다.
    // detect는 javascript: 스킴을 url로 보지 않고 isSvgResourcePath가 true면 'svg'로 분류한다.
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('should not fetch'))) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    await expect(convertStringToElement('javascript:alert(1)//x.svg')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('상대 SVG 경로가 검증된 본문을 반환하면 SVG 로더로 위임한다(성공 경로)', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(MINIMAL_SVG, { status: 200, headers: { 'content-type': 'image/svg+xml' } }))
    ) as any;
    const { convertStringToElement } = await import('../../../src/core/source-converter/loaders/string');

    const result = await convertStringToElement('./assets/icon.svg');
    expect(result).toBeInstanceOf(HTMLImageElement);
  });
});

describe('convertSvgToElement — svg/loader.ts 분기', () => {
  it('sanitizerMode 미지정 + unsafe-pass-through는 skip으로 해석되고 호환성 보정을 건너뛴다', async () => {
    const enhanceSpy = vi.fn((s: string) => s);
    vi.doMock('../../../src/utils/svg-compatibility/index', () => ({
      enhanceSvgForBrowser: enhanceSpy,
    }));
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
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
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
    const img = stubImgCreation('load');

    const result = await convertSvgToElement(MINIMAL_SVG, undefined, undefined, { sanitizerMode: 'strict' });

    expect(result).toBe(img);
    expect(strictSpy).toHaveBeenCalledTimes(1);
    expect(strictSpy.mock.calls[0]![0]).toBe(MINIMAL_SVG);
  });

  it("알 수 없는 sanitizerMode는 'Unsupported SVG sanitizer mode' INVALID_SOURCE로 거부한다", async () => {
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');

    await expect(
      convertSvgToElement(MINIMAL_SVG, undefined, undefined, { sanitizerMode: 'bogus' as any })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('명시 quality(high)는 복잡도 분석을 건너뛴다', async () => {
    const analyzeSpy = vi.fn(() => ({ recommendedQuality: 'low' }));
    vi.doMock('../../../src/core/svg-complexity-analyzer', () => ({
      analyzeSvgComplexity: analyzeSpy,
    }));
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
    stubImgCreation('load');

    await convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' });

    // 명시 quality 경로(L133-134)는 analyzeSvgComplexity를 호출하지 않는다.
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it('작은 SVG는 Base64 경로로 로드하고 onload 후 핸들러를 해제한다', async () => {
    const createObjSpy = vi.spyOn(URL, 'createObjectURL');
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
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
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
    const img = stubImgCreation('load');

    // 50KB를 초과하도록 큰 주석을 채운 SVG를 만든다(skip 모드로 size limit 통과).
    const filler = '<!--' + 'x'.repeat(60 * 1024) + '-->';
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
    vi.doMock('../../../src/utils/debug', () => ({
      debugLog: { log: vi.fn() },
      productionLog: { warn: warnSpy },
    }));
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('createObjectURL unavailable');
    });
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
    const img = stubImgCreation('load');

    const filler = '<!--' + 'x'.repeat(60 * 1024) + '-->';
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

  it('이미지 로드 실패(onerror)는 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');
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
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');

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
    const { convertSvgToElement } = await import('../../../src/core/source-converter/svg/loader');

    await expect(convertSvgToElement(MINIMAL_SVG, undefined, undefined, { quality: 'high' })).rejects.toBe(ipe);
  });
});
