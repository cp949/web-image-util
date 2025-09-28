import { describe, expect, test } from 'vitest';
import type {
  ImageFormat,
  ImageSource,
  OutputFormat,
  ResizeBackground,
  ResizeFit,
  ResizePosition,
} from '../../../src/types';
import { ImageErrorCodeConstants, ImageFormats, OutputFormats, ResizeFitConstants } from '../../../src/types';

/**
 * 기본 타입 정의 테스트
 *
 * @description WSL 환경에서 실행 가능한 타입 시스템 테스트
 * - 컴파일 타임 타입 안전성 검증
 * - 상수 정의 확인
 * - 타입 호환성 검증
 */
describe('기본 타입 정의', () => {
  describe('ImageFormat 타입', () => {
    test('모든 이미지 포맷이 타입에 포함되어야 함', () => {
      const formats: ImageFormat[] = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg', 'avif'];

      formats.forEach((format) => {
        expect(Object.values(ImageFormats)).toContain(format);
      });
    });

    test('ImageFormats 상수가 올바르게 정의되어야 함', () => {
      expect(ImageFormats.JPEG).toBe('jpeg');
      expect(ImageFormats.JPG).toBe('jpg');
      expect(ImageFormats.PNG).toBe('png');
      expect(ImageFormats.WEBP).toBe('webp');
      expect(ImageFormats.AVIF).toBe('avif');
      expect(ImageFormats.GIF).toBe('gif');
      expect(ImageFormats.SVG).toBe('svg');
    });
  });

  describe('OutputFormat 타입', () => {
    test('출력 가능한 포맷만 포함되어야 함', () => {
      const outputFormats: OutputFormat[] = ['jpeg', 'jpg', 'png', 'webp', 'avif'];

      outputFormats.forEach((format) => {
        expect(Object.values(OutputFormats)).toContain(format);
      });
    });

    test('SVG는 출력 포맷에서 제외되어야 함', () => {
      expect(Object.values(OutputFormats)).not.toContain('svg');
      expect(Object.values(OutputFormats)).not.toContain('gif');
    });

    test('OutputFormats 상수가 올바르게 정의되어야 함', () => {
      expect(OutputFormats.JPEG).toBe('jpeg');
      expect(OutputFormats.JPG).toBe('jpg');
      expect(OutputFormats.PNG).toBe('png');
      expect(OutputFormats.WEBP).toBe('webp');
      expect(OutputFormats.AVIF).toBe('avif');
    });
  });

  describe('ResizeFit 타입', () => {
    test('모든 리사이즈 모드가 정의되어야 함', () => {
      const fitModes: ResizeFit[] = ['cover', 'contain', 'fill', 'inside', 'outside'];

      fitModes.forEach((mode) => {
        expect(Object.values(ResizeFitConstants)).toContain(mode);
      });
    });

    test('ResizeFitConstants가 올바르게 정의되어야 함', () => {
      expect(ResizeFitConstants.COVER).toBe('cover');
      expect(ResizeFitConstants.CONTAIN).toBe('contain');
      expect(ResizeFitConstants.FILL).toBe('fill');
      expect(ResizeFitConstants.INSIDE).toBe('inside');
      expect(ResizeFitConstants.OUTSIDE).toBe('outside');
    });
  });

  describe('ResizePosition 타입', () => {
    test('문자열 위치 값들이 올바른 형식이어야 함', () => {
      const stringPositions = ['center', 'centre', 'top', 'bottom', 'left', 'right'];

      // 타입 검증 - 컴파일 시점에서 확인됨
      stringPositions.forEach((pos) => {
        const position: ResizePosition = pos as ResizePosition;
        expect(typeof position).toBe('string');
      });
    });

    test('객체 위치 값이 올바른 형식이어야 함', () => {
      const objectPosition: ResizePosition = { x: 50, y: 50 };
      expect(typeof objectPosition).toBe('object');
      expect(objectPosition).toHaveProperty('x');
      expect(objectPosition).toHaveProperty('y');
      expect(typeof objectPosition.x).toBe('number');
      expect(typeof objectPosition.y).toBe('number');
    });
  });

  describe('ResizeBackground 타입', () => {
    test('문자열 배경색 타입 검증', () => {
      // string 타입
      const colorString: ResizeBackground = '#ffffff';
      expect(typeof colorString).toBe('string');

      const namedColor: ResizeBackground = 'red';
      expect(typeof namedColor).toBe('string');

      const rgbaColor: ResizeBackground = 'rgba(255, 255, 255, 0.5)';
      expect(typeof rgbaColor).toBe('string');
    });

    test('RGBA 객체 배경색 타입 검증', () => {
      // RGBA 객체 타입
      const colorObject: ResizeBackground = {
        r: 255,
        g: 255,
        b: 255,
        alpha: 1,
      };
      expect(colorObject.r).toBe(255);
      expect(colorObject.g).toBe(255);
      expect(colorObject.b).toBe(255);
      expect(colorObject.alpha).toBe(1);

      // alpha는 선택적 속성
      const colorObjectWithoutAlpha: ResizeBackground = {
        r: 128,
        g: 128,
        b: 128,
      };
      expect(colorObjectWithoutAlpha.r).toBe(128);
      expect(colorObjectWithoutAlpha.alpha).toBeUndefined();
    });
  });

  describe('ImageErrorCodeType 타입', () => {
    test('모든 에러 코드가 정의되어야 함', () => {
      const errorCodes = Object.values(ImageErrorCodeConstants);

      // 필수 에러 코드들 확인
      expect(errorCodes).toContain('INVALID_SOURCE');
      expect(errorCodes).toContain('CANVAS_CREATION_FAILED');
      expect(errorCodes).toContain('OUTPUT_FAILED');
      expect(errorCodes).toContain('IMAGE_LOAD_FAILED');
      expect(errorCodes).toContain('PROCESSING_FAILED');

      expect(errorCodes.length).toBeGreaterThan(10);
    });

    test('에러 코드 상수가 올바르게 정의되어야 함', () => {
      // 주요 에러 코드들 확인
      expect(ImageErrorCodeConstants.INVALID_SOURCE).toBe('INVALID_SOURCE');
      expect(ImageErrorCodeConstants.CANVAS_CREATION_FAILED).toBe('CANVAS_CREATION_FAILED');
      expect(ImageErrorCodeConstants.OUTPUT_FAILED).toBe('OUTPUT_FAILED');
      expect(ImageErrorCodeConstants.PROCESSING_FAILED).toBe('PROCESSING_FAILED');
      expect(ImageErrorCodeConstants.MEMORY_ERROR).toBe('MEMORY_ERROR');
    });

    test('에러 코드가 중복되지 않아야 함', () => {
      const codes = Object.values(ImageErrorCodeConstants);
      const uniqueCodes = [...new Set(codes)];
      expect(codes.length).toBe(uniqueCodes.length);
    });
  });
});

