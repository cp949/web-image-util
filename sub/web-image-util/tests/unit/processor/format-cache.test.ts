/**
 * WebP 포맷이 지원된다고 가정한 캐시 검증은 happy-dom canvas-mock 환경에서만 안전하다.
 * jsdom + canvas 패키지는 `toDataURL('image/webp', ...)`를 PNG로 fallback하기 때문에
 * 같은 단정이 jsdom에서는 통과하지 못한다.
 *
 * jsdom에서 안전한 캐시 동작 케이스는 `format-cache-jsdom.test.ts`에 있다.
 */

import { describe, expect, it, vi } from 'vitest';

describe('포맷 지원 캐시 (WebP 지원 가정)', () => {
  function spyOnCanvasToDataURL() {
    // happy-dom 환경에서 canvas는 MockHTMLCanvasElement 인스턴스이므로
    // HTMLCanvasElement.prototype 대신 실제 인스턴스 프로토타입에 spy한다.
    // spy는 DOM 전역 목에 걸리므로 새 모듈이 생성하는 canvas도 동일하게 가로챈다.
    const canvasProto = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    return vi.spyOn(canvasProto, 'toDataURL');
  }

  it('지원되는 WebP 포맷도 한 번 감지한 뒤 캐시한다', async () => {
    vi.resetModules();

    const spy = spyOnCanvasToDataURL();
    spy.mockImplementation((type?: string) => {
      if (type === 'image/webp') {
        return 'data:image/webp;base64,xxx';
      }
      return `data:${type ?? 'image/png'};base64,xxx`;
    });

    try {
      const { processImage } = await import('../../../src');
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;

      await processImage(canvas).toBlob();
      await processImage(canvas).toBlob();

      const probeCalls = spy.mock.calls.filter(([mimeType, quality]) => mimeType === 'image/webp' && quality === 0.5);
      expect(probeCalls).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
