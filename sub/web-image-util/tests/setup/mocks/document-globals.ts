/**
 * document, window, DOMParser, XMLSerializer 등 DOM 글로벌 mock.
 *
 * @description Node 환경에서도 `document.createElement('canvas'|'img')`가 예측 가능한 mock을 반환하게 만든다.
 *   DOMParser / XMLSerializer는 최소 형태만 제공하며 실제 SVG 파싱은 보장하지 않는다.
 */

import { vi } from 'vitest';

import { MockHTMLCanvasElement } from './canvas-element';
import { MockHTMLImageElement } from './image-element';

// Node 테스트 환경에서도 document.createElement 동작을 예측 가능하게 만든다.
if (typeof document !== 'undefined') {
  const originalCreateElement = document.createElement.bind(document);

  document.createElement = vi.fn((tagName: string, options?: any) => {
    if (tagName === 'canvas') {
      const canvas = new MockHTMLCanvasElement();
      return canvas as unknown as HTMLCanvasElement;
    }
    if (tagName === 'img') {
      const img = new MockHTMLImageElement();
      return img as unknown as HTMLImageElement;
    }
    return originalCreateElement(tagName, options);
  }) as typeof document.createElement;
} else {
  // document가 없으면 최소한의 목을 직접 만든다.
  globalThis.document = {
    createElement: vi.fn((tagName: string) => {
      if (tagName === 'canvas') {
        return new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
      }
      if (tagName === 'img') {
        return new MockHTMLImageElement() as unknown as HTMLImageElement;
      }
      return {} as any;
    }),
    createElementNS: vi.fn((namespace: string, tagName: string) => {
      if (tagName === 'svg') {
        return {} as any;
      }
      return {} as any;
    }),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    importNode: vi.fn((node: any) => node),
  } as any;
}

// Node 환경에서 window가 비어 있으면 globalThis로 채운다.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis as any;
}

// SVG 처리에 사용되는 DOMParser/XMLSerializer 최소 구현. 실제 파싱은 보장하지 않는다.
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class MockDOMParser {
    parseFromString(str: string, type: string) {
      return {
        documentElement: {
          tagName: 'svg',
          getAttribute: vi.fn(),
          setAttribute: vi.fn(),
          hasAttribute: vi.fn(),
          querySelector: vi.fn(),
          querySelectorAll: vi.fn(() => []),
        },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
      } as any;
    }
  } as any;
}

if (typeof globalThis.XMLSerializer === 'undefined') {
  globalThis.XMLSerializer = class MockXMLSerializer {
    serializeToString(node: any) {
      return '<svg></svg>';
    }
  } as any;
}