describe('ImageSource 유니온 타입', () => {
  test('모든 가능한 소스 타입 확인', () => {
    // HTMLImageElement (모킹된 환경에서)
    const mockImg = new Image();
    const imgSource: ImageSource = mockImg;
    expect(imgSource).toBeDefined();

    // HTMLCanvasElement (모킹된 환경에서)
    const mockCanvas = document.createElement('canvas');
    const canvasSource: ImageSource = mockCanvas;
    expect(canvasSource).toBeDefined();

    // Blob
    const blobSource: ImageSource = new Blob();
    expect(blobSource).toBeDefined();

    // string (URL, DataURL, SVG)
    const urlSource: ImageSource = 'https://example.com/image.jpg';
    expect(typeof urlSource).toBe('string');

    const dataUrlSource: ImageSource = 'data:image/png;base64,iVBORw0KGgo...';
    expect(typeof dataUrlSource).toBe('string');

    const svgSource: ImageSource = '<svg>...</svg>';
    expect(typeof svgSource).toBe('string');

    // ArrayBuffer
    const bufferSource: ImageSource = new ArrayBuffer(8);
    expect(bufferSource instanceof ArrayBuffer).toBe(true);

    // Uint8Array
    const uint8Source: ImageSource = new Uint8Array(8);
    expect(uint8Source instanceof Uint8Array).toBe(true);
  });

  test('ImageSource 타입 호환성 검증', () => {
    // 각 타입이 ImageSource에 할당 가능한지 확인
    const sources: ImageSource[] = [
      new Image(),
      global.document?.createElement('canvas') || new global.HTMLCanvasElement(),
      new Blob(),
      new ArrayBuffer(8),
      new Uint8Array(8),
      'https://example.com/image.jpg',
      'data:image/png;base64,mock',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
      './local/path/image.png',
    ];

    sources.forEach((source, index) => {
      expect(source).toBeDefined();
      // 각 소스가 유효한 타입인지 확인
      expect(typeof source === 'object' || typeof source === 'string').toBe(true);
    });
  });
});

describe('타입 상수 불변성', () => {
  test('ImageFormats 상수가 올바르게 정의되어야 함', () => {
    // 타입스크립트 레벨에서의 상수 정의 확인
    expect(ImageFormats.JPEG).toBe('jpeg');
    expect(typeof ImageFormats.JPEG).toBe('string');
  });

  test('OutputFormats 상수가 올바르게 정의되어야 함', () => {
    // 타입스크립트 레벨에서의 상수 정의 확인
    expect(OutputFormats.PNG).toBe('png');
    expect(typeof OutputFormats.PNG).toBe('string');
  });

  test('ResizeFitConstants 상수가 올바르게 정의되어야 함', () => {
    // 타입스크립트 레벨에서의 상수 정의 확인
    expect(ResizeFitConstants.COVER).toBe('cover');
    expect(typeof ResizeFitConstants.COVER).toBe('string');
  });

  test('ImageErrorCodeConstants 상수가 올바르게 정의되어야 함', () => {
    // 타입스크립트 레벨에서의 상수 정의 확인
    expect(ImageErrorCodeConstants.INVALID_SOURCE).toBe('INVALID_SOURCE');
    expect(typeof ImageErrorCodeConstants.INVALID_SOURCE).toBe('string');
  });
});

describe('타입 추론 및 narrowing', () => {
  test('ImageFormat 타입 추론이 정확해야 함', () => {
    const format = 'jpeg' as const;
    const imageFormat: ImageFormat = format;
    expect(imageFormat).toBe('jpeg');
  });

  test('OutputFormat 타입 추론이 정확해야 함', () => {
    const format = 'png' as const;
    const outputFormat: OutputFormat = format;
    expect(outputFormat).toBe('png');
  });

  test('ResizeFit 타입 추론이 정확해야 함', () => {
    const fit = 'cover' as const;
    const resizeFit: ResizeFit = fit;
    expect(resizeFit).toBe('cover');
  });
});
