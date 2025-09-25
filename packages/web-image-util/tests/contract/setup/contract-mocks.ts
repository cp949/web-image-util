/**
 * 계약 테스트용 공통 모킹 설정
 *
 * 목적: 모든 계약 테스트에서 사용할 브라우저 API 모킹 제공
 * 환경: Node.js (실제 브라우저 API 없음)
 * 특징: 일관된 모킹 환경 제공
 */

import { vi, beforeEach, afterEach } from 'vitest';

// 브라우저 API 모킹 초기화
beforeEach(() => {
  // 기본 DOM 객체들 모킹
  global.HTMLCanvasElement = vi.fn().mockImplementation(() => ({
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue({
      // Canvas 2D API 기본 메서드들
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(40000), // 100x100x4 = 40000 bytes (RGBA)
        width: 100,
        height: 100,
      }),
      putImageData: vi.fn(),
      createImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(40000), // 100x100x4 = 40000 bytes (RGBA)
        width: 100,
        height: 100,
      }),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      transform: vi.fn(),
      setTransform: vi.fn(),
      resetTransform: vi.fn(),

      // Canvas 2D API 속성들
      fillStyle: '#000000',
      strokeStyle: '#000000',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      lineDashOffset: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'inherit',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
    }),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
    toBlob: vi.fn().mockImplementation((callback, type = 'image/png', quality = 1) => {
      const blob = new Blob(['mock-canvas-data'], { type });
      setTimeout(() => callback(blob), 0);
    }),
  })) as any;

  // HTMLImageElement 모킹
  global.HTMLImageElement = vi.fn().mockImplementation(() => ({
    src: '',
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    complete: false,
    crossOrigin: null,
    onload: null,
    onerror: null,
    onabort: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;

  // File API 모킹
  global.File = vi.fn().mockImplementation((fileBits, fileName, options = {}) => ({
    name: fileName,
    size: fileBits.reduce((total: number, part: any) => total + (part?.length || 0), 0),
    type: options.type || '',
    lastModified: Date.now(),
    lastModifiedDate: new Date(),
    webkitRelativePath: '',
    slice: vi.fn().mockImplementation((start, end, contentType) =>
      new File(fileBits.slice(start, end), fileName, { type: contentType })
    ),
  })) as any;

  global.FileReader = vi.fn().mockImplementation(() => ({
    // FileReader 표준 상수
    EMPTY: 0,
    LOADING: 1,
    DONE: 2,

    // 인스턴스 속성
    readyState: 0,
    result: null,
    error: null,

    // 메서드
    abort: vi.fn(),
    readAsArrayBuffer: vi.fn(),
    readAsBinaryString: vi.fn(),
    readAsDataURL: vi.fn(),
    readAsText: vi.fn(),

    // 이벤트 핸들러
    onabort: null,
    onerror: null,
    onload: null,
    onloadend: null,
    onloadstart: null,
    onprogress: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;

  global.Blob = vi.fn().mockImplementation((parts = [], options = {}) => ({
    size: parts.reduce((total: number, part: any) => total + (part?.length || 0), 0),
    type: options.type || '',
    slice: vi.fn().mockImplementation((start, end, contentType) =>
      new Blob(parts.slice(start, end), { type: contentType })
    ),
  })) as any;

  // URL API 모킹
  global.URL = {
    createObjectURL: vi.fn().mockImplementation(() =>
      `blob:http://localhost:3000/${Date.now()}-${Math.random()}`
    ),
    revokeObjectURL: vi.fn(),
  } as any;

  // DOM 문서 객체 모킹
  global.document = {
    createElement: vi.fn().mockImplementation((tagName: string) => {
      switch (tagName.toLowerCase()) {
        case 'canvas':
          return new global.HTMLCanvasElement();
        case 'img':
          return new global.HTMLImageElement();
        default:
          return {
            tagName: tagName.toUpperCase(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          };
      }
    }),
  } as any;

  // Navigator 객체 모킹 (브라우저 감지용)
  Object.defineProperty(global, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Test Environment) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      vendor: 'Test',
      platform: 'Test',
      language: 'en-US',
      languages: ['en-US', 'en'],
      onLine: true,
    },
    writable: true,
    configurable: true,
  });

  // Window 객체 모킹 (필요한 경우)
  global.window = {
    location: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      hostname: 'localhost',
      port: '3000',
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as any;

  // Performance API 모킹 (성능 테스트용)
  global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  } as any;

  // 최신 브라우저 API 모킹 (지원 여부 테스트용)
  global.OffscreenCanvas = vi.fn().mockImplementation(() => ({
    width: 0,
    height: 0,
    getContext: vi.fn(),
    transferToImageBitmap: vi.fn(),
  })) as any;

  global.createImageBitmap = vi.fn().mockImplementation(async () => ({
    width: 100,
    height: 100,
    close: vi.fn(),
  }));

  // 에러 시뮬레이션을 위한 helper
  global.simulateError = (apiName: string, errorType: string) => {
    const error = new Error(`Simulated ${errorType} error in ${apiName}`);
    error.name = errorType;
    throw error;
  };
});

// 테스트 후 정리
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();

  // 타임아웃과 인터벌 정리
  vi.clearAllTimers();
  vi.useRealTimers();
});

// 공통 테스트 유틸리티
export const createMockCanvas = (width = 100, height = 100) => {
  const canvas = new global.HTMLCanvasElement();
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const createMockBlob = (content = 'test', type = 'text/plain') => {
  return new global.Blob([content], { type });
};

export const createMockFile = (content = 'test', name = 'test.txt', type = 'text/plain') => {
  return new global.File([content], name, { type });
};

export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// 테스트용 상수
export const MOCK_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
export const MOCK_BLOB_URL = 'blob:http://localhost:3000/mock-blob-url';

// 브라우저 기능 감지 모킹
export const mockBrowserFeatures = {
  webp: true,
  avif: false, // Chrome만 지원
  offscreenCanvas: true,
  imageBitmap: true,
  fileApi: true,
  canvasApi: true,
};