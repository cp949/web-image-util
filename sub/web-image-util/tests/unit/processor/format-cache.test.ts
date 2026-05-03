import { describe, expect, it, vi } from 'vitest';

describe('포맷 지원 캐시', () => {
  function spyOnCanvasToDataURL() {
    // happy-dom 환경에서 canvas는 MockHTMLCanvasElement 인스턴스이므로
    // HTMLCanvasElement.prototype 대신 실제 인스턴스 프로토타입에 spy한다.
    // spy는 DOM 전역 목에 걸리므로 새 모듈이 생성하는 canvas도 동일하게 가로챈다.
    const canvasProto = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
    return vi.spyOn(canvasProto, 'toDataURL');
  }

  it('동일 포맷에 대해 toDataURL이 두 번 호출되지 않는다', async () => {
    // 포맷 지원 캐시는 모듈 스코프 변수다.
    // resetModules() 후 동적 import로 새 모듈 인스턴스를 로드해 빈 캐시에서 시작한다.
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
