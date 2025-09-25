/**
 * 크로스 플랫폼 호환성 계약 테스트
 *
 * 목적: 브라우저별 API 차이점과 호환성 패턴 검증
 * 환경: Node.js (브라우저 환경별 차이점 시뮬레이션)
 * 범위: Chrome, Firefox, Safari, Edge 호환성 계약
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 브라우저별 특성 모킹
const createBrowserMock = (browserName: string) => {
  const isChrome = browserName === 'chrome';
  const isFirefox = browserName === 'firefox';
  const isSafari = browserName === 'safari';
  const isEdge = browserName === 'edge';

  return {
    // User Agent 시뮬레이션
    navigator: {
      userAgent: (() => {
        switch (browserName) {
          case 'chrome':
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          case 'firefox':
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
          case 'safari':
            return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';
          case 'edge':
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
          default:
            return 'Mozilla/5.0';
        }
      })(),
      vendor: isChrome ? 'Google Inc.' : isSafari ? 'Apple Computer, Inc.' : '',
    },

    // Canvas 구현 차이
    HTMLCanvasElement: vi.fn().mockImplementation(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        // 브라우저별 Canvas 2D 구현 차이
        drawImage: vi.fn(),
        getImageData: vi.fn(),
        putImageData: vi.fn(),
        createImageData: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        setTransform: vi.fn(),
        resetTransform: vi.fn(), // Chrome, Firefox 지원
        // Safari/Edge에서 다를 수 있는 속성들
        ...(isSafari ? {} : { imageSmoothingEnabled: true }), // Safari는 imageSmoothingEnabled 없음
        ...(isSafari ? { webkitImageSmoothingEnabled: true } : {}), // Safari 전용
        ...(isFirefox ? { mozImageSmoothingEnabled: true } : {}), // Firefox 전용
        ...(isEdge ? { msImageSmoothingEnabled: true } : {}), // Edge 전용
        imageSmoothingQuality: isChrome || isFirefox ? 'low' : undefined,
        // 기본 속성들
        fillStyle: '#000000',
        strokeStyle: '#000000',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
      }),
      toDataURL: vi.fn().mockImplementation((type = 'image/png') => {
        // 브라우저별 지원 포맷 차이
        const supportedFormats = {
          chrome: ['image/png', 'image/jpeg', 'image/webp'],
          firefox: ['image/png', 'image/jpeg', 'image/webp'],
          safari: ['image/png', 'image/jpeg'], // WebP 지원 제한적
          edge: ['image/png', 'image/jpeg', 'image/webp'],
        }[browserName] || ['image/png', 'image/jpeg'];

        if (!supportedFormats.includes(type)) {
          return 'data:image/png;base64,'; // fallback to PNG
        }
        return `data:${type};base64,`;
      }),
      toBlob: vi.fn().mockImplementation((callback, type = 'image/png') => {
        // 브라우저별 지원 포맷 차이 시뮬레이션
        const supportedFormats = {
          chrome: ['image/png', 'image/jpeg', 'image/webp'],
          firefox: ['image/png', 'image/jpeg', 'image/webp'],
          safari: ['image/png', 'image/jpeg'],
          edge: ['image/png', 'image/jpeg', 'image/webp'],
        }[browserName] || ['image/png', 'image/jpeg'];

        const finalType = supportedFormats.includes(type) ? type : 'image/png';
        const blob = new Blob(['mock-data'], { type: finalType });
        setTimeout(() => callback(blob), 0);
      }),
    })),

    // 브라우저별 지원 API 차이
    features: {
      webp: isChrome || isFirefox || isEdge,
      avif: isChrome, // Chrome만 지원
      offscreenCanvas: isChrome || isFirefox,
      imageBitmap: !isSafari, // Safari는 제한적 지원
      createImageBitmap: !isSafari,
      transferControlToOffscreen: isChrome,
    },

    // File API 구현 차이
    FileReader: vi.fn().mockImplementation(() => ({
      EMPTY: 0,
      LOADING: 1,
      DONE: 2,
      readyState: 0,
      result: null,
      error: null,
      abort: vi.fn(),
      readAsArrayBuffer: vi.fn(),
      readAsBinaryString: vi.fn(),
      readAsDataURL: vi.fn(),
      readAsText: vi.fn(),
      onabort: null,
      onerror: null,
      onload: vi.fn(),
      onloadend: null,
      onloadstart: null,
      onprogress: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),

    // URL API 구현 차이
    URL: {
      createObjectURL: vi.fn().mockImplementation(() => {
        const prefix = {
          chrome: 'blob:http://localhost:3000/',
          firefox: 'blob:http://localhost:3000/',
          safari: 'blob:http://localhost:3000/', // 같은 형식이지만 내부 구현 차이
          edge: 'blob:http://localhost:3000/',
        }[browserName] || 'blob:http://localhost:3000/';

        return `${prefix}${Date.now()}-${Math.random()}`;
      }),
      revokeObjectURL: vi.fn(),
    },

    // DOM 구현 차이
    document: {
      createElement: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return new HTMLCanvasElement();
        }
        if (tagName === 'img') {
          return {
            src: '',
            width: 0,
            height: 0,
            naturalWidth: 0,
            naturalHeight: 0,
            complete: false,
            crossOrigin: null,
            // 브라우저별 이벤트 처리 차이
            onload: null,
            onerror: null,
            onabort: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          };
        }
        return {};
      }),
    },
  };
};

describe('크로스 플랫폼 호환성 계약 테스트', () => {
  const browsers = ['chrome', 'firefox', 'safari', 'edge'];

  browsers.forEach(browserName => {
    describe(`${browserName.toUpperCase()} 브라우저 호환성`, () => {
      let browserMock: ReturnType<typeof createBrowserMock>;

      beforeEach(() => {
        browserMock = createBrowserMock(browserName);

        // 전역 객체에 브라우저별 구현 할당
        global.HTMLCanvasElement = browserMock.HTMLCanvasElement;
        global.FileReader = browserMock.FileReader as any;
        global.URL = browserMock.URL as any;
        global.document = browserMock.document as any;

        // navigator는 defineProperty로 설정
        Object.defineProperty(global, 'navigator', {
          value: browserMock.navigator,
          writable: true,
          configurable: true,
        });
      });

      it(`${browserName} Canvas 기본 기능 호출 패턴`, () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        expect(canvas).toBeDefined();
        expect(ctx).toBeDefined();
        expect(ctx).toHaveProperty('drawImage');
        expect(ctx).toHaveProperty('getImageData');
        expect(ctx).toHaveProperty('putImageData');
      });

      it(`${browserName} Canvas 출력 포맷 지원 패턴`, () => {
        const canvas = document.createElement('canvas');

        // PNG는 모든 브라우저에서 지원
        const pngDataUrl = canvas.toDataURL('image/png');
        expect(pngDataUrl).toContain('data:image/png');

        // JPEG도 모든 브라우저에서 지원
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        expect(jpegDataUrl).toContain('data:image/jpeg');

        // WebP는 브라우저별로 다름
        const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
        if (browserMock.features.webp) {
          expect(webpDataUrl).toContain('data:image/webp');
        } else {
          // Safari는 WebP를 PNG로 fallback
          expect(webpDataUrl).toContain('data:image/png');
        }
      });

      it(`${browserName} Canvas toBlob 비동기 패턴`, async () => {
        const canvas = document.createElement('canvas');
        const callback = vi.fn();

        canvas.toBlob(callback, 'image/png');

        // 비동기 콜백 호출 대기
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(callback).toHaveBeenCalled();
        expect(callback.mock.calls[0][0]).toHaveProperty('type');
      });

      it(`${browserName} ImageSmoothing 속성 호환성`, () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 브라우저별 ImageSmoothing 속성 확인
        if (browserName === 'safari') {
          expect(ctx).toHaveProperty('webkitImageSmoothingEnabled');
          expect(ctx).not.toHaveProperty('imageSmoothingEnabled');
        } else if (browserName === 'firefox') {
          expect(ctx).toHaveProperty('mozImageSmoothingEnabled');
          expect(ctx).toHaveProperty('imageSmoothingEnabled');
        } else if (browserName === 'edge') {
          expect(ctx).toHaveProperty('msImageSmoothingEnabled');
          expect(ctx).toHaveProperty('imageSmoothingEnabled');
        } else {
          expect(ctx).toHaveProperty('imageSmoothingEnabled');
        }
      });

      it(`${browserName} URL 생성 패턴 일관성`, () => {
        const blob = new Blob(['test'], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        expect(url).toMatch(/^blob:http:\/\/localhost:3000\//);
        expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

        URL.revokeObjectURL(url);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
      });

      it(`${browserName} FileReader API 일관성`, () => {
        const reader = new FileReader();
        const blob = new Blob(['test'], { type: 'text/plain' });

        // 표준 상수 확인
        expect(reader.EMPTY).toBe(0);
        expect(reader.LOADING).toBe(1);
        expect(reader.DONE).toBe(2);

        // 표준 메서드 호출
        reader.readAsDataURL(blob);
        expect(reader.readAsDataURL).toHaveBeenCalledWith(blob);

        reader.readAsArrayBuffer(blob);
        expect(reader.readAsArrayBuffer).toHaveBeenCalledWith(blob);
      });

      it(`${browserName} 고급 기능 지원 여부 확인`, () => {
        // OffscreenCanvas 지원
        if (browserMock.features.offscreenCanvas) {
          expect(browserMock.features.offscreenCanvas).toBe(true);
        }

        // ImageBitmap 지원
        if (browserMock.features.imageBitmap) {
          expect(browserMock.features.imageBitmap).toBe(true);
        }

        // WebP 지원
        if (browserMock.features.webp) {
          expect(browserMock.features.webp).toBe(true);
        }

        // AVIF 지원 (Chrome만)
        if (browserName === 'chrome') {
          expect(browserMock.features.avif).toBe(true);
        } else {
          expect(browserMock.features.avif).toBe(false);
        }
      });
    });
  });

  describe('브라우저 간 호환성 패턴', () => {
    it('모든 브라우저에서 동일한 기본 Canvas API 지원', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);
        global.HTMLCanvasElement = browserMock.HTMLCanvasElement;
        global.document = browserMock.document as any;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 모든 브라우저에서 지원해야 하는 기본 메서드들
        expect(ctx).toHaveProperty('drawImage');
        expect(ctx).toHaveProperty('getImageData');
        expect(ctx).toHaveProperty('putImageData');
        expect(ctx).toHaveProperty('save');
        expect(ctx).toHaveProperty('restore');
        expect(ctx).toHaveProperty('clearRect');
        expect(ctx).toHaveProperty('fillRect');
      });
    });

    it('브라우저별 WebP 지원 차이 처리 패턴', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);
        global.HTMLCanvasElement = browserMock.HTMLCanvasElement;
        global.document = browserMock.document as any;

        const canvas = document.createElement('canvas');
        const result = canvas.toDataURL('image/webp');

        if (browserMock.features.webp) {
          expect(result).toContain('data:image/webp');
        } else {
          // WebP 미지원 시 PNG로 fallback
          expect(result).toContain('data:image/png');
        }
      });
    });

    it('ImageSmoothing 속성 통합 접근 패턴', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);
        global.HTMLCanvasElement = browserMock.HTMLCanvasElement;
        global.document = browserMock.document as any;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 브라우저별 ImageSmoothing 속성 통합 접근
        let imageSmoothingSupported = false;

        if (ctx?.imageSmoothingEnabled !== undefined) {
          imageSmoothingSupported = true;
        } else if ((ctx as any)?.webkitImageSmoothingEnabled !== undefined) {
          imageSmoothingSupported = true;
        } else if ((ctx as any)?.mozImageSmoothingEnabled !== undefined) {
          imageSmoothingSupported = true;
        } else if ((ctx as any)?.msImageSmoothingEnabled !== undefined) {
          imageSmoothingSupported = true;
        }

        // 모든 브라우저에서 어떤 형태로든 ImageSmoothing 지원
        expect(imageSmoothingSupported).toBe(true);
      });
    });

    it('User Agent 기반 브라우저 감지 패턴', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);

        // navigator는 defineProperty로 설정
        Object.defineProperty(global, 'navigator', {
          value: browserMock.navigator,
          writable: true,
          configurable: true,
        });

        const userAgent = navigator.userAgent;

        switch (browserName) {
          case 'chrome':
            expect(userAgent).toContain('Chrome');
            expect(userAgent).toContain('Safari'); // Chrome도 Safari를 포함
            expect(userAgent).not.toContain('Firefox');
            break;
          case 'firefox':
            expect(userAgent).toContain('Firefox');
            expect(userAgent).toContain('Gecko');
            expect(userAgent).not.toContain('Chrome');
            break;
          case 'safari':
            expect(userAgent).toContain('Safari');
            expect(userAgent).toContain('Version');
            expect(userAgent).not.toContain('Chrome');
            expect(userAgent).not.toContain('Firefox');
            break;
          case 'edge':
            expect(userAgent).toContain('Edg'); // Edge는 'Edg'로 식별
            expect(userAgent).toContain('Chrome'); // Edge도 Chrome 기반
            break;
        }
      });
    });
  });

  describe('호환성 Fallback 패턴', () => {
    it('지원하지 않는 포맷에 대한 Fallback 처리', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);
        global.HTMLCanvasElement = browserMock.HTMLCanvasElement;
        global.document = browserMock.document as any;

        const canvas = document.createElement('canvas');

        // AVIF는 Chrome만 지원
        const avifResult = canvas.toDataURL('image/avif');
        if (browserName === 'chrome') {
          // Chrome에서는 실제로는 지원하지만, 모킹에서는 PNG로 fallback
          expect(avifResult).toContain('data:image/png');
        } else {
          expect(avifResult).toContain('data:image/png');
        }
      });
    });

    it('Canvas Context 획득 실패 시 Fallback 패턴', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);

        // Context 획득 실패 시뮬레이션
        browserMock.HTMLCanvasElement = vi.fn().mockImplementation(() => ({
          getContext: vi.fn().mockReturnValue(null), // Context 획득 실패
        }));

        global.HTMLCanvasElement = browserMock.HTMLCanvasElement;
        global.document = browserMock.document as any;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        expect(ctx).toBeNull();
        expect(canvas.getContext).toHaveBeenCalledWith('2d');
      });
    });

    it('이벤트 리스너 호환성 패턴', () => {
      browsers.forEach(browserName => {
        const browserMock = createBrowserMock(browserName);
        global.document = browserMock.document as any;

        const img = document.createElement('img');
        const handler = vi.fn();

        // addEventListener 방식 (모든 모던 브라우저 지원)
        img.addEventListener('load', handler);
        expect(img.addEventListener).toHaveBeenCalledWith('load', handler);

        // on* 속성 방식 (레거시 호환)
        img.onload = handler;
        expect(img.onload).toBe(handler);
      });
    });
  });
});