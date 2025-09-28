import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  SimpleWatermark,
  type PresetTextStyle,
  type SimpleImageWatermarkOptions,
  type SimplePosition,
  type SimpleTextWatermarkOptions,
} from '../../../src/composition/simple-watermark';

// 모킹된 모듈들을 import (실제로는 모킹된 버전이 사용됨)
import { ImageWatermark } from '../../../src/composition/image-watermark';
import { TextWatermark } from '../../../src/composition/text-watermark';

// Canvas 및 브라우저 API 모킹
const mockCanvas2DContext = {
  canvas: { width: 800, height: 600 },
  font: '16px Arial',
  fillStyle: '#000000',
  strokeStyle: '#000000',
  globalAlpha: 1,
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  globalCompositeOperation: 'source-over' as GlobalCompositeOperation,

  fillText: vi.fn(),
  strokeText: vi.fn(),
  drawImage: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 }) as TextMetrics),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  setTransform: vi.fn(),
  clearRect: vi.fn(),
};

vi.stubGlobal(
  'HTMLCanvasElement',
  class MockHTMLCanvasElement {
    width = 800;
    height = 600;
    getContext = vi.fn(() => mockCanvas2DContext);
  }
);

// TextWatermark와 ImageWatermark 모킹
vi.mock('../../../src/composition/text-watermark', () => ({
  TextWatermark: {
    addToCanvas: vi.fn((canvas, options) => {
      // 텍스트 워터마크 적용 시뮬레이션
      const ctx = canvas.getContext('2d');
      ctx?.fillText(options.text || 'Mock Text', 10, 10);
      return canvas;
    }),
  },
}));

vi.mock('../../../src/composition/image-watermark', () => ({
  ImageWatermark: {
    addToCanvas: vi.fn((canvas, options) => {
      // 이미지 워터마크 적용 시뮬레이션
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(options.watermarkImage, 10, 10, 50, 50);
      return canvas;
    }),
    addWithAdaptiveSize: vi.fn((canvas, options) => {
      // 적응형 크기 이미지 워터마크 시뮬레이션
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(options.watermarkImage, 10, 10, 100, 100);
      return canvas;
    }),
  },
}));

