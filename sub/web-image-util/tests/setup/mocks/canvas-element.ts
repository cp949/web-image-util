/**
 * Canvas 관련 mock — HTMLCanvasElement와 CanvasRenderingContext2D.
 *
 * @description happy-dom이 비워 둔 Canvas 동작을 가볍게 보완한다. 픽셀 품질은 보장하지 않는다.
 */

// Canvas 2D 컨텍스트 목이다.
export class MockCanvasRenderingContext2D {
  canvas: any;
  fillStyle: string = '#000000';
  strokeStyle: string = '#000000';
  globalAlpha: number = 1;
  globalCompositeOperation: string = 'source-over';
  imageSmoothingEnabled: boolean = true;
  imageSmoothingQuality: 'low' | 'medium' | 'high' = 'high';
  lineWidth: number = 1;
  filter: string = 'none';
  font: string = '10px sans-serif';
  textBaseline: string = 'alphabetic';
  textAlign: string = 'start';
  shadowColor: string = 'rgba(0,0,0,0)';
  shadowOffsetX: number = 0;
  shadowOffsetY: number = 0;
  shadowBlur: number = 0;

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
  measureText(text: string) {
    // 글자당 8px로 근사한다
    return { width: text.length * 8 };
  }
  fillText(text: string, x: number, y: number, maxWidth?: number) {}
  strokeText(text: string, x: number, y: number, maxWidth?: number) {}
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return { addColorStop: (_offset: number, _color: string) => {} } as unknown as CanvasGradient;
  }
}

// HTMLCanvasElement 목이다.
export class MockHTMLCanvasElement {
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
    // 캔버스 크기를 바탕으로 대략적인 이미지 크기를 계산한다.
    const width = this._width;
    const height = this._height;
    const pixelCount = width * height;

    // 포맷별 대략적인 압축률을 적용한다.
    let compressionRatio = 0.1; // 기본값 10%
    const imageType = type || 'image/png';

    if (imageType.includes('jpeg') || imageType.includes('jpg')) {
      const q = quality || 0.92;
      compressionRatio = Math.max(0.05, q * 0.3); // JPEG는 대략 5~30%
    } else if (imageType.includes('webp')) {
      const q = quality || 0.8;
      compressionRatio = Math.max(0.03, q * 0.2); // WebP는 대략 3~20%
    } else {
      compressionRatio = 0.5; // PNG는 대략 50%
    }

    // 픽셀 수와 압축률을 바탕으로 실제와 비슷한 크기를 만든다.
    const estimatedSize = Math.max(1000, Math.floor(pixelCount * 4 * compressionRatio));

    // PNG 시그니처만 채우고 나머지는 단순 payload로 둔다.
    const buffer = new Uint8Array(estimatedSize);

    // PNG 시그니처
    buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

    // 큰 목 이미지를 만들 때 시간을 쓰지 않도록 payload는 0으로 둔다.

    const blob = new Blob([buffer.buffer], { type: imageType });

    // 테스트 환경에서는 콜백을 즉시 실행한다.
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

// instanceof 검사가 동작하도록 전역 HTMLCanvasElement 프로토타입을 맞춘다.
if (typeof HTMLCanvasElement === 'undefined') {
  // @ts-expect-error - 전역 타입 확장
  global.HTMLCanvasElement = MockHTMLCanvasElement;
} else {
  // 기존 전역이 있으면 목 프로토타입만 이어 붙인다.
  Object.setPrototypeOf(MockHTMLCanvasElement.prototype, HTMLCanvasElement.prototype);
}
