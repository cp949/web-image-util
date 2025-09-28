/**
 * WSL 환경 전용 모킹 설정
 *
 * @description Canvas API와 브라우저 API를 모킹하여 WSL 환경에서 테스트 실행 가능하게 함
 * - Canvas 2D Context는 null 대신 모킹된 객체 반환
 * - DOM API 모킹 (Image, FileReader 등)
 * - 브라우저 전용 API 모킹 (URL.createObjectURL 등)
 */

import { vi } from 'vitest';

// DOM API 모킹 (happy-dom으로 해결되지 않는 부분)
const mockCanvas = {
  width: 100,
  height: 100,
  getContext: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(400), // 100x100 RGBA
      width: 100,
      height: 100,
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(400),
      width: 100,
      height: 100,
    })),
    canvas: undefined, // 순환 참조 방지
    // Canvas 2D Context 메서드들
    arc: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    // 필터 관련
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    // 스타일 관련
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    // 텍스트 관련
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    // 그림자 관련
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  })),
  toBlob: vi.fn((callback, mimeType = 'image/png', quality = 1) => {
    // 비동기로 mock Blob 생성
    setTimeout(() => {
      const mockBlob = new Blob(['mock-image-data'], { type: mimeType });
      callback(mockBlob);
    }, 0);
  }),
  toDataURL: vi.fn((mimeType = 'image/png', quality = 1) => {
    return `data:${mimeType};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
  }),
};

// Context7 MCP 베스트 프랙티스: vi.fn()을 사용한 개선된 HTMLCanvasElement 모킹
const MockHTMLCanvasElement = vi.fn(function MockHTMLCanvasElement(this: any) {
  this.width = 100;
  this.height = 100;
  this.getContext = mockCanvas.getContext;
  this.toBlob = mockCanvas.toBlob;
  this.toDataURL = vi.fn((mimeType = 'image/png', quality = 1) => {
    return `data:${mimeType};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
  });

  // Context7 패턴: instanceof 체크를 위한 prototype 설정
  Object.setPrototypeOf(this, MockHTMLCanvasElement.prototype);
});

// instanceof 체크를 위한 프로토타입 구성
MockHTMLCanvasElement.prototype.constructor = MockHTMLCanvasElement;

// HTMLImageElement 클래스 모킹
class MockHTMLImageElement {
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  private _src = '';
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  complete = false;
  crossOrigin: string | null = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  decoding = 'auto';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // 이미지 로딩 시뮬레이션 - Vitest 베스트 프랙티스 적용
    setTimeout(() => {
      const trimmedValue = (value || '').trim();

      // 에러 조건들 - 매우 제한적으로만 실패하도록 수정
      const shouldFail =
        !trimmedValue ||
        trimmedValue === 'data:text/plain;base64,invalid' ||
        trimmedValue === 'data:image/png;base64,' ||
        trimmedValue.includes('broken xml') ||
        trimmedValue === 'blob:mock-error-url' ||
        trimmedValue.includes('invalid-data-url') ||
        trimmedValue === 'https://slow.example.com/image.jpg' ||
        // 매우 구체적인 에러 케이스만 실패
        (trimmedValue.includes('blob:') && trimmedValue.includes('error')); // blob:*error* URL만 실패

      if (shouldFail) {
        this.complete = false;
        if (this.onerror) {
          this.onerror({} as Event);
        }
        return;
      }

      // 성공적인 로딩 시뮬레이션 - 다양한 크기 지원
      let width = 300;
      let height = 200;

      // Data URL에서 SVG인 경우 다른 크기
      if (trimmedValue.includes('svg+xml')) {
        width = 100;
        height = 100;
      }
      // ArrayBuffer/Blob에서 변환된 경우
      else if (trimmedValue.startsWith('blob:')) {
        width = 400;
        height = 300;
      }

      this.width = width;
      this.height = height;
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.complete = true;

      if (this.onload) {
        this.onload({} as Event);
      }
    }, 1); // 매우 짧은 지연으로 비동기 시뮬레이션
  }
}

