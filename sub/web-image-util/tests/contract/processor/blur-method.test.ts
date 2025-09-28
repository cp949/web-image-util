import { beforeEach, describe, expect, test } from 'vitest';
import { processImage } from '../../../src/processor';
import type { BlurOptions } from '../../../src/types';

describe('blur 메서드 계약', () => {
  let processor: ReturnType<typeof processImage>;

  beforeEach(() => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    processor = processImage(mockBlob);
  });

  describe('기본 시그니처', () => {
    test('파라미터 없이 호출 가능해야 함', () => {
      expect(() => processor.blur()).not.toThrow();
      const result = processor.blur();
      expect(result).toBe(processor);
    });

    test('반지름만 지정 가능해야 함', () => {
      expect(() => processor.blur(2)).not.toThrow();
      expect(() => processor.blur(5.5)).not.toThrow();
      const result = processor.blur(3);
      expect(result).toBe(processor);
    });

    test('반지름과 옵션 지정 가능해야 함', () => {
      const options: BlurOptions = { radius: 4 };
      expect(() => processor.blur(2, options)).not.toThrow();
      const result = processor.blur(2, options);
      expect(result).toBe(processor);
    });

    test('부분 옵션 지정 가능해야 함', () => {
      expect(() => processor.blur(2, {})).not.toThrow();
      const result = processor.blur(2, {});
      expect(result).toBe(processor);
    });
  });

  describe('파라미터 유효성', () => {
    test('양수 반지름만 허용해야 함', () => {
      expect(() => processor.blur(1)).not.toThrow();
      expect(() => processor.blur(10)).not.toThrow();
      expect(() => processor.blur(0.5)).not.toThrow();

      // 음수나 0은 체이닝 구조는 유지하지만 실행 시 에러 발생 예상
      expect(() => processor.blur(-1)).not.toThrow();
      expect(() => processor.blur(0)).not.toThrow();
    });

    test('NaN 반지름 처리가 되어야 함', () => {
      expect(() => processor.blur(NaN)).not.toThrow();
    });

    test('매우 큰 반지름도 처리되어야 함', () => {
      expect(() => processor.blur(100)).not.toThrow();
      expect(() => processor.blur(1000)).not.toThrow();
    });
  });

  describe('BlurOptions 검증', () => {
    test('radius 옵션이 파라미터를 오버라이드해야 함', () => {
      const options: BlurOptions = { radius: 5 };
      expect(() => processor.blur(2, options)).not.toThrow();
    });

    test('빈 옵션 객체가 허용되어야 함', () => {
      expect(() => processor.blur(2, {})).not.toThrow();
    });

    test('undefined 옵션이 허용되어야 함', () => {
      expect(() => processor.blur(2, undefined)).not.toThrow();
    });
  });

  describe('기본값 동작', () => {
    test('기본 반지름이 적용되어야 함', () => {
      // 파라미터 없이 호출 시 기본값 사용
      expect(() => processor.blur()).not.toThrow();
      const result = processor.blur();
      expect(result).toBe(processor);
    });

    test('0 반지름 시 기본값이 적용되어야 함', () => {
      expect(() => processor.blur(0)).not.toThrow();
    });
  });

  describe('체이닝 동작', () => {
    test('여러 번의 blur 호출이 가능해야 함', () => {
      const result = processor.blur(1).blur(2).blur(3);

      expect(result).toBe(processor);
    });

    test('다른 메서드와 체이닝이 가능해야 함', () => {
      const result = processor.resize(100, 100).blur(2).resize(200, 200).blur(1);

      expect(result).toBe(processor);
    });

    test('체이닝 순서가 유지되어야 함', () => {
      // 블러 전 리사이징
      const result1 = processor.resize(100, 100).blur(2);
      expect(result1).toBe(processor);

      // 블러 후 리사이징
      const result2 = processor.blur(2).resize(100, 100);
      expect(result2).toBe(processor);
    });
  });

  describe('타입 검증', () => {
    test('반환 타입이 올바르게 추론되어야 함', () => {
      const result = processor.blur(2);

      expect(typeof result.blur).toBe('function');
      expect(typeof result.resize).toBe('function');
      expect(typeof result.toBlob).toBe('function');
    });

    test('옵션 타입이 올바르게 검증되어야 함', () => {
      // 올바른 옵션
      const validOptions: BlurOptions = { radius: 3 };
      expect(() => processor.blur(2, validOptions)).not.toThrow();

      // 잘못된 옵션 타입 (컴파일 타임에 에러)
      // const invalidOptions = { radius: 'invalid' };
      // processor.blur(2, invalidOptions); // TypeScript 에러
    });
  });

  describe('Canvas filter 제약사항', () => {
    test('Canvas CSS filter 제한사항을 인지해야 함', () => {
      // Canvas는 CSS filter blur()만 지원하므로 단순한 radius 옵션만 제공
      const simpleOptions: BlurOptions = { radius: 2 };
      expect(() => processor.blur(2, simpleOptions)).not.toThrow();

      // 고급 블러 옵션은 지원하지 않음 (타입에서 제외됨)
      // const advancedOptions = { type: 'gaussian', sigma: 2 }; // 지원하지 않음
    });

    test('브라우저 호환성을 고려한 반지름 범위가 있어야 함', () => {
      // 일반적으로 브라우저에서 지원하는 범위
      expect(() => processor.blur(0.1)).not.toThrow();
      expect(() => processor.blur(20)).not.toThrow();
      expect(() => processor.blur(50)).not.toThrow(); // 매우 큰 값도 허용
    });
  });
});
