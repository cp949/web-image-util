/**
 * jsdom 환경의 알려진 제약을 회귀 테스트로 박아둔다.
 *
 * jsdom 29는 `URL.createObjectURL(blob)`이 만든 blob URL을 `HTMLImageElement`가
 * 디코딩하지 못한다. vitest 환경에서는 jsdom 자체 `URL.createObjectURL`이 없어
 * Node 전역 구현이 노출되며, 그 결과 URL이 `blob:nodedata:` 스킴이라 jsdom의
 * resource loader가 해석하지 못해 `img.onerror`가 즉시 발생한다.
 *
 * 이 테스트가 통과한다 = 제약이 그대로다. Blob → Image 로드를 단정해야 하는
 * 테스트는 happy-dom에 남기거나 `tests/browser/**`로 옮긴다.
 *
 * 이 테스트가 실패한다 = jsdom이 해당 경로를 지원하기 시작했다는 신호다. 그
 * 시점에 가이드의 "알려진 jsdom 제약" 항목과 마이그레이션 정책을 재평가한다.
 */

import { describe, expect, it } from 'vitest';

describe('jsdom 환경 제약', () => {
  it('blob URL을 HTMLImageElement로 로드하면 onerror가 발생한다', async () => {
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = new Blob([pngSignature], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const result = await Promise.race([
      new Promise<'load' | 'error'>((resolve) => {
        const img = new Image();
        img.onload = () => resolve('load');
        img.onerror = () => resolve('error');
        img.src = url;
      }),
      new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), 3000);
      }),
    ]);

    URL.revokeObjectURL(url);

    // 'error' 외 결과가 나오면 jsdom 동작이 바뀐 것. 가이드와 마이그레이션 정책을 재평가한다.
    expect(result).toBe('error');
  });
});
