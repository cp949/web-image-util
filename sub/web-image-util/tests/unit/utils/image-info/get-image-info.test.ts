import { describe, expect, it, vi } from 'vitest';
import { getImageInfo } from '../../../../src/utils';

describe('getImageInfo', () => {
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

  it('Blob 정보 조회는 MIME 포맷을 재사용하고 이미지 로딩을 중복하지 않는다', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const textSpy = vi.spyOn(blob, 'text');
    const arrayBufferSpy = vi.spyOn(blob, 'arrayBuffer');

    await expect(getImageInfo(blob)).resolves.toEqual({ width: 100, height: 100, format: 'png' });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
