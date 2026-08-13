/**
 * url/loader.internal.ts 전용 테스트다.
 *
 * 이 모듈은 지금까지 상위 경로(convertToImageElement)를 통해서만 간접 검증됐다.
 * 디코드가 어댑터 뒤로 빠지면서 직접 진입점이 생겼으므로, fetch 분기와 디코드 위임을
 * 여기서 고정한다. 어댑터는 디코드 호출 인자를 기록만 하고 즉시 결정된다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadBlobUrl, loadImageFromUrl } from '../../../src/core/source-converter/url/loader.internal';
import {
  type ImageDecodeAdapter,
  resetImageDecodeAdapter,
  setImageDecodeAdapter,
} from '../../../src/utils/image-decode.internal';

/** 디코드 시점의 img 상태와 src를 기록하는 어댑터를 설치한다. */
function installRecordingAdapter(result: 'load' | 'error'): Array<{ src?: string; crossOrigin: string | null }> {
  const calls: Array<{ src?: string; crossOrigin: string | null }> = [];

  const adapter: ImageDecodeAdapter = {
    decode: (img, src) => {
      calls.push({ src, crossOrigin: img.crossOrigin });
      if (src !== undefined) img.src = src;
      return result === 'load' ? Promise.resolve() : Promise.reject(new Error('스텁 디코드 실패'));
    },
  };

  setImageDecodeAdapter(adapter);
  return calls;
}

/** 지정한 content-type과 본문을 갖는 성공 응답을 만든다. */
function okResponse(body: string, contentType: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url-loader-test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  resetImageDecodeAdapter();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('loadBlobUrl', () => {
  it('비-SVG Blob URL 응답을 objectURL로 디코드하고 URL을 revoke한다', async () => {
    const calls = installRecordingAdapter('load');
    globalThis.fetch = vi.fn(() => Promise.resolve(okResponse('binary', 'image/png'))) as never;

    await expect(loadBlobUrl('blob:http://localhost/abc')).resolves.toBeInstanceOf(HTMLImageElement);
    expect(calls[0]!.src).toBe('blob:url-loader-test');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-loader-test');
  });

  it('응답이 ok가 아니면 SOURCE_LOAD_FAILED로 거부한다', async () => {
    installRecordingAdapter('load');
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('nope', { status: 404 }))) as never;

    await expect(loadBlobUrl('blob:http://localhost/abc')).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
  });

  it('디코드가 실패하면 입력 URL을 담은 SOURCE_LOAD_FAILED로 거부한다', async () => {
    const calls = installRecordingAdapter('error');
    globalThis.fetch = vi.fn(() => Promise.resolve(okResponse('binary', 'image/png'))) as never;

    await expect(loadBlobUrl('blob:http://localhost/abc')).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: 'Failed to load Blob URL image: blob:http://localhost/abc',
    });
    // 오류 문자열은 어댑터를 거치지 않아도 같으므로, 디코드 위임 자체를 별도로 고정한다.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.src).toBe('blob:url-loader-test');
  });
});

describe('loadImageFromUrl', () => {
  it("transport 'direct'는 fetch 없이 URL을 그대로 디코드한다", async () => {
    const calls = installRecordingAdapter('load');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;

    await expect(loadImageFromUrl('/assets/photo.png', undefined, undefined, 'direct')).resolves.toBeInstanceOf(
      HTMLImageElement
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls[0]!.src).toBe('/assets/photo.png');
  });

  it('crossOrigin은 디코드 구동 전에 이미 설정돼 있다', async () => {
    const calls = installRecordingAdapter('load');
    globalThis.fetch = vi.fn() as never;

    await loadImageFromUrl('/assets/photo.png', 'anonymous', undefined, 'direct');

    expect(calls[0]!.crossOrigin).toBe('anonymous');
  });

  it("transport 'remote'의 비-SVG 응답은 본문 Blob을 objectURL로 디코드한다", async () => {
    const calls = installRecordingAdapter('load');
    globalThis.fetch = vi.fn(() => Promise.resolve(okResponse('binary', 'image/png'))) as never;

    await expect(
      loadImageFromUrl('https://example.com/photo.png', undefined, undefined, 'remote')
    ).resolves.toBeInstanceOf(HTMLImageElement);
    expect(calls[0]!.src).toBe('blob:url-loader-test');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-loader-test');
  });

  it('원격 본문 디코드가 실패하면 직접 로드로 폴백하지 않고 그대로 거부한다', async () => {
    const calls = installRecordingAdapter('error');
    globalThis.fetch = vi.fn(() => Promise.resolve(okResponse('binary', 'image/png'))) as never;

    await expect(
      loadImageFromUrl('https://example.com/photo.png', undefined, undefined, 'remote')
    ).rejects.toMatchObject({
      code: 'SOURCE_LOAD_FAILED',
      message: 'Failed to load image: https://example.com/photo.png',
    });
    // 폴백이 일어났다면 어댑터가 원본 URL로 한 번 더 불린다. 호출 기록이 그것을 가른다 —
    // 폴백 경로의 오류 코드·메시지는 이 경로와 동일해서 단정만으로는 구별되지 않는다.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.src).toBe('blob:url-loader-test');
  });

  it('fetch 자체가 실패하면 브라우저 기본 이미지 로딩으로 폴백한다', async () => {
    const calls = installRecordingAdapter('load');
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('network down'))) as never;

    await expect(
      loadImageFromUrl('https://example.com/photo.png', undefined, undefined, 'remote')
    ).resolves.toBeInstanceOf(HTMLImageElement);
    // 폴백 경로는 원본 URL을 그대로 디코드한다.
    expect(calls[0]!.src).toBe('https://example.com/photo.png');
  });
});