describe('워터마크 기능 계약 테스트', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockImage: HTMLImageElement;

  beforeEach(() => {
    mockCanvas = new (globalThis.HTMLCanvasElement as any)();
    mockImage = {
      width: 200,
      height: 100,
      src: 'test-logo.png',
      complete: true,
    } as HTMLImageElement;

    vi.clearAllMocks();
  });

  describe('타입 시스템 검증', () => {
    test('SimplePosition 타입 값들', () => {
      const positions: SimplePosition[] = [
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ];

      positions.forEach((position) => {
        expect(typeof position).toBe('string');
      });
    });

    test('PresetTextStyle 타입 값들', () => {
      const styles: PresetTextStyle[] = [
        'default',
        'white-shadow',
        'black-shadow',
        'bold-white',
        'bold-black',
        'outline',
        'subtle',
      ];

      styles.forEach((style) => {
        expect(typeof style).toBe('string');
      });
    });

    test('SimpleTextWatermarkOptions 인터페이스 구조', () => {
      const validOptions: SimpleTextWatermarkOptions = {
        text: '© 2024 Company',
        position: 'bottom-right',
        style: 'white-shadow',
        size: 'medium',
        opacity: 0.8,
        rotation: 15,
        margin: { x: 20, y: 20 },
      };

      expect(validOptions.text).toBe('© 2024 Company');
      expect(validOptions.position).toBe('bottom-right');
      expect(validOptions.style).toBe('white-shadow');
      expect(typeof validOptions.opacity).toBe('number');
    });

    test('SimpleImageWatermarkOptions 인터페이스 구조', () => {
      const validOptions: SimpleImageWatermarkOptions = {
        image: mockImage,
        position: 'top-left',
        size: 'large',
        opacity: 0.6,
        rotation: 45,
        blendMode: 'multiply',
      };

      expect(validOptions.image).toBe(mockImage);
      expect(validOptions.position).toBe('top-left');
      expect(validOptions.blendMode).toBe('multiply');
    });
  });

  describe('SimpleWatermark 클래스 기본 기능', () => {
    test('addText 메서드 존재 및 타입', () => {
      expect(typeof SimpleWatermark.addText).toBe('function');
    });

    test('addImage 메서드 존재 및 타입', () => {
      expect(typeof SimpleWatermark.addImage).toBe('function');
    });

    test('addLogo 메서드 존재 및 타입', () => {
      expect(typeof SimpleWatermark.addLogo).toBe('function');
    });

    test('addCopyright 메서드 존재 및 타입', () => {
      expect(typeof SimpleWatermark.addCopyright).toBe('function');
    });
  });

  describe('텍스트 워터마크 기능', () => {
    test('기본 텍스트 워터마크 추가', () => {
      const options: SimpleTextWatermarkOptions = {
        text: '© 2024 Test Company',
      };

      const result = SimpleWatermark.addText(mockCanvas, options);

      expect(result).toBe(mockCanvas);
      expect(result).toBeInstanceOf(globalThis.HTMLCanvasElement);

      // TextWatermark.addToCanvas가 호출되었는지 확인
      expect(TextWatermark.addToCanvas).toHaveBeenCalledWith(
        mockCanvas,
        expect.objectContaining({
          text: '© 2024 Test Company',
        })
      );
    });

    test('모든 위치 옵션 테스트', () => {
      const positions: SimplePosition[] = [
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ];

      positions.forEach((position) => {
        const options: SimpleTextWatermarkOptions = {
          text: `Test ${position}`,
          position,
        };

        const result = SimpleWatermark.addText(mockCanvas, options);
        expect(result).toBe(mockCanvas);
      });
    });

    test('다양한 텍스트 스타일 적용', () => {
      const styles: PresetTextStyle[] = [
        'default',
        'white-shadow',
        'black-shadow',
        'bold-white',
        'bold-black',
        'outline',
        'subtle',
      ];

      styles.forEach((style) => {
        const options: SimpleTextWatermarkOptions = {
          text: 'Style Test',
          style,
        };

        const result = SimpleWatermark.addText(mockCanvas, options);
        expect(result).toBe(mockCanvas);
      });
    });

    test('크기 옵션 (문자열 및 숫자)', () => {
      const sizeOptions = ['small', 'medium', 'large', 24] as const;

      sizeOptions.forEach((size) => {
        const options: SimpleTextWatermarkOptions = {
          text: 'Size Test',
          size,
        };

        const result = SimpleWatermark.addText(mockCanvas, options);
        expect(result).toBe(mockCanvas);
      });
    });

    test('투명도 및 회전 옵션', () => {
      const options: SimpleTextWatermarkOptions = {
        text: 'Opacity & Rotation Test',
        opacity: 0.5,
        rotation: 45,
      };

      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('마진 옵션', () => {
      const options: SimpleTextWatermarkOptions = {
        text: 'Margin Test',
        margin: { x: 30, y: 40 },
      };

      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('모든 옵션을 포함한 복합 텍스트 워터마크', () => {
      const options: SimpleTextWatermarkOptions = {
        text: '© 2024 Full Options Test',
        position: 'center',
        style: 'outline',
        size: 'large',
        opacity: 0.7,
        rotation: 30,
        margin: { x: 25, y: 25 },
      };

      const result = SimpleWatermark.addText(mockCanvas, options);

      expect(result).toBe(mockCanvas);

      expect(TextWatermark.addToCanvas).toHaveBeenCalledWith(
        mockCanvas,
        expect.objectContaining({
          text: '© 2024 Full Options Test',
          rotation: 30,
          margin: { x: 25, y: 25 },
        })
      );
    });
  });

  describe('이미지 워터마크 기능', () => {
    test('기본 이미지 워터마크 추가', () => {
      const options: SimpleImageWatermarkOptions = {
        image: mockImage,
      };

      const result = SimpleWatermark.addImage(mockCanvas, options);

      expect(result).toBe(mockCanvas);
      expect(result).toBeInstanceOf(globalThis.HTMLCanvasElement);

      // ImageWatermark.addToCanvas가 호출되었는지 확인
      expect(ImageWatermark.addToCanvas).toHaveBeenCalledWith(
        mockCanvas,
        expect.objectContaining({
          watermarkImage: mockImage,
        })
      );
    });

    test('이미지 워터마크 위치 옵션', () => {
      const positions: SimplePosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

      positions.forEach((position) => {
        const options: SimpleImageWatermarkOptions = {
          image: mockImage,
          position,
        };

        const result = SimpleWatermark.addImage(mockCanvas, options);
        expect(result).toBe(mockCanvas);
      });
    });

    test('이미지 크기 옵션', () => {
      const sizeOptions = ['small', 'medium', 'large', 0.5] as const;

      sizeOptions.forEach((size) => {
        const options: SimpleImageWatermarkOptions = {
          image: mockImage,
          size,
        };

        const result = SimpleWatermark.addImage(mockCanvas, options);
        expect(result).toBe(mockCanvas);
      });
    });

    test('블렌드 모드 옵션', () => {
      const blendModes = ['normal', 'multiply', 'overlay', 'soft-light'] as const;

      blendModes.forEach((blendMode) => {
        const options: SimpleImageWatermarkOptions = {
          image: mockImage,
          blendMode,
        };

        const result = SimpleWatermark.addImage(mockCanvas, options);
        expect(result).toBe(mockCanvas);
      });
    });

    test('투명도 및 회전 옵션', () => {
      const options: SimpleImageWatermarkOptions = {
        image: mockImage,
        opacity: 0.4,
        rotation: 90,
      };

      const result = SimpleWatermark.addImage(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('모든 옵션을 포함한 복합 이미지 워터마크', () => {
      const options: SimpleImageWatermarkOptions = {
        image: mockImage,
        position: 'top-right',
        size: 'large',
        opacity: 0.6,
        rotation: 15,
        blendMode: 'overlay',
      };

      const result = SimpleWatermark.addImage(mockCanvas, options);

      expect(result).toBe(mockCanvas);

      expect(ImageWatermark.addToCanvas).toHaveBeenCalledWith(
        mockCanvas,
        expect.objectContaining({
          watermarkImage: mockImage,
          opacity: 0.6,
          rotation: 15,
        })
      );
    });
  });

  describe('편의 메서드 기능', () => {
    test('addLogo 메서드', () => {
      const result = SimpleWatermark.addLogo(mockCanvas, mockImage);

      expect(result).toBe(mockCanvas);

      // addWithAdaptiveSize가 호출되었는지 확인
      expect(ImageWatermark.addWithAdaptiveSize).toHaveBeenCalledWith(
        mockCanvas,
        expect.objectContaining({
          watermarkImage: mockImage,
        })
      );
    });

    test('addLogo 메서드 옵션 포함', () => {
      const options = {
        position: 'top-left' as SimplePosition,
        maxSize: 0.2,
        opacity: 0.8,
      };

      const result = SimpleWatermark.addLogo(mockCanvas, mockImage, options);

      expect(result).toBe(mockCanvas);

      expect(ImageWatermark.addWithAdaptiveSize).toHaveBeenCalledWith(
        mockCanvas,
        expect.objectContaining({
          watermarkImage: mockImage,
          maxWidthPercent: 0.2,
          maxHeightPercent: 0.2,
          opacity: 0.8,
        })
      );
    });

    test('addCopyright 메서드', () => {
      const copyrightText = '© 2024 My Company Ltd.';

      const result = SimpleWatermark.addCopyright(mockCanvas, copyrightText);

      expect(result).toBe(mockCanvas);

      // addText가 호출되었는지 확인 (내부적으로)
      expect(TextWatermark.addToCanvas).toHaveBeenCalled();
    });

    test('addCopyright 메서드 스타일 옵션', () => {
      const copyrightText = '© 2024 Test Corp';
      const styles = ['light', 'dark', 'outline'] as const;

      styles.forEach((style) => {
        const options = {
          position: 'bottom-center' as SimplePosition,
          style,
        };

        const result = SimpleWatermark.addCopyright(mockCanvas, copyrightText, options);
        expect(result).toBe(mockCanvas);
      });
    });
  });

  describe('에러 처리 및 edge cases', () => {
    test('빈 텍스트로 워터마크 추가', () => {
      const options: SimpleTextWatermarkOptions = {
        text: '',
      };

      // 빈 텍스트도 정상적으로 처리되어야 함
      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('null/undefined 이미지로 워터마크 추가', () => {
      const options: SimpleImageWatermarkOptions = {
        image: null as any,
      };

      // Context7 베스트 프랙티스: 실제 구현에서는 null 체크가 필요한 경우 에러 발생
      expect(() => {
        SimpleWatermark.addImage(mockCanvas, options);
      }).toThrow(); // null 이미지 처리 시 에러 발생이 정상적 동작
    });

    test('범위를 벗어난 투명도 값', () => {
      const options: SimpleTextWatermarkOptions = {
        text: 'Test',
        opacity: 1.5, // 범위 초과
      };

      // 실제 구현에서는 클램핑되거나 에러 처리되어야 함
      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('음수 마진 값', () => {
      const options: SimpleTextWatermarkOptions = {
        text: 'Test',
        margin: { x: -10, y: -20 },
      };

      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('매우 큰 회전 각도', () => {
      const options: SimpleTextWatermarkOptions = {
        text: 'Test',
        rotation: 720, // 2바퀴
      };

      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });
  });

  describe('메서드 체이닝 및 조합', () => {
    test('텍스트와 이미지 워터마크 연속 적용', () => {
      // 텍스트 워터마크 먼저 추가
      const textOptions: SimpleTextWatermarkOptions = {
        text: '© 2024 Company',
        position: 'bottom-left',
      };

      let result = SimpleWatermark.addText(mockCanvas, textOptions);
      expect(result).toBe(mockCanvas);

      // 이미지 워터마크 추가
      const imageOptions: SimpleImageWatermarkOptions = {
        image: mockImage,
        position: 'bottom-right',
      };

      result = SimpleWatermark.addImage(result, imageOptions);
      expect(result).toBe(mockCanvas);

      // 둘 다 호출되었는지 확인

      expect(TextWatermark.addToCanvas).toHaveBeenCalled();
      expect(ImageWatermark.addToCanvas).toHaveBeenCalled();
    });

    test('여러 텍스트 워터마크 추가', () => {
      const watermarks = [
        { text: '© 2024', position: 'bottom-left' },
        { text: 'Company Name', position: 'bottom-right' },
        { text: 'Confidential', position: 'top-center' },
      ] as const;

      let result = mockCanvas;

      watermarks.forEach((options) => {
        result = SimpleWatermark.addText(result, options);
        expect(result).toBe(mockCanvas);
      });

      expect(TextWatermark.addToCanvas).toHaveBeenCalledTimes(3);
    });
  });

  describe('성능 및 최적화', () => {
    test('대량 워터마크 적용 성능', () => {
      const startTime = performance.now();

      // 50개의 워터마크 추가
      for (let i = 0; i < 50; i++) {
        SimpleWatermark.addText(mockCanvas, {
          text: `Watermark ${i}`,
          position: 'center',
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 성능 테스트 (100ms 이내)
      expect(duration).toBeLessThan(100);
    });

    test('메모리 사용량 테스트', () => {
      const startMemory = process.memoryUsage().heapUsed;

      // 여러 워터마크 적용
      for (let i = 0; i < 20; i++) {
        SimpleWatermark.addText(mockCanvas, { text: `Test ${i}` });
        SimpleWatermark.addImage(mockCanvas, { image: mockImage });
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // 메모리 증가량이 과도하지 않은지 확인 (5MB 이하)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('타입 안전성 검증', () => {
    test('잘못된 position 값 타입 체크', () => {
      // TypeScript 컴파일 타임에 잡히겠지만, 런타임 체크
      const options = {
        text: 'Test',
        position: 'invalid-position' as any,
      };

      // 실제로는 타입 에러가 발생해야 하지만, any로 우회
      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });

    test('잘못된 style 값 타입 체크', () => {
      const options = {
        text: 'Test',
        style: 'invalid-style' as any,
      };

      const result = SimpleWatermark.addText(mockCanvas, options);
      expect(result).toBe(mockCanvas);
    });
  });
});
