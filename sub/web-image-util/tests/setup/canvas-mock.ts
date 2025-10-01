/**
 * Canvas API Mock for Node.js 테스트 환경
 *
 * happy-dom의 Canvas API가 불완전하므로 간단한 mock으로 대체
 */

import { vi } from 'vitest';

// Mock Canvas 2D Context
class MockCanvasRenderingContext2D {
  canvas: any;
  fillStyle: string = '#000000';
  strokeStyle: string = '#000000';
  globalAlpha: number = 1;
  globalCompositeOperation: string = 'source-over';
  imageSmoothingEnabled: boolean = true;
  imageSmoothingQuality: 'low' | 'medium' | 'high' = 'high';
  lineWidth: number = 1;
  filter: string = 'none';

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  clearRect(x: number, y: number, width: number, height: number) {}
  fillRect(x: number, y: number, width: number, height: number) {}
  strokeRect(x: number, y: number, width: number, height: number) {}
  drawImage(...args: any[]) {}
  getImageData(sx: number, sy: number, sw: number, sh: number) {
    return {
      data: new Uint8ClampedArray(sw * sh * 4),
      width: sw,
      height: sh,
    };
  }
  putImageData(imageData: any, dx: number, dy: number) {}
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {}
  save() {}
  restore() {}
  scale(x: number, y: number) {}
  rotate(angle: number) {}
  translate(x: number, y: number) {}
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {}
  beginPath() {}
  closePath() {}
  moveTo(x: number, y: number) {}
  lineTo(x: number, y: number) {}
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) {}
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {}
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {}
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {}
  rect(x: number, y: number, width: number, height: number) {}
  fill() {}
  stroke() {}
  clip() {}
  isPointInPath(x: number, y: number) {
    return false;
  }
}

// Mock HTMLCanvasElement
class MockHTMLCanvasElement {
  private _width: number = 300;
  private _height: number = 150;
  private _context: MockCanvasRenderingContext2D | null = null;

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
  }

  getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId === '2d') {
      if (!this._context) {
        this._context = new MockCanvasRenderingContext2D(this);
      }
      return this._context;
    }
    return null;
  }

  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number) {
    // 실제 Blob과 유사하게 동작하는 mock
    // ArrayBuffer를 사용하여 실제 바이너리 데이터처럼 보이게 함
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG 시그니처
    const blob = new Blob([buffer.buffer], { type: type || 'image/png' });

    // queueMicrotask를 사용하여 비동기 동작
    queueMicrotask(() => {
      try {
        callback(blob);
      } catch (error) {
        console.error('Mock Canvas toBlob error:', error);
      }
    });
  }

  toDataURL(type?: string, quality?: number): string {
    return 'data:image/png;base64,mock-canvas-data';
  }
}

// Mock HTMLImageElement
class MockHTMLImageElement {
  private _src: string = '';
  width: number = 100;
  height: number = 100;
  naturalWidth: number = 100;
  naturalHeight: number = 100;
  complete: boolean = false;
  onload: ((this: HTMLImageElement, ev: Event) => any) | null = null;
  onerror: ((this: HTMLImageElement, ev: Event) => any) | null = null;

  constructor() {
    // 생성자에서는 아무것도 하지 않음
  }

  // src getter/setter
  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;

    // src가 설정되면 즉시 로드 완료 처리
    // queueMicrotask를 사용하여 비동기적으로 onload 호출
    queueMicrotask(() => {
      // blob URL이나 data URL인 경우 크기 정보 설정
      if (value.startsWith('blob:') || value.startsWith('data:')) {
        // 기본 크기 유지 또는 이미 설정된 크기 사용
        if (!this.naturalWidth || this.naturalWidth === 0) this.naturalWidth = 100;
        if (!this.naturalHeight || this.naturalHeight === 0) this.naturalHeight = 100;
        this.width = this.naturalWidth;
        this.height = this.naturalHeight;
      }

      this.complete = true;

      // onload 콜백이 설정된 경우 호출
      const callback = this.onload;
      if (callback) {
        try {
          callback.call(this, new Event('load'));
        } catch (error) {
          console.error('Mock Image onload error:', error);
        }
      }
    });
  }
}

// Global mock 설정
// 프로토타입 체인을 설정하여 instanceof 검사가 작동하도록 함
if (typeof HTMLCanvasElement === 'undefined') {
  // @ts-expect-error - global 타입 확장
  global.HTMLCanvasElement = MockHTMLCanvasElement;
} else {
  // HTMLCanvasElement가 이미 있으면 Mock의 프로토타입을 설정
  Object.setPrototypeOf(MockHTMLCanvasElement.prototype, HTMLCanvasElement.prototype);
}

if (typeof HTMLImageElement === 'undefined') {
  // @ts-expect-error - global 타입 확장
  global.HTMLImageElement = MockHTMLImageElement;
  // @ts-expect-error - global 타입 확장
  global.Image = MockHTMLImageElement;
} else {
  // HTMLImageElement가 이미 있으면 Mock의 프로토타입을 설정
  Object.setPrototypeOf(MockHTMLImageElement.prototype, HTMLImageElement.prototype);
}

// document.createElement mock
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

// URL.createObjectURL / revokeObjectURL mock
if (typeof URL !== 'undefined') {
  const blobUrls = new Map<string, Blob>();
  let urlCounter = 0;

  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:mock-${urlCounter++}`;
    if (blob instanceof Blob) {
      blobUrls.set(url, blob);
    }
    return url;
  }) as typeof URL.createObjectURL;

  URL.revokeObjectURL = vi.fn((url: string) => {
    blobUrls.delete(url);
  }) as typeof URL.revokeObjectURL;
}

console.log('✅ Canvas mock setup completed (lightweight mock)');
