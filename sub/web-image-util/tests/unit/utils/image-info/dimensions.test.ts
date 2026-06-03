/**
 * getImageDimensions와 파생 함수(aspect ratio, orientation)의 분기를 jsdom에서 고정한다.
 *
 * 실제 decode가 필요한 Blob/URL 로드 경로는 browser 테스트에서 다루고,
 * 여기서는 변환 없이 치수를 읽는 경로와 SVG 파싱 경로, 잘못된 입력 실패만 검증한다.
 */

import { describe, expect, it } from 'vitest';

import { getImageAspectRatio, getImageDimensions, getImageOrientation } from '../../../../src/utils';

/** decode 없이 "로드 완료" 상태로 보이는 HTMLImageElement를 만든다. */
function createLoadedImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'complete', { value: true });
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight });
  return img;
}

describe('getImageDimensions', () => {
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

  it('SVG Blob은 본문을 읽어 치수를 추출한다', async () => {
    const blob = new Blob(['<svg width="40" height="20"></svg>'], { type: 'image/svg+xml' });

    await expect(getImageDimensions(blob)).resolves.toEqual({ width: 40, height: 20 });
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
