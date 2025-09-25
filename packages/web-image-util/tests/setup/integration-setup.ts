/**
 * 통합 테스트용 브라우저 API 모킹 설정
 * jsdom 환경에서 Canvas, Image, FileReader 등 브라우저 API 모킹
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Canvas API 모킹
const mockCanvas = {
  width: 0,
  height: 0,
  toBlob: vi.fn(),
  toDataURL: vi.fn(),
  getContext: vi.fn(),
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getBoundingClientRect: vi.fn(() => ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
  })),
};

// Canvas 2D Context 모킹
const mockContext = {
  drawImage: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  createImageData: vi.fn(),
  filter: 'none',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
};

// Image 모킹
const mockImage = {
  src: '',
  width: 0,
  height: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  complete: false,
  crossOrigin: null,
  currentSrc: '',
  decode: vi.fn(() => Promise.resolve()),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  onload: null,
  onerror: null,
  onabort: null,
};

// FileReader 모킹
const MockFileReader = vi.fn(() => ({
  result: null,
  error: null,
  readyState: 0,
  onload: null,
  onerror: null,
  onabort: null,
  onprogress: null,
  readAsDataURL: vi.fn(function(this: any, file: Blob) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,fake-base64-data`;
      this.readyState = 2; // DONE
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 10);
  }),
  readAsText: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  readAsBinaryString: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// URL API 모킹
const mockURL = {
  createObjectURL: vi.fn((object: any) => `blob:mock-${Math.random().toString(36).substr(2, 9)}`),
  revokeObjectURL: vi.fn(),
};

// Blob 생성자 모킹 (더 현실적으로)
const OriginalBlob = globalThis.Blob;
const MockBlob = vi.fn((parts: any[], options: any) => {
  const blob = new OriginalBlob(parts, options);
  // Blob에 추가 메서드나 속성이 필요한 경우 여기서 확장
  return blob;
});

// DOM 요소 생성 모킹
const mockDocument = {
  ...document,
  createElement: vi.fn((tagName: string) => {
    switch (tagName.toLowerCase()) {
      case 'canvas':
        const canvas = { ...mockCanvas };
        canvas.getContext = vi.fn((type: string) => {
          if (type === '2d') {
            return mockContext;
          }
          return null;
        });
        return canvas;
      case 'img':
        const img = { ...mockImage };
        // 이미지 로딩 시뮬레이션
        Object.defineProperty(img, 'src', {
          set: vi.fn(function(this: any, value: string) {
            this._src = value;
            // 비동기적으로 로드 이벤트 시뮬레이션
            setTimeout(() => {
              this.complete = true;
              this.naturalWidth = 100;
              this.naturalHeight = 100;
              this.width = 100;
              this.height = 100;
              if (this.onload) {
                this.onload();
              }
            }, 10);
          }),
          get: vi.fn(function(this: any) {
            return this._src || '';
          })
        });
        return img;
      default:
        return document.createElement(tagName);
    }
  }),
};

// 전역 객체에 모킹된 API들 설정
beforeEach(() => {
  // Canvas API 모킹을 위한 document 설정
  vi.stubGlobal('document', mockDocument);

  // FileReader 모킹
  vi.stubGlobal('FileReader', MockFileReader);

  // URL API 모킹
  vi.stubGlobal('URL', mockURL);

  // Blob 모킹 (필요한 경우)
  // vi.stubGlobal('Blob', MockBlob);

  // HTMLImageElement 모킹
  vi.stubGlobal('HTMLImageElement', function() { return mockImage; });

  // HTMLCanvasElement 모킹
  vi.stubGlobal('HTMLCanvasElement', function() { return mockCanvas; });
});

// 각 테스트 후 모킹 상태 초기화
afterEach(() => {
  vi.clearAllMocks();

  // Canvas 상태 초기화
  mockCanvas.width = 0;
  mockCanvas.height = 0;
  mockCanvas.toBlob = vi.fn();
  mockCanvas.toDataURL = vi.fn();

  // Image 상태 초기화
  mockImage.src = '';
  mockImage.complete = false;
  mockImage.naturalWidth = 0;
  mockImage.naturalHeight = 0;
  mockImage.width = 0;
  mockImage.height = 0;
});

// 테스트 헬퍼 함수들을 전역으로 노출
declare global {
  var mockCanvas: typeof mockCanvas;
  var mockContext: typeof mockContext;
  var mockImage: typeof mockImage;
  var MockFileReader: typeof MockFileReader;
}

globalThis.mockCanvas = mockCanvas;
globalThis.mockContext = mockContext;
globalThis.mockImage = mockImage;
globalThis.MockFileReader = MockFileReader;