// Context7 MCP 베스트 프랙티스: vi.stubGlobal() 사용
vi.stubGlobal('HTMLCanvasElement', MockHTMLCanvasElement);
vi.stubGlobal('HTMLImageElement', MockHTMLImageElement);

// Image 생성자를 MockHTMLImageElement로 설정
vi.stubGlobal('Image', MockHTMLImageElement);

// CanvasRenderingContext2D 모킹
vi.stubGlobal(
  'CanvasRenderingContext2D',
  vi.fn(() => mockCanvas.getContext())
);

// Image 생성자는 위에서 이미 MockHTMLImageElement로 설정됨

// FileReader 모킹 - Context7 MCP 베스트 프랙티스
vi.stubGlobal(
  'FileReader',
  vi.fn(() => ({
    readAsDataURL: vi.fn(function (this: any, blob) {
      setTimeout(() => {
        this.onload?.({ target: { result: 'data:image/png;base64,mock' } });
      }, 0);
    }),
    readAsArrayBuffer: vi.fn(function (this: any, blob) {
      setTimeout(() => {
        this.onload?.({ target: { result: new ArrayBuffer(8) } });
      }, 0);
    }),
    onload: null,
    onerror: null,
    result: null,
    EMPTY: 0,
    LOADING: 1,
    DONE: 2,
    readyState: 0,
  }))
);

// URL.createObjectURL/revokeObjectURL 모킹 - Context7 MCP 베스트 프랙티스
const mockURL = {
  createObjectURL: vi.fn((blob) => {
    // Blob 타입에 따라 다른 URL 생성 - Vitest 베스트 프랙티스 적용
    if (blob instanceof Blob) {
      // SVG Blob은 특별한 URL
      if (blob.type.includes('svg')) {
        return 'blob:mock-svg-url';
      }
      // 빈 Blob이거나 명시적으로 잘못된 타입만 에러 URL 생성
      if (blob.size === 0 || (blob.type === 'application/json' && blob.size === 0)) {
        return 'blob:mock-error-url';
      }
      // ArrayBuffer/Uint8Array에서 변환된 이미지 Blob들은 성공적으로 처리
      if (blob.type.startsWith('image/') && blob.size > 0) {
        return 'blob:mock-image-url';
      }
      // 대부분의 경우 성공적인 이미지 URL 생성
      return 'blob:mock-image-url';
    }
    return 'blob:mock-object-url';
  }),
  revokeObjectURL: vi.fn(),
};

vi.stubGlobal('URL', mockURL);

// Blob 생성자 확장 (일부 누락된 기능 보완) - Context7 MCP 베스트 프랙티스
const MockBlob = class extends Blob {
  constructor(parts: any[], options: any = {}) {
    super(parts, options);
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(8));
  }

  text(): Promise<string> {
    return Promise.resolve('mock-text');
  }

  stream(): ReadableStream {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        controller.close();
      },
    });
  }
};

vi.stubGlobal('Blob', MockBlob);

// Document 객체 모킹 - Context7 MCP 베스트 프랙티스
const mockDocument = {
  createElement: vi.fn((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      return new MockHTMLCanvasElement() as any;
    }
    if (tagName.toLowerCase() === 'img') {
      return new MockHTMLImageElement() as any;
    }
    // 기본 요소 모킹
    return {
      tagName: tagName.toUpperCase(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
      textContent: '',
      style: {},
    };
  }),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  head: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Context7 MCP 베스트 프랙티스: document는 기존 객체에 메서드 spyOn 사용
if (typeof document !== 'undefined') {
  // 기존 document 객체에 필요한 메서드들을 spyOn으로 모킹
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas as any;
    }
    if (tagName === 'img') {
      return new MockHTMLImageElement() as any;
    }
    return mockDocument.createElement(tagName);
  });

  if (document.body) {
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockDocument.body.appendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockDocument.body.removeChild);
  }

  if (document.head) {
    vi.spyOn(document.head, 'appendChild').mockImplementation(mockDocument.head.appendChild);
    vi.spyOn(document.head, 'removeChild').mockImplementation(mockDocument.head.removeChild);
  }
} else {
  // document가 없는 환경에서는 stubGlobal 사용
  vi.stubGlobal('document', mockDocument);
}

