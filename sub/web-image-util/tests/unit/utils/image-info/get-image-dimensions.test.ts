/**
 * Blob → Image 로드 경로를 거치는 getImageDimensions 케이스만 happy-dom에 남긴다.
 * Canvas 입력 케이스는 `get-image-dimensions-jsdom.test.ts`에 있다.
 */

import { describe, expect, it, vi } from 'vitest';
import { getImageDimensions } from '../../../../src/utils';

describe('getImageDimensions (Blob 입력 디코딩 경로)', () => {
  it('치수만 조회할 때는 Blob 포맷 판정을 위한 추가 읽기를 하지 않는다', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const textSpy = vi.spyOn(blob, 'text');
    const arrayBufferSpy = vi.spyOn(blob, 'arrayBuffer');

    await expect(getImageDimensions(blob)).resolves.toEqual({ width: 100, height: 100 });
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
