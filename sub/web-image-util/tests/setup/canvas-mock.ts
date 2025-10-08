/**
 * Canvas API Mock for Node.js test environment
 *
 * Replace with simple mock as happy-dom's Canvas API is incomplete
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
    // Generate realistic image data size based on canvas dimensions
    const width = this._width;
    const height = this._height;
    const pixelCount = width * height;

    // Apply approximate compression ratio based on image type
    let compressionRatio = 0.1; // Default (10%)
    const imageType = type || 'image/png';

    if (imageType.includes('jpeg') || imageType.includes('jpg')) {
      const q = quality || 0.92;
      compressionRatio = Math.max(0.05, q * 0.3); // JPEG: 5-30%
    } else if (imageType.includes('webp')) {
      const q = quality || 0.8;
      compressionRatio = Math.max(0.03, q * 0.2); // WebP: 3-20%
    } else {
      compressionRatio = 0.5; // PNG: ~50%
    }

    // Calculate size similar to actual images (4 bytes per pixel * compression ratio)
    const estimatedSize = Math.max(1000, Math.floor(pixelCount * 4 * compressionRatio));

    // PNG header + realistic size data
    const headerSize = 8;
    const dataSize = estimatedSize - headerSize;
    const buffer = new Uint8Array(estimatedSize);

    // PNG signature
    buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

    // Fill the rest with random data (simulate actual image data)
    for (let i = headerSize; i < estimatedSize; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }

    const blob = new Blob([buffer.buffer], { type: imageType });

    // Changed to synchronous execution (immediate execution in test environment)
    try {
      callback(blob);
    } catch (error) {
      console.error('Mock Canvas toBlob error:', error);
    }
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
    // Constructor does nothing
  }

  // src getter/setter
  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;

    // When src is set, immediately mark as loaded (synchronous execution)
    // Set size information for blob URLs or data URLs
    if (value.startsWith('blob:') || value.startsWith('data:')) {
      // Keep default size or use already set size
      if (!this.naturalWidth || this.naturalWidth === 0) this.naturalWidth = 100;
      if (!this.naturalHeight || this.naturalHeight === 0) this.naturalHeight = 100;
      this.width = this.naturalWidth;
      this.height = this.naturalHeight;
    }

    this.complete = true;

    // If onload callback is set, call it immediately
    const callback = this.onload;
    if (callback) {
      try {
        callback.call(this as any, new Event('load'));
      } catch (error) {
        console.error('Mock Image onload error:', error);
      }
    }
  }
}

// Global mock setup
// Set up prototype chain to make instanceof checks work
if (typeof HTMLCanvasElement === 'undefined') {
  // @ts-expect-error - global type extension
  global.HTMLCanvasElement = MockHTMLCanvasElement;
} else {
  // If HTMLCanvasElement already exists, set up Mock's prototype
  Object.setPrototypeOf(MockHTMLCanvasElement.prototype, HTMLCanvasElement.prototype);
}

if (typeof HTMLImageElement === 'undefined') {
  // @ts-expect-error - global type extension
  global.HTMLImageElement = MockHTMLImageElement;
  // @ts-expect-error - global type extension
  global.Image = MockHTMLImageElement;
} else {
  // If HTMLImageElement already exists, set up Mock's prototype
  Object.setPrototypeOf(MockHTMLImageElement.prototype, HTMLImageElement.prototype);
}

// document.createElement mock (Node.js environment support)
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
  // Create document mock in Node.js environment
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

// Additional global object mocks in Node.js environment
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis as any;
}

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

// FileReader mock for Node.js environment
if (typeof FileReader === 'undefined') {
  globalThis.FileReader = class MockFileReader {
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    onload: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onabort: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onloadstart: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onloadend: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onprogress: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    readyState: number = 0; // EMPTY

    readAsDataURL(blob: Blob) {
      this.readyState = 1; // LOADING

      // Mock data URL result based on blob type
      const type = blob.type || 'application/octet-stream';
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1 transparent PNG
      this.result = `data:${type};base64,${base64Data}`;
      this.readyState = 2; // DONE

      // Trigger onload event asynchronously
      setTimeout(() => {
        if (this.onload) {
          const event = new Event('load') as ProgressEvent;
          this.onload.call(this as any, event);
        }
      }, 0);
    }

    readAsArrayBuffer(blob: Blob) {
      this.readyState = 1; // LOADING

      // Mock ArrayBuffer result
      const buffer = new ArrayBuffer(blob.size);
      this.result = buffer;
      this.readyState = 2; // DONE

      setTimeout(() => {
        if (this.onload) {
          const event = new Event('load') as ProgressEvent;
          this.onload.call(this as any, event);
        }
      }, 0);
    }

    readAsText(blob: Blob) {
      this.readyState = 1; // LOADING
      this.result = 'mock text content';
      this.readyState = 2; // DONE

      setTimeout(() => {
        if (this.onload) {
          const event = new Event('load') as ProgressEvent;
          this.onload.call(this as any, event);
        }
      }, 0);
    }

    abort() {
      this.readyState = 2; // DONE
      if (this.onabort) {
        const event = new Event('abort') as ProgressEvent;
        this.onabort.call(this as any, event);
      }
    }

    addEventListener(type: string, listener: any) {
      if (type === 'load') this.onload = listener;
      else if (type === 'error') this.onerror = listener;
      else if (type === 'abort') this.onabort = listener;
    }

    removeEventListener() {
      // Mock implementation
    }

    dispatchEvent() {
      return true;
    }
  } as any;
}

// convertSvgToElement mock to bypass SVG processing
if (typeof window !== 'undefined') {
  // Bypass SVG processing in test environment as it causes timeouts
  const originalFetch = globalThis.fetch;

  // Flag for simple handling of specific SVG Data URLs
  (globalThis as any)._SVG_MOCK_MODE = true;
}

console.log('✅ Canvas mock setup completed (lightweight mock)');