// Window 객체 모킹 - Context7 MCP 베스트 프랙티스
const mockWindow = {
  document: mockDocument,
  location: {
    href: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    origin: 'http://localhost:3000',
  },
  navigator: {
    userAgent: 'Node.js Test Environment',
    language: 'en-US',
    platform: 'node',
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  URL: mockURL,
  Image: MockHTMLImageElement,
  HTMLCanvasElement: MockHTMLCanvasElement,
  HTMLImageElement: MockHTMLImageElement,
  FileReader: vi.fn(),
  Blob: MockBlob,
  performance: globalThis.performance || { now: () => Date.now() },
  requestAnimationFrame: vi.fn(),
  cancelAnimationFrame: vi.fn(),
};

// Context7 MCP 베스트 프랙티스: 이미 존재하는 window는 안전하게 처리
try {
  vi.stubGlobal('window', mockWindow);
} catch (error) {
  // window가 이미 정의된 경우 document를 제외한 속성들만 대체
  const { document, ...windowPropsWithoutDocument } = mockWindow;
  Object.assign(globalThis.window || globalThis, windowPropsWithoutDocument);
}

// Console 경고 억제 (테스트 환경)
const originalWarn = console.warn;
console.warn = vi.fn((...args) => {
  // Canvas 관련 경고는 무시
  if (args.some((arg) => typeof arg === 'string' && (arg.includes('canvas') || arg.includes('Canvas')))) {
    return;
  }
  originalWarn(...args);
});

// 테스트 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

// ImageData, OffscreenCanvas, ResizeObserver 모킹 - Context7 MCP 베스트 프랙티스
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(dataOrWidth: Uint8ClampedArray | number, width?: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      // new ImageData(width, height) 형태
      this.width = dataOrWidth;
      this.height = width!;
      this.data = new Uint8ClampedArray(dataOrWidth * width! * 4); // RGBA
    } else {
      // new ImageData(data, width, height?) 형태
      this.data = dataOrWidth;
      this.width = width!;
      this.height = height !== undefined ? height : dataOrWidth.length / (width! * 4);
    }
  }
}

vi.stubGlobal('ImageData', MockImageData);

const MockOffscreenCanvas = vi.fn(() => ({
  width: 100,
  height: 100,
  getContext: vi.fn(() => mockCanvas.getContext()),
  convertToBlob: vi.fn(() => Promise.resolve(new Blob(['mock'], { type: 'image/png' }))),
}));

vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);

const MockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// 테스트 유틸리티 함수들
/**
 * 모킹된 Canvas context 가져오기
 */
export function getMockCanvasContext() {
  return mockCanvas.getContext();
}

/**
 * 모킹된 Image 객체 생성 (테스트용)
 */
export function createMockImage(options: Partial<HTMLImageElement> = {}) {
  const img = new Image() as any;
  Object.assign(img, {
    width: 100,
    height: 100,
    naturalWidth: 100,
    naturalHeight: 100,
    complete: true,
    ...options,
  });
  return img;
}

/**
 * 모킹된 Blob 생성 (테스트용)
 */
export function createMockBlob(size = 1024, type = 'image/png') {
  return new Blob([new ArrayBuffer(size)], { type });
}

/**
 * 모킹 상태 초기화 (각 테스트 전에 호출)
 */
