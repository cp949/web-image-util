/**
 * getImageInfo 중 jsdom에서 안전한 케이스(SVG 입력 경로)만 모은다.
 * PNG Blob 입력 케이스는 production이 `createObjectURL(blob) + HTMLImageElement` 로드를 거쳐
 * jsdom에서 실패하는 Blob URL 이미지 로딩 경로는 browser 테스트에서 다룬다.
 */

import { describe, expect, it, vi } from 'vitest';
import { getImageInfo } from '../../../../src/utils';

describe('getImageInfo (jsdom-safe)', () => {
  it('SVG 문자열의 치수와 포맷을 한 번의 SVG 파싱 결과로 반환한다', async () => {
    const svg = '<svg width="240" height="135" xmlns="http://www.w3.org/2000/svg"></svg>';

    await expect(getImageInfo(svg)).resolves.toEqual({ width: 240, height: 135, format: 'svg' });
  });

  it('SVG Blob은 렌더링 목 경로로 떨어지지 않고 SVG 원본 치수를 반환한다', async () => {
    const svg = '<svg width="256" height="144" xmlns="http://www.w3.org/2000/svg"></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const textSpy = vi.spyOn(blob, 'text');

    await expect(getImageInfo(blob)).resolves.toEqual({ width: 256, height: 144, format: 'svg' });
    expect(textSpy).toHaveBeenCalledTimes(1);
  });
});
