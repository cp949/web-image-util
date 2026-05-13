/**
 * 포맷 지원 캐시 검증 중 jsdom에서 통과하는 케이스만 모은다.
 * jsdom + canvas 패키지는 `toDataURL('image/webp', ...)`를 PNG로 fallback하기 때문에
 * "지원되는 WebP 포맷"을 가정한 케이스는 실제 브라우저 스모크에서 다룬다.
 */

import { describe, expect, it, vi } from 'vitest';

describe('포맷 지원 캐시 (jsdom-safe)', () => {
  function spyOnCanvasToDataURL() {
    const canvasProto = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    return vi.spyOn(canvasProto, 'toDataURL');
  }

  it('동일 포맷에 대해 toDataURL이 두 번 호출되지 않는다', async () => {
    vi.resetModules();

    const spy = spyOnCanvasToDataURL();

    try {
      const { processImage } = await import('../../../src');
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;

      // supportsFormat은 private이므로 포맷 미지정 toBlob()으로 getBestFormat → supportsFormat 경로를 두 번 통과시킨다.
      await processImage(canvas).toBlob();
      await processImage(canvas).toBlob();

      const probeCalls = spy.mock.calls.filter(([mimeType, quality]) => mimeType === 'image/webp' && quality === 0.5);
      expect(probeCalls).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
