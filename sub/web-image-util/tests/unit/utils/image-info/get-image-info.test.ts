/**
 * Blob → Image 로드 경로를 거쳐야 하는 getImageInfo 케이스만 happy-dom에 남긴다.
 * jsdom에서 안전한 SVG 입력 케이스는 `get-image-info-jsdom.test.ts`에 있다.
 */

import { describe, expect, it, vi } from 'vitest';
import { getImageInfo } from '../../../../src/utils';

describe('getImageInfo (Blob 입력 디코딩 경로)', () => {
  it('Blob 정보 조회는 MIME 포맷을 재사용하고 이미지 로딩을 중복하지 않는다', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const textSpy = vi.spyOn(blob, 'text');
    const arrayBufferSpy = vi.spyOn(blob, 'arrayBuffer');

    await expect(getImageInfo(blob)).resolves.toMatchObject({ format: 'png' });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
