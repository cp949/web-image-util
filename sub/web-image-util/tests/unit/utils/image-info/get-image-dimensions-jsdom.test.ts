/**
 * Canvas 입력 경로의 getImageDimensions 케이스만 jsdom으로 가져온다.
 * JPEG Blob 입력은 production이 내부에서 Image 로드를 거쳐 jsdom에서 실패하므로
 * 브라우저 Blob URL 이미지 로딩 경로는 browser 테스트에서 다룬다.
 */

import { describe, expect, it, vi } from 'vitest';
import { getImageDimensions } from '../../../../src/utils';

describe('getImageDimensions (jsdom-safe)', () => {
  it('캔버스 치수는 이미지 변환 없이 캔버스 속성에서 바로 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL');

    await expect(getImageDimensions(canvas)).resolves.toEqual({ width: 320, height: 180 });
    expect(toDataURLSpy).not.toHaveBeenCalled();
  });
});
