import { describe, expect, it, vi } from 'vitest';
import { getImageDimensions } from '../../../../src/utils';

describe('getImageDimensions', () => {
  it('캔버스 치수는 이미지 변환 없이 캔버스 속성에서 바로 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL');

    await expect(getImageDimensions(canvas)).resolves.toEqual({ width: 320, height: 180 });
    expect(toDataURLSpy).not.toHaveBeenCalled();
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
