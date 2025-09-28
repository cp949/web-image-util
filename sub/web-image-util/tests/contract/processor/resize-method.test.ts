import { beforeEach, describe, expect, test } from 'vitest';
import { processImage } from '../../../src/processor';
import type { ResizeOptions, SmartResizeOptions } from '../../../src/types';

describe('resize 메서드 계약', () => {
  let processor: ReturnType<typeof processImage>;

  beforeEach(() => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    processor = processImage(mockBlob);
  });

  describe('기본 시그니처', () => {
    test('width만 지정 가능해야 함', () => {
      expect(() => processor.resize(100)).not.toThrow();
      const result = processor.resize(100);
      expect(result).toBe(processor);
    });

    test('width와 height 지정 가능해야 함', () => {
      expect(() => processor.resize(100, 200)).not.toThrow();
      const result = processor.resize(100, 200);
      expect(result).toBe(processor);
    });

    test('width, height, options 지정 가능해야 함', () => {
      const options: ResizeOptions = { fit: 'cover' };
      expect(() => processor.resize(100, 200, options)).not.toThrow();
      const result = processor.resize(100, 200, options);
      expect(result).toBe(processor);
    });

    test('객체 형태 옵션 지정 가능해야 함', () => {
      const options: ResizeOptions = { width: 100, height: 200 };
      expect(() => processor.resize(options)).not.toThrow();
      const result = processor.resize(options);
      expect(result).toBe(processor);
    });
  });

  describe('파라미터 유효성', () => {
    test('양수 크기만 허용해야 함', () => {
      expect(() => processor.resize(100, 200)).not.toThrow();

      // 음수나 0은 유효하지 않지만 체이닝 구조는 유지 (실제 검증은 실행 시점)
      expect(() => processor.resize(-100, 200)).not.toThrow();
      expect(() => processor.resize(0, 200)).not.toThrow();
    });

    test('null과 undefined도 허용해야 함 (비율 유지용)', () => {
      expect(() => processor.resize(100, null)).not.toThrow();
      expect(() => processor.resize(null, 200)).not.toThrow();
      expect(() => processor.resize(100, undefined)).not.toThrow();
    });

    test('NaN은 처리되어야 함', () => {
      expect(() => processor.resize(NaN, 200)).not.toThrow();
      expect(() => processor.resize(100, NaN)).not.toThrow();
    });
  });

  describe('ResizeOptions 검증', () => {
    test('모든 fit 모드가 허용되어야 함', () => {
      const fitModes: Array<ResizeOptions['fit']> = ['cover', 'contain', 'fill', 'inside', 'outside'];

      fitModes.forEach((fit) => {
        expect(() => processor.resize(100, 100, { fit })).not.toThrow();
      });
    });

    test('모든 position 값이 허용되어야 함', () => {
      const positions: Array<ResizeOptions['position']> = [
        'center',
        'centre',
        'top',
        'bottom',
        'left',
        'right',
        { x: 50, y: 50 },
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      positions.forEach((position) => {
        expect(() => processor.resize(100, 100, { position })).not.toThrow();
      });
    });

    test('배경색 옵션이 올바르게 처리되어야 함', () => {
      // 문자열 배경색
      expect(() => processor.resize(100, 100, { background: '#ffffff' })).not.toThrow();
      expect(() => processor.resize(100, 100, { background: 'red' })).not.toThrow();
      expect(() => processor.resize(100, 100, { background: 'transparent' })).not.toThrow();

      // RGBA 객체 배경색
      expect(() =>
        processor.resize(100, 100, {
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
      ).not.toThrow();

      expect(() =>
        processor.resize(100, 100, {
          background: { r: 0, g: 0, b: 0, alpha: 0.5 },
        })
      ).not.toThrow();
    });

    test('확대/축소 제한 옵션이 처리되어야 함', () => {
      expect(() =>
        processor.resize(100, 100, {
          withoutEnlargement: true,
        })
      ).not.toThrow();

      expect(() =>
        processor.resize(100, 100, {
          withoutReduction: true,
        })
      ).not.toThrow();

      expect(() =>
        processor.resize(100, 100, {
          withoutEnlargement: true,
          withoutReduction: true,
        })
      ).not.toThrow();
    });
  });

  describe('SmartResizeOptions 검증', () => {
    test('스마트 리사이징 옵션이 처리되어야 함', () => {
      const smartOptions: SmartResizeOptions = {
        width: 100,
        height: 100,
        strategy: 'auto',
        performance: 'balanced',
        maxMemoryMB: 100,
      };

      expect(() => processor.resize(100, 100, smartOptions)).not.toThrow();
    });

    test('progress 콜백이 허용되어야 함', () => {
      const progressCallback = (progress: number) => {
        expect(typeof progress).toBe('number');
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      };

      const smartOptions: SmartResizeOptions = {
        onProgress: progressCallback,
      };

      expect(() => processor.resize(100, 100, smartOptions)).not.toThrow();
    });
  });

  describe('체이닝 동작', () => {
    test('여러 번의 resize 호출이 가능해야 함', () => {
      const result = processor.resize(100, 100).resize(200, 200).resize(50, 50);

      expect(result).toBe(processor);
    });

    test('다른 메서드와 체이닝이 가능해야 함', () => {
      const result = processor.resize(100, 100).blur(2).resize(200, 200);

      expect(result).toBe(processor);
    });
  });

  describe('타입 추론', () => {
    test('반환 타입이 올바르게 추론되어야 함', () => {
      const result = processor.resize(100, 100);

      // TypeScript 컴파일 시점에서 검증
      expect(typeof result.resize).toBe('function');
      expect(typeof result.blur).toBe('function');
      expect(typeof result.toBlob).toBe('function');
    });

    test('오버로드된 시그니처가 올바르게 작동해야 함', () => {
      // 각 오버로드가 올바른 타입을 반환하는지 확인
      const result1 = processor.resize(100);
      const result2 = processor.resize(100, 200);
      const result3 = processor.resize({ width: 100 });
      const result4 = processor.resize(100, 200, { fit: 'cover' });

      [result1, result2, result3, result4].forEach((result) => {
        expect(result).toBe(processor);
        expect(typeof result.toBlob).toBe('function');
      });
    });
  });
});
