/**
 * getImageDimensions와 파생 함수(aspect ratio, orientation)의 분기를 jsdom에서 고정한다.
 *
 * 실제 decode가 필요한 Blob/URL 로드 경로는 browser 테스트에서 다루고,
 * 여기서는 변환 없이 치수를 읽는 경로와 SVG 파싱 경로, 잘못된 입력 실패만 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getImageAspectRatio, getImageDimensions, getImageOrientation } from '../../../../src';

/** decode 없이 "로드 완료" 상태로 보이는 HTMLImageElement를 만든다. */
function createLoadedImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'complete', { value: true });
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight });
  return img;
}

describe('getImageDimensions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock('../../../../src/core/source-converter/index');
    vi.resetModules();
  });

  it('캔버스는 변환 없이 width/height를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;

    await expect(getImageDimensions(canvas)).resolves.toEqual({ width: 320, height: 180 });
  });

  it('로드 완료된 HTMLImageElement는 naturalWidth/Height를 그대로 읽는다', async () => {
    const img = createLoadedImage(640, 480);

    await expect(getImageDimensions(img)).resolves.toEqual({ width: 640, height: 480 });
  });

  it('인라인 SVG 문자열은 SVG 파서로 치수를 추출한다', async () => {
    await expect(getImageDimensions('<svg width="120" height="60"></svg>')).resolves.toEqual({
      width: 120,
      height: 60,
    });
  });

  it('viewBox만 있는 인라인 SVG도 파서 치수를 반환한다', async () => {
    await expect(getImageDimensions('<svg viewBox="0 0 10 5"></svg>')).resolves.toEqual({
      width: 10,
      height: 5,
    });
  });

  it('.svg 참조를 포함한 인라인 SVG는 로드 경로로 새지 않고 파서 치수를 반환한다', async () => {
    // 본문 안의 `sprite.svg#icon`은 경로 확장자 힌트와 겹친다. 판정이 svg-inline이므로
    // 이미지 로드 없이 파서만으로 끝나야 한다 — 50KB를 넘겨 로드 경로가 반드시
    // createObjectURL을 거치게 만든 뒤, 그것이 호출되지 않는 것으로 확인한다.
    const padding = '<rect width="1" height="1"/>'.repeat(2000);
    const svg = `<svg width="120" height="60"><use href="sprite.svg#icon"/>${padding}</svg>`;
    expect(new Blob([svg]).size).toBeGreaterThan(50 * 1024);

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL');

    await expect(getImageDimensions(svg)).resolves.toEqual({ width: 120, height: 60 });
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('제어문자가 섞인 .svg URL은 URL 문자열을 SVG 본문으로 파싱하지 않는다', async () => {
    // URL 파서는 NUL을 떼고 `.svg`로 보지만 확장자 문자열 검사는 그러지 못한다.
    // 이 갈림에서 URL 문자열 자체를 SVG 본문으로 넘기면 안 되고 로드 경로로 가야 한다.
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network down')));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(getImageDimensions('https://example.com/icon.svg\u0000')).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('SVG Blob은 본문을 읽어 치수를 추출한다', async () => {
    const blob = new Blob(['<svg width="40" height="20"></svg>'], { type: 'image/svg+xml' });

    await expect(getImageDimensions(blob)).resolves.toEqual({ width: 40, height: 20 });
  });

  it.each([
    { caseName: 'MIME 없음', type: '' },
    { caseName: 'text/xml MIME', type: 'text/xml' },
  ])('$caseName SVG Blob도 공통 변환 없이 원본 선언 치수를 반환한다', async ({ type }) => {
    const convertToImageElement = vi.fn(() => Promise.reject(new Error('공통 변환 경로를 사용하면 안 된다')));
    vi.resetModules();
    vi.doMock('../../../../src/core/source-converter/index', () => ({ convertToImageElement }));
    const { getImageDimensions: getInternalImageDimensions } = await import(
      '../../../../src/utils/image-info/dimensions.internal'
    );
    const blob = new Blob(['<svg width="73" height="29"></svg>'], { type });

    await expect(getInternalImageDimensions(blob)).resolves.toEqual({ width: 73, height: 29 });
    expect(convertToImageElement).not.toHaveBeenCalled();
  });

  it('지원하지 않는 입력은 변환 단계에서 거부한다', async () => {
    // 캔버스/이미지/SVG 어느 경로에도 해당하지 않는 입력은 convertToImageElement에서 실패한다.
    await expect(getImageDimensions(123 as never)).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });
});

describe('getImageAspectRatio', () => {
  it('width/height 비율을 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;

    await expect(getImageAspectRatio(canvas)).resolves.toBe(2);
  });
});

describe('getImageOrientation', () => {
  it('가로가 더 길면 landscape를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;

    await expect(getImageOrientation(canvas)).resolves.toBe('landscape');
  });

  it('세로가 더 길면 portrait를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 200;

    await expect(getImageOrientation(canvas)).resolves.toBe('portrait');
  });

  it('가로/세로가 같으면 square를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;

    await expect(getImageOrientation(canvas)).resolves.toBe('square');
  });
});