export function resetMocks() {
  vi.clearAllMocks();
  // Canvas 크기 초기화
  mockCanvas.width = 100;
  mockCanvas.height = 100;

  // URL 모킹 초기화 - Context7 MCP 베스트 프랙티스
  if (mockURL.createObjectURL && vi.isMockFunction(mockURL.createObjectURL)) {
    mockURL.createObjectURL.mockImplementation((blob: any) => {
      if (blob instanceof Blob) {
        if (blob.type.includes('svg')) {
          return 'blob:mock-svg-url';
        }
        // 빈 Blob이거나 명시적으로 잘못된 타입만 에러 URL 생성
        if (blob.size === 0 || (blob.type === 'application/json' && blob.size === 0)) {
          return 'blob:mock-error-url';
        }
        // ArrayBuffer/Uint8Array에서 변환된 이미지 Blob들은 성공적으로 처리
        if (blob.type.startsWith('image/') && blob.size > 0) {
          return 'blob:mock-image-url';
        }
        return 'blob:mock-image-url';
      }
      return 'blob:mock-object-url';
    });
  }
}

// CanvasPool 모킹
vi.mock('../../src/base/canvas-pool', () => ({
  CanvasPool: {
    getInstance: () => ({
      acquire: (width: number = 100, height: number = 100) => {
        const canvas = new MockHTMLCanvasElement() as any;
        canvas.width = width;
        canvas.height = height;

        // getContext에서 올바른 크기 정보를 반환하도록 수정
        const originalGetContext = canvas.getContext;
        canvas.getContext = vi.fn(() => {
          const ctx = originalGetContext();
          // Context에서 캔버스 크기 정보를 반영
          Object.defineProperty(ctx, 'canvas', {
            value: { width, height },
            writable: false,
          });
          return ctx;
        });

        return canvas;
      },
      release: vi.fn(),
      getStats: () => ({
        totalCreated: 1,
        totalAcquired: 1,
        totalReleased: 0,
        poolHits: 0,
        memoryOptimizations: 0,
      }),
      clear: vi.fn(),
    }),
  },
}));

