/**
 * 타입-안전한 프로세서 단순 테스트
 *
 * @description TypeScript 타입 시스템 검증에 집중한 단순 테스트
 * Canvas 생성 없이 타입 레벨 동작만 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';

describe('타입-안전한 프로세서 단순 테스트', () => {
  // 간단한 테스트 블롭 생성 (Canvas 사용 안함)
  const createSimpleBlob = () => {
    return new Blob(['test'], { type: 'image/png' });
  };

  describe('타입 시스템 기본 검증', () => {
    it('processImage()는 올바른 타입을 반환해야 함', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      // 기본 타입 검증
      expect(processor).toBeDefined();
      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');
    });

    it('resize() 메서드가 체이닝 가능해야 함', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      // resize() 메서드 존재 확인
      expect(typeof processor.resize).toBe('function');

      // resize() 호출 후 다른 메서드들 사용 가능 확인
      const resized = processor.resize({ fit: 'cover', width: 200, height: 200 });
      expect(typeof resized.blur).toBe('function');
      expect(typeof resized.toBlob).toBe('function');
    });

    it('blur() 메서드가 상태에 관계없이 사용 가능해야 함', () => {
      const testBlob = createSimpleBlob();

      // resize() 전에 blur() 호출 가능
      const beforeResize = processImage(testBlob);
      expect(typeof beforeResize.blur).toBe('function');

      // resize() 후에 blur() 호출 가능
      const afterResize = beforeResize.resize({ fit: 'cover', width: 200, height: 200 });
      expect(typeof afterResize.blur).toBe('function');
    });
  });

  describe('런타임 에러 검증 (Canvas 사용 안함)', () => {
    it('resize() 중복 호출 시 에러 발생', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      // 첫 번째 resize() 호출
      processor.resize({ fit: 'cover', width: 200, height: 200 });

      // 두 번째 resize() 호출 시 에러 발생
      expect(() => {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
      }).toThrow(ImageProcessError);
    });

    it('에러 메시지와 코드가 올바른지 확인', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('에러가 발생해야 함');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.message).toContain('resize()는 한 번만 호출할 수 있습니다');
          expect(error.suggestions).toBeInstanceOf(Array);
          expect(error.suggestions.length).toBeGreaterThan(0);
        }
      }
    });

    it('별도 인스턴스는 독립적으로 동작', () => {
      const testBlob = createSimpleBlob();

      // 각각 별도의 인스턴스 생성
      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      // 각각 독립적으로 resize() 호출 가능 (에러 발생 안함)
      expect(() => {
        processor1.resize({ fit: 'cover', width: 150, height: 150 });
        processor2.resize({ fit: 'contain', width: 300, height: 200 });
      }).not.toThrow();
    });
  });

  describe('메서드 체이닝 검증', () => {
    it('다양한 체이닝 순서가 가능해야 함', () => {
      const testBlob = createSimpleBlob();

      // blur() → resize() 순서
      expect(() => {
        const processor1 = processImage(testBlob)
          .blur(1)
          .resize({ fit: 'cover', width: 200, height: 200 });
        expect(processor1).toBeDefined();
      }).not.toThrow();

      // resize() → blur() 순서
      expect(() => {
        const processor2 = processImage(testBlob)
          .resize({ fit: 'maxFit', width: 300 })
          .blur(2);
        expect(processor2).toBeDefined();
      }).not.toThrow();

      // 복수 blur() 호출
      expect(() => {
        const processor3 = processImage(testBlob)
          .blur(1)
          .blur(2)
          .resize({ fit: 'cover', width: 200, height: 200 })
          .blur(1);
        expect(processor3).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('에러 코드 일관성 검증', () => {
    it('정확한 에러 코드 사용', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('에러가 발생해야 함');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          // 정확한 에러 코드 확인
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');

          // 레거시 에러 코드 사용하지 않음 확인
          expect(error.code).not.toBe('MULTIPLE_RESIZE_ERROR');
        }
      }
    });

    it('도움이 되는 제안사항 포함', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('에러가 발생해야 함');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          const suggestionsText = error.suggestions.join(' ');

          // 실용적인 제안사항 포함 확인
          expect(suggestionsText).toContain('모든 리사이징 옵션을 하나의 resize() 호출에 포함');
          expect(suggestionsText).toContain('별도의 processImage() 인스턴스를 생성');
          expect(suggestionsText).toContain('processImage(source).resize');
        }
      }
    });
  });
});