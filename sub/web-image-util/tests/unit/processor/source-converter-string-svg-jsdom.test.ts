/**
 * 문자열/SVG source-converter 라우팅 행동 보강 테스트.
 *
 * convertStringToElement가 입력 분류(data URL / 인라인 SVG / 원격 URL)에 따라
 * 올바른 loader로 분기하고 SVG 로딩 오류를 보존하는 호출 계약을 검증한다.
 * 실제 이미지 디코딩과 네트워크 fetch는 loader mock으로 차단한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// svg/loader와 url/loader를 mock해 convertStringToElement의 분기 위임을 spy한다.
// vi.mock은 import 문보다 앞으로 자동 hoisting된다.
vi.mock('../../../src/core/source-converter/svg/loader', () => ({
  convertSvgToElement: vi.fn(),
}));
vi.mock('../../../src/core/source-converter/url/loader', () => ({
  loadImageFromUrl: vi.fn(),
  loadBlobUrl: vi.fn(),
}));

import { convertStringToElement } from '../../../src/core/source-converter/loaders/string';
import { convertSvgToElement } from '../../../src/core/source-converter/svg/loader';
import { loadBlobUrl, loadImageFromUrl } from '../../../src/core/source-converter/url/loader';
import { ImageProcessError } from '../../../src/types';

/** 스니핑 판정에 충분한 최소 인라인 SVG 문자열 */
const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

/** XML preamble과 선행 공백이 섞인 SVG 문자열 */
const SVG_WITH_PREAMBLE = '   <?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2"/></svg>';

/** 1x1 투명 PNG data URL */
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('convertStringToElement — 문자열 입력 분류 및 loader 위임', () => {
  beforeEach(() => {
    // loader mock은 즉시 HTMLImageElement를 반환해 실제 디코딩/네트워크를 차단한다.
    vi.mocked(convertSvgToElement).mockImplementation(() => Promise.resolve(document.createElement('img')));
    vi.mocked(loadImageFromUrl).mockImplementation(() => Promise.resolve(document.createElement('img')));
    vi.mocked(loadBlobUrl).mockImplementation(() => Promise.resolve(document.createElement('img')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(convertSvgToElement).mockReset();
    vi.mocked(loadImageFromUrl).mockReset();
    vi.mocked(loadBlobUrl).mockReset();
  });

  it('이미지 data URL은 URL loader로 위임되고 createObjectURL이나 SVG loader를 쓰지 않는다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    await convertStringToElement(PNG_DATA_URL);

    expect(vi.mocked(loadImageFromUrl)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadImageFromUrl).mock.calls[0]![0]).toBe(PNG_DATA_URL);
    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('인라인 SVG 문자열은 SVG loader로 위임되고 원문/옵션이 전달된다', async () => {
    await convertStringToElement(MINIMAL_SVG, { crossOrigin: 'anonymous' });

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(convertSvgToElement).mock.calls[0]!;
    // 첫 번째 인자에 SVG 원문이 그대로 전달된다.
    expect(call[0]).toBe(MINIMAL_SVG);
    // 네 번째 인자(렌더링 옵션)에 quality 'auto'와 crossOrigin이 반영된다.
    expect(call[3]).toEqual(expect.objectContaining({ quality: 'auto', crossOrigin: 'anonymous' }));
    expect(vi.mocked(loadImageFromUrl)).not.toHaveBeenCalled();
  });

  it('XML preamble과 공백이 섞인 SVG는 URL로 오판되지 않고 SVG loader로 위임된다', async () => {
    await convertStringToElement(SVG_WITH_PREAMBLE);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    // 원문(preamble 포함)이 그대로 SVG loader에 전달된다.
    expect(vi.mocked(convertSvgToElement).mock.calls[0]![0]).toBe(SVG_WITH_PREAMBLE);
    expect(vi.mocked(loadImageFromUrl)).not.toHaveBeenCalled();
    expect(vi.mocked(loadBlobUrl)).not.toHaveBeenCalled();
  });

  it('비-SVG 원격 URL은 URL loader로 분기하며 SVG loader를 호출하지 않는다', async () => {
    const url = 'https://example.com/photo.png';

    await convertStringToElement(url, { crossOrigin: 'use-credentials' });

    expect(vi.mocked(loadImageFromUrl)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(loadImageFromUrl).mock.calls[0]!;
    expect(call[0]).toBe(url);
    // crossOrigin이 두 번째 인자로 전달된다.
    expect(call[1]).toBe('use-credentials');
    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
  });

  it('blob: URL은 Blob URL loader로 분기한다', async () => {
    const blobUrl = 'blob:http://localhost/abcdef';

    await convertStringToElement(blobUrl);

    expect(vi.mocked(loadBlobUrl)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadBlobUrl).mock.calls[0]![0]).toBe(blobUrl);
    expect(vi.mocked(loadImageFromUrl)).not.toHaveBeenCalled();
    expect(vi.mocked(convertSvgToElement)).not.toHaveBeenCalled();
  });

  it('SVG data URL은 SVG loader로 위임되고 URL loader를 쓰지 않는다', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');
    // URL 인코딩 형식의 SVG data URL — detect에서 isDataUrlSvg로 'svg'로 분류된다.
    const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(MINIMAL_SVG)}`;

    await convertStringToElement(svgDataUrl);

    expect(vi.mocked(convertSvgToElement)).toHaveBeenCalledTimes(1);
    // data URL에서 복원된 SVG 본문이 첫 번째 인자로 전달된다(원본 data URL이 아님).
    expect(vi.mocked(convertSvgToElement).mock.calls[0]![0]).toContain('<svg');
    expect(vi.mocked(loadImageFromUrl)).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('SVG loader가 ImageProcessError로 실패하면 동일 오류가 전파된다', async () => {
    const loaderError = new ImageProcessError('SVG load failed', 'SOURCE_LOAD_FAILED');
    vi.mocked(convertSvgToElement).mockRejectedValueOnce(loaderError);

    await expect(convertStringToElement(MINIMAL_SVG)).rejects.toBe(loaderError);
    expect(vi.mocked(loadImageFromUrl)).not.toHaveBeenCalled();
  });

  it('SVG loader가 일반 Error로 실패하면 ImageProcessError로 감싸지 않고 그대로 전파한다', async () => {
    // 인라인 SVG 분기는 loader 결과를 직접 return하므로 오류를 정규화하지 않는다.
    const plainError = new Error('decode boom');
    vi.mocked(convertSvgToElement).mockRejectedValueOnce(plainError);

    await expect(convertStringToElement(MINIMAL_SVG)).rejects.toBe(plainError);
  });
});