// DOMParser 모킹 (SVG 호환성 처리를 위해 필요)
class MockDOMParser {
  parseFromString(source: string, mimeType: string): Document {
    // 테스트 컨텍스트 저장
    (globalThis as any).__svgTestContext = { originalSvg: source };
    // 기본 Document 구조 생성
    const doc = {
      documentElement: null as any,
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    };

    // XML 파싱 에러 확인
    if (!source || typeof source !== 'string') {
      // 파싱 에러 요소 생성
      const parseError = {
        tagName: 'parsererror',
        textContent: 'Invalid XML',
      };
      doc.querySelector = vi.fn((selector: string) => {
        if (selector === 'parsererror') return parseError;
        return null;
      });
      return doc as any;
    }

    // SVG 문자열 파싱
    if (mimeType === 'image/svg+xml' || mimeType === 'application/xml') {
      // 기본적인 SVG 구조 확인
      if (source.includes('<svg')) {
        // Mock SVG 요소 생성
        const svgElement = {
          tagName: 'svg',
          getAttribute: vi.fn((name: string) => {
            // 속성별 기본값 반환
            if (name === 'xmlns') return source.includes('xmlns=') ? 'http://www.w3.org/2000/svg' : null;
            if (name === 'xmlns:xlink') return source.includes('xmlns:xlink=') ? 'http://www.w3.org/1999/xlink' : null;
            if (name === 'width') {
              const match = source.match(/width=["']([^"']+)["']/);
              return match ? match[1] : null;
            }
            if (name === 'height') {
              const match = source.match(/height=["']([^"']+)["']/);
              return match ? match[1] : null;
            }
            if (name === 'viewBox') {
              const match = source.match(/viewBox=["']([^"']+)["']/);
              return match ? match[1] : null;
            }
            if (name === 'preserveAspectRatio') {
              const match = source.match(/preserveAspectRatio=["']([^"']+)["']/);
              return match ? match[1] : null;
            }
            if (name === 'style') {
              const match = source.match(/style=["']([^"']+)["']/);
              return match ? match[1] : null;
            }
            return null;
          }),
          setAttribute: vi.fn(),
          hasAttribute: vi.fn((name: string) => {
            return source.includes(`${name}=`);
          }),
          removeAttribute: vi.fn(),
          querySelector: vi.fn((selector: string) => {
            // xlink:href 요소 검색
            if (selector === '[xlink\\:href]') {
              return source.includes('xlink:href') ? { getAttribute: vi.fn(() => '#test') } : null;
            }
            // 기타 요소들
            if (selector.includes('rect')) return source.includes('<rect') ? {} : null;
            if (selector.includes('circle')) return source.includes('<circle') ? {} : null;
            if (selector.includes('ellipse')) return source.includes('<ellipse') ? {} : null;
            if (selector.includes('line')) return source.includes('<line') ? {} : null;
            return null;
          }),
          querySelectorAll: vi.fn((selector: string) => {
            const elements: any[] = [];

            // xlink:href 요소들
            if (selector === '[xlink\\:href]') {
              if (source.includes('xlink:href')) {
                const element = {
                  _attributes: new Map([['xlink:href', '#icon']]),
                  getAttribute: vi.fn((attr: string) => {
                    return element._attributes.get(attr) || null;
                  }),
                  setAttribute: vi.fn((attr: string, value: string) => {
                    element._attributes.set(attr, value);
                  }),
                  removeAttribute: vi.fn((attr: string) => {
                    element._attributes.delete(attr);
                  }),
                };
                elements.push(element);
              }
            }

            // 기하학적 요소들
            if (selector === 'rect') {
              const rectMatches = source.match(/<rect[^>]*>/g);
              if (rectMatches) {
                rectMatches.forEach(() => {
                  elements.push({
                    getAttribute: vi.fn((attr: string) => {
                      if (attr === 'x') return '10';
                      if (attr === 'y') return '10';
                      if (attr === 'width') return '50';
                      if (attr === 'height') return '50';
                      return '0';
                    }),
                  });
                });
              }
            }

            if (selector === 'circle') {
              const circleMatches = source.match(/<circle[^>]*>/g);
              if (circleMatches) {
                circleMatches.forEach(() => {
                  elements.push({
                    getAttribute: vi.fn((attr: string) => {
                      if (attr === 'cx') return '25';
                      if (attr === 'cy') return '25';
                      if (attr === 'r') return '20';
                      return '0';
                    }),
                  });
                });
              }
            }

            // forEach 메서드 추가
            elements.forEach = Array.prototype.forEach.bind(elements);
            return elements;
          }),
        };

        doc.documentElement = svgElement;
        doc.querySelector = vi.fn((selector: string) => {
          if (selector === 'svg') return svgElement;
          if (selector === 'parsererror') return null;
          return svgElement.querySelector(selector);
        });
        doc.querySelectorAll = svgElement.querySelectorAll;
      } else {
        // SVG가 아닌 경우 파싱 에러
        const parseError = {
          tagName: 'parsererror',
          textContent: 'Root element is not <svg>',
        };
        doc.querySelector = vi.fn((selector: string) => {
          if (selector === 'parsererror') return parseError;
          return null;
        });
      }
    }

    return doc as any;
  }
}

