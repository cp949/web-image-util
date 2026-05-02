import { describe, expect, it, vi } from 'vitest';

import { getImageDimensions, getImageInfo } from '../../../src/utils';

describe('image info utilities', () => {
  it('캔버스 치수는 이미지 변환 없이 캔버스 속성에서 바로 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL');

    await expect(getImageDimensions(canvas)).resolves.toEqual({ width: 320, height: 180 });
    expect(toDataURLSpy).not.toHaveBeenCalled();
  });

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

  it('치수만 조회할 때는 Blob 포맷 판정을 위한 추가 읽기를 하지 않는다', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const textSpy = vi.spyOn(blob, 'text');
    const arrayBufferSpy = vi.spyOn(blob, 'arrayBuffer');

    await expect(getImageDimensions(blob)).resolves.toEqual({ width: 100, height: 100 });
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
