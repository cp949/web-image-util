/**
 * 타입-안전한 프로세서 테스트
 *
 * @description TypeScript 타입 시스템을 통한 resize() 제약사항 검증
 * 이 테스트는 런타임 동작뿐만 아니라 컴파일 타임 타입 안전성도 검증합니다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';
import { createTestImageBlob } from '../../utils';

describe('타입-안전한 프로세서 테스트', () => {
  describe('타입 시스템 검증', () => {
    it('processImage()는 InitialProcessor 타입을 반환해야 함', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      // 타입 검증: processor는 InitialProcessor 타입이어야 함
      expect(processor).toBeDefined();

      // 컴파일 타임 검증: resize() 호출 가능
      const resized = processor.resize({ fit: 'cover', width: 200, height: 200 });
      expect(resized).toBeDefined();
    });

    it('resize() 호출 후에는 ResizedProcessor 타입으로 변환되어야 함', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');

      // 초기 상태: resize() 호출 가능
      const initial = processImage(testBlob);

      // resize() 호출 후: AfterResize 상태로 전환
      const resized = initial.resize({ fit: 'cover', width: 200, height: 200 });

      // blur()는 여전히 호출 가능
      const blurred = resized.blur(2);

      expect(blurred).toBeDefined();
    });

    it('blur()는 상태에 관계없이 호출 가능해야 함', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');

      // resize() 전에 blur() 호출
      const beforeResize = processImage(testBlob).blur(2);
      const afterBlur1 = beforeResize.resize({ fit: 'cover', width: 200, height: 200 });

      // resize() 후에 blur() 호출
      const afterBlur2 = afterBlur1.blur(5);

      expect(afterBlur2).toBeDefined();
    });
  });

  describe('런타임 동작 검증', () => {
    it('정상적인 체이닝 동작 검증', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'purple');

      const result = await processImage(testBlob)
        .blur(1)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(2)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('resize() 중복 호출 시 런타임 에러 발생', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'orange');
      const processor = processImage(testBlob);

      // 첫 번째 resize() 호출
      processor.resize({ fit: 'cover', width: 200, height: 200 });

      // 두 번째 resize() 호출 시 에러 발생
      expect(() => {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
      }).toThrow(ImageProcessError);
    });

    it('에러 메시지에 올바른 제안사항 포함', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'cyan');
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

          // 제안사항 내용 검증
          const suggestionsText = error.suggestions.join(' ');
          expect(suggestionsText).toContain('모든 리사이징 옵션을 하나의 resize() 호출에 포함');
          expect(suggestionsText).toContain('별도의 processImage() 인스턴스를 생성');
        }
      }
    });

    it('별도 인스턴스는 독립적으로 resize() 호출 가능', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'yellow');

      // 각각 별도의 인스턴스 생성
      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      // 각각 독립적으로 resize() 호출 가능
      const result1 = await processor1.resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
      const result2 = await processor2.resize({ fit: 'contain', width: 300, height: 200 }).toBlob();

      expect(result1.width).toBe(150);
      expect(result1.height).toBe(150);
      expect(result2.width).toBe(300);
      expect(result2.height).toBe(200);
    });
  });

  describe('체이닝 순서 검증', () => {
    it('blur() → resize() → blur() 순서 동작', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'pink');

      const result = await processImage(testBlob)
        .blur(1) // 전처리 블러
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(3) // 후처리 블러
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('resize() → blur() 순서 동작', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'teal');

      const result = await processImage(testBlob).resize({ fit: 'maxFit', width: 300 }).blur(2).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBeLessThanOrEqual(300);
    });

    it('복수의 blur() 호출 동작', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'navy');

      const result = await processImage(testBlob)
        .blur(1)
        .blur(2)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(1)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('타입 추론 검증', () => {
    it('메서드 체이닝에서 정확한 타입 추론', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'lime');

      // 타입 추론 검증을 위한 단계별 변수 할당
      const step1 = processImage(testBlob); // InitialProcessor
      const step2 = step1.blur(1); // ImageProcessor<BeforeResize>
      const step3 = step2.resize({ fit: 'cover', width: 200, height: 200 }); // ImageProcessor<AfterResize>
      const step4 = step3.blur(2); // ImageProcessor<AfterResize>

      const result = await step4.toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('에러 코드 일관성 검증', () => {
    it('MULTIPLE_RESIZE_NOT_ALLOWED 에러 코드 사용', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'gray');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('에러가 발생해야 함');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          // 정확한 에러 코드 사용 확인
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');

          // 레거시 에러 코드 사용하지 않음 확인
          expect(error.code).not.toBe('MULTIPLE_RESIZE_ERROR');
        }
      }
    });
  });
});