// XMLSerializer 모킹
class MockXMLSerializer {
  serializeToString(node: any): string {
    if (!node || !node.documentElement) {
      return '';
    }

    const element = node.documentElement;

    // SVG 요소 직렬화
    if (element.tagName === 'svg') {
      const attributes: string[] = [];

      // setAttribute 호출 기록에서 속성들 수집
      const mockSetAttribute = element.setAttribute;
      if (vi.isMockFunction(mockSetAttribute)) {
        const calls = mockSetAttribute.mock.calls;
        calls.forEach((call: any) => {
          const [name, value] = call as [string, string];
          // 중복 속성 방지
          if (!attributes.some((attr) => attr.startsWith(`${name}=`))) {
            attributes.push(`${name}="${value}"`);
          }
        });
      }

      // 기존 속성들 체크 (getAttribute 기반)
      const mockGetAttribute = element.getAttribute;
      if (vi.isMockFunction(mockGetAttribute)) {
        // 이미 설정된 속성들이 있다면 포함
        ['xmlns', 'xmlns:xlink', 'width', 'height', 'viewBox', 'preserveAspectRatio'].forEach((attrName) => {
          const value = (mockGetAttribute as any)(attrName);
          if (value && !attributes.some((attr) => attr.startsWith(`${attrName}=`))) {
            attributes.push(`${attrName}="${value}"`);
          }
        });
      }

      // 내부 요소 결정 - 실제 modernizeSyntax 실행 여부를 동적으로 판단
      let innerContent = '';
      const globalContext = (globalThis as any).__svgTestContext;

      if (globalContext?.originalSvg?.includes('xlink:href')) {
        // modernizeSyntax가 실제로 실행되었는지 확인
        // 방법: querySelectorAll이 실제로 호출되고, 반환된 요소들에서 DOM 조작이 이루어졌는지 확인
        const querySelectorAllMock = element.querySelectorAll;

        if (vi.isMockFunction(querySelectorAllMock)) {
          // '[xlink\\:href]' 선택자로 호출되었는지 확인
          const xlinkCalls = querySelectorAllMock.mock.calls.filter((call: any) => {
            const [selector] = call as [string];
            return selector === '[xlink\\:href]';
          });

          if (xlinkCalls.length > 0) {
            // modernizeSyntax 실행 시도됨
            const xlinkElements = (querySelectorAllMock as any)('[xlink\\:href]');

            if (xlinkElements && xlinkElements.length > 0) {
              const firstElement = xlinkElements[0];

              // DOM 조작이 실제로 이루어졌는지 확인
              const elementSetAttribute = firstElement.setAttribute;
              const elementRemoveAttribute = firstElement.removeAttribute;

              const modernizationApplied =
                vi.isMockFunction(elementSetAttribute) &&
                vi.isMockFunction(elementRemoveAttribute) &&
                elementSetAttribute.mock.calls.some((call: any) => {
                  const [name, value] = call as [string, string];
                  return name === 'href' && value === '#icon';
                }) &&
                elementRemoveAttribute.mock.calls.some((call: any) => {
                  const [name] = call as [string];
                  return name === 'xlink:href';
                });

              if (modernizationApplied) {
                // href로 변환됨
                innerContent = '<use href="#icon"/>';
              } else {
                // 변환되지 않음 (예: href가 이미 있었거나 다른 이유)
                innerContent = '<use xlink:href="#icon"/>';
              }
            } else {
              // xlink:href 요소를 찾지 못함
              innerContent = '<rect/>';
            }
          } else {
            // modernizeSyntax가 실행되지 않음
            innerContent = '<use xlink:href="#icon"/>';
          }
        } else {
          innerContent = '<use xlink:href="#icon"/>';
        }
      } else {
        innerContent = '<rect/>';
      }

      // 최종 SVG 구조 생성
      const attrString = attributes.length > 0 ? ' ' + attributes.join(' ') : '';
      return `<svg${attrString}>${innerContent}</svg>`;
    }

    return '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
  }
}

// DOMParser와 XMLSerializer 모킹 - Context7 MCP 베스트 프랙티스
vi.stubGlobal('DOMParser', MockDOMParser);
vi.stubGlobal('XMLSerializer', MockXMLSerializer);

// 모듈 스코프에서 초기 설정
console.log('WSL 환경 모킹 설정이 로드되었습니다.');
