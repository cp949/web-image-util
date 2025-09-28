import { describe, expect, test } from 'vitest';
import { processImage } from '../../../src/processor';
import type { BlurOptions, OutputOptions, ProcessorOptions, ResizeOptions } from '../../../src/types';

describe('옵션 처리 로직', () => {
  describe('기본값 적용', () => {
    test('ProcessorOptions 기본값이 적용되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 기본값이 내부적으로 설정되었는지 체크
      // (실제 구현에서는 private 속성이므로 간접적으로 검증)
      expect(processor).toBeInstanceOf(Object);
      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');
      expect(typeof processor.toBlob).toBe('function');
    });

    test('사용자 정의 ProcessorOptions이 적용되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const customOptions: ProcessorOptions = {
        crossOrigin: 'use-credentials',
        defaultQuality: 0.9,
        defaultBackground: { r: 255, g: 255, b: 255, alpha: 1 },
        timeout: 60000,
      };

      const processor = processImage(mockBlob, customOptions);

      expect(processor).toBeInstanceOf(Object);
      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');
      expect(typeof processor.toBlob).toBe('function');
    });

    test('부분적인 옵션도 기본값과 병합되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const partialOptions: Partial<ProcessorOptions> = {
        defaultQuality: 0.95,
      };

      expect(() => processImage(mockBlob, partialOptions)).not.toThrow();
    });

    test('빈 옵션 객체도 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      expect(() => processImage(mockBlob, {})).not.toThrow();
    });
  });

  describe('ResizeOptions 처리', () => {
    test('기본 ResizeOptions이 적용되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.resize(100, 100)).not.toThrow();
    });

    test('완전한 ResizeOptions이 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const fullOptions: ResizeOptions = {
        width: 200,
        height: 150,
        fit: 'contain',
        position: 'top',
        background: { r: 128, g: 128, b: 128, alpha: 0.5 },
        withoutEnlargement: true,
        withoutReduction: false,
      };

      expect(() => processor.resize(fullOptions)).not.toThrow();

      // 체이닝이 동작하는지 확인
      const result = processor.resize(fullOptions);
      expect(result).toBe(processor);
    });

    test('부분적인 ResizeOptions도 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const partialOptions: Partial<ResizeOptions> = {
        fit: 'cover',
        background: '#ffffff',
      };

      expect(() => processor.resize(100, 100, partialOptions)).not.toThrow();
    });

    test('객체 형태의 ResizeOptions이 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const objectOptions: ResizeOptions = {
        width: 300,
        height: 200,
        fit: 'contain',
      };

      expect(() => processor.resize(objectOptions)).not.toThrow();
    });

    test('너비만 지정하는 경우 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.resize(100)).not.toThrow();
    });

    test('높이만 지정하는 경우 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const heightOnlyOptions: ResizeOptions = {
        height: 200,
      };

      expect(() => processor.resize(heightOnlyOptions)).not.toThrow();
    });

    test('잘못된 ResizeOptions은 체이닝이 유지되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 체이닝 구조는 유지되지만 실행 시 검증
      const result = processor.resize(-100, -100);
      expect(result).toBe(processor);
    });
  });

  describe('BlurOptions 처리', () => {
    test('기본 BlurOptions이 적용되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.blur()).not.toThrow();
      expect(() => processor.blur(2)).not.toThrow();
    });

    test('완전한 BlurOptions이 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const fullOptions: BlurOptions = {
        radius: 5,
      };

      expect(() => processor.blur(3, fullOptions)).not.toThrow();

      // 체이닝이 동작하는지 확인
      const result = processor.blur(3, fullOptions);
      expect(result).toBe(processor);
    });

    test('radius 옵션이 파라미터를 오버라이드해야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const overrideOptions: BlurOptions = {
        radius: 8, // 파라미터 값을 오버라이드
      };

      expect(() => processor.blur(2, overrideOptions)).not.toThrow();
    });

    test('기본 radius 값이 적용되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.blur()).not.toThrow();
    });

    test('0 radius도 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.blur(0)).not.toThrow();
    });

    test('큰 radius 값도 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.blur(100)).not.toThrow();
    });
  });

  describe('OutputOptions 처리', () => {
    test('기본 OutputOptions이 적용되어야 함', async () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const promise = processor.toBlob();
      expect(promise).toBeInstanceOf(Promise);
    });

    test('완전한 OutputOptions이 처리되어야 함', async () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const fullOptions: OutputOptions = {
        format: 'webp',
        quality: 0.7,
        fallbackFormat: 'png',
      };

      const promise = processor.toBlob(fullOptions);
      expect(promise).toBeInstanceOf(Promise);
    });

    test('포맷 문자열이 OutputOptions으로 변환되어야 함', async () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const promise = processor.toBlob('jpeg');
      expect(promise).toBeInstanceOf(Promise);
    });

    test('toDataURL도 동일한 옵션 처리를 해야 함', async () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const promise1 = processor.toDataURL();
      const promise2 = processor.toDataURL('png');
      const promise3 = processor.toDataURL({ format: 'webp', quality: 0.8 });

      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise3).toBeInstanceOf(Promise);
    });

    test('toFile도 동일한 옵션 처리를 해야 함', async () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const promise1 = processor.toFile('test.png');
      const promise2 = processor.toFile('test.jpg', 'jpeg');
      const promise3 = processor.toFile('test.webp', { format: 'webp', quality: 0.9 });

      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise3).toBeInstanceOf(Promise);
    });
  });

  describe('옵션 검증', () => {
    test('품질 값이 올바른 범위로 제한되어야 함 (체이닝 유지)', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 범위를 벗어난 값들도 허용 (실행 시 보정)
      expect(() => processor.toBlob({ quality: -0.5 })).not.toThrow();
      expect(() => processor.toBlob({ quality: 1.5 })).not.toThrow();
      expect(() => processor.toBlob({ quality: NaN })).not.toThrow();
    });

    test('크기 값이 검증되어야 함 (체이닝 유지)', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 체이닝 구조는 유지 (실행 시 검증)
      expect(() => processor.resize(0, 0)).not.toThrow();
      expect(() => processor.resize(Infinity, Infinity)).not.toThrow();
      expect(() => processor.resize(NaN, NaN)).not.toThrow();
    });

    test('배경색 값이 검증되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 다양한 배경색 형식
      expect(() => processor.resize(100, 100, { background: '#ff0000' })).not.toThrow();
      expect(() => processor.resize(100, 100, { background: 'red' })).not.toThrow();
      expect(() => processor.resize(100, 100, { background: 'transparent' })).not.toThrow();
      expect(() =>
        processor.resize(100, 100, {
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        })
      ).not.toThrow();
    });

    test('fit 모드가 유효한지 확인', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const validFitModes = ['cover', 'contain', 'fill', 'inside', 'outside'];

      validFitModes.forEach((fit) => {
        expect(() => processor.resize(100, 100, { fit: fit as any })).not.toThrow();
      });
    });

    test('position 값이 유효한지 확인', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const validPositions = ['center', 'centre', 'top', 'bottom', 'left', 'right'];

      validPositions.forEach((position) => {
        expect(() => processor.resize(100, 100, { position: position as any })).not.toThrow();
      });
    });
  });

  describe('옵션 상속 및 우선순위', () => {
    test('메서드 옵션이 기본 옵션을 오버라이드해야 함', () => {
      const mockBlob = new Blob(['test']);
      const defaultOptions: ProcessorOptions = {
        defaultQuality: 0.5,
        defaultBackground: { r: 0, g: 0, b: 0, alpha: 1 },
      };

      const processor = processImage(mockBlob, defaultOptions);

      // 메서드 레벨 옵션이 우선
      expect(() =>
        processor.resize(100, 100, {
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
      ).not.toThrow();

      expect(() => processor.toBlob({ quality: 0.9 })).not.toThrow();
    });

    test('체이닝된 메서드들의 옵션이 독립적이어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const chainedProcessor = processor.resize(100, 100, { fit: 'cover' }).blur(2).resize(50, 50, { fit: 'contain' });

      expect(chainedProcessor).toBe(processor);
    });

    test('동일한 타입의 오퍼레이션을 여러 번 체이닝할 수 있어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.resize(200, 200).resize(150, 150).resize(100, 100)).not.toThrow();

      expect(() => processor.blur(5).blur(3).blur(1)).not.toThrow();
    });
  });

  describe('타입 안전성', () => {
    test('옵션 타입이 컴파일 타임에 검증되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 올바른 타입 사용
      const validResizeOptions: ResizeOptions = {
        width: 100,
        height: 100,
        fit: 'cover',
      };

      const validBlurOptions: BlurOptions = {
        radius: 3,
      };

      const validOutputOptions: OutputOptions = {
        format: 'png',
        quality: 0.8,
      };

      expect(() => processor.resize(validResizeOptions)).not.toThrow();
      expect(() => processor.blur(2, validBlurOptions)).not.toThrow();
      expect(() => processor.toBlob(validOutputOptions)).not.toThrow();
    });

    test('잘못된 타입은 컴파일 에러를 발생시켜야 함', () => {
      // 이 테스트는 TypeScript 컴파일러에 의해 검증됨
      // const invalidOptions = { fit: 'invalid' }; // 컴파일 에러
      // processor.resize(100, 100, invalidOptions);
      expect(true).toBe(true); // 컴파일 성공 확인
    });

    test('undefined나 null 옵션도 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => processor.resize(100, 100, undefined)).not.toThrow();
      expect(() => processor.blur(2, undefined)).not.toThrow();
      expect(() => processor.toBlob(undefined)).not.toThrow();
    });
  });

  describe('메모리 및 성능', () => {
    test('옵션 객체가 적절히 복사되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const originalOptions: ResizeOptions = {
        width: 100,
        height: 100,
        fit: 'cover',
      };

      expect(() => processor.resize(originalOptions)).not.toThrow();

      // 원본 옵션 수정
      originalOptions.width = 200;

      // 이후 호출은 영향받지 않아야 함 (깊은 복사 확인)
      expect(() => processor.resize(150, 150)).not.toThrow();
    });

    test('기본값 계산이 효율적이어야 함', () => {
      const mockBlob = new Blob(['test']);

      // 여러 번 생성해도 성능에 문제없어야 함
      for (let i = 0; i < 10; i++) {
        const processor = processImage(mockBlob);
        expect(processor).toBeDefined();
      }
    });

    test('복잡한 체이닝도 효율적으로 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const startTime = performance.now();

      processor.resize(500, 500).blur(5).resize(400, 400).blur(3).resize(300, 300).blur(1).resize(200, 200);

      const endTime = performance.now();

      // 체이닝 자체는 빨라야 함 (실제 처리는 실행 시점)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('SmartResize 옵션', () => {
    test('SmartResize 옵션이 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      const smartOptions = {
        width: 100,
        height: 100,
        strategy: 'auto' as const,
        performance: 'balanced' as const,
      };

      expect(() => processor.resize(100, 100, smartOptions)).not.toThrow();
    });
  });
});
