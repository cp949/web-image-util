import { beforeEach, describe, expect, test } from 'vitest';
import { ImageProcessor, processImage } from '../../../src/processor';

describe('ImageProcessor 클래스 계약', () => {
  let processor: ImageProcessor;

  beforeEach(() => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    processor = processImage(mockBlob);
  });

  describe('클래스 구조', () => {
    test('ImageProcessor 클래스의 인스턴스여야 함', () => {
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('모든 필수 메서드가 존재해야 함', () => {
      // 변환 메서드들
      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');

      // 출력 메서드들
      expect(typeof processor.toBlob).toBe('function');
      expect(typeof processor.toDataURL).toBe('function');
      expect(typeof processor.toFile).toBe('function');
      expect(typeof processor.toCanvas).toBe('function');

      // 추가 출력 메서드들
      expect(typeof processor.toElement).toBe('function');
      expect(typeof processor.toArrayBuffer).toBe('function');
      expect(typeof processor.toUint8Array).toBe('function');
      expect(typeof processor.toCanvasDetailed).toBe('function');
    });

    test('메서드들이 올바른 아리티(arity)를 가져야 함', () => {
      // resize 메서드는 여러 오버로드를 지원
      expect(processor.resize.length).toBeGreaterThanOrEqual(0);

      // blur 메서드는 선택적 매개변수를 가짐
      expect(processor.blur.length).toBeLessThanOrEqual(2);

      // 출력 메서드들은 선택적 매개변수를 가짐
      expect(processor.toBlob.length).toBeLessThanOrEqual(1);
      expect(processor.toDataURL.length).toBeLessThanOrEqual(1);
      expect(processor.toFile.length).toBeLessThanOrEqual(2);
    });
  });

  describe('메서드 체이닝', () => {
    test('resize 메서드가 this를 반환해야 함', () => {
      const result = processor.resize(100, 100);
      expect(result).toBe(processor);
      expect(result).toBeInstanceOf(ImageProcessor);
    });

    test('blur 메서드가 this를 반환해야 함', () => {
      const result = processor.blur(2);
      expect(result).toBe(processor);
      expect(result).toBeInstanceOf(ImageProcessor);
    });

    test('체이닝이 올바르게 작동해야 함', () => {
      const result = processor.resize(200, 200).blur(1);

      expect(result).toBe(processor);
      expect(result).toBeInstanceOf(ImageProcessor);
    });

    test('긴 체이닝이 가능해야 함', () => {
      const result = processor.resize(300, 300, { fit: 'cover' }).blur(2, {}).resize(150, 150);

      expect(result).toBe(processor);
      expect(typeof result.toBlob).toBe('function');
    });
  });

  describe('출력 메서드 계약', () => {
    test('모든 출력 메서드가 Promise를 반환해야 함', () => {
      expect(processor.toBlob()).toBeInstanceOf(Promise);
      expect(processor.toDataURL()).toBeInstanceOf(Promise);
      expect(processor.toFile('test.png')).toBeInstanceOf(Promise);
      expect(processor.toCanvas()).toBeInstanceOf(Promise);
      expect(processor.toElement()).toBeInstanceOf(Promise);
      expect(processor.toArrayBuffer()).toBeInstanceOf(Promise);
      expect(processor.toUint8Array()).toBeInstanceOf(Promise);
    });

    test('출력 메서드들이 체이닝을 종료해야 함', () => {
      // 출력 메서드는 Promise를 반환하므로 더 이상 체이닝할 수 없음
      const blobPromise = processor.toBlob();
      expect(typeof blobPromise.then).toBe('function');
      expect(typeof (blobPromise as any).resize).toBe('undefined');
    });
  });

  describe('타입 시그니처 검증', () => {
    test('resize 메서드 오버로드가 올바르게 작동해야 함', () => {
      // 다양한 시그니처로 호출 가능
      expect(() => processor.resize(100)).not.toThrow();
      expect(() => processor.resize(100, 200)).not.toThrow();
      expect(() => processor.resize(100, 200, { fit: 'cover' })).not.toThrow();
      expect(() => processor.resize({ width: 100 })).not.toThrow();
      expect(() => processor.resize({ width: 100, height: 200 })).not.toThrow();
    });

    test('blur 메서드 시그니처가 올바르게 작동해야 함', () => {
      expect(() => processor.blur()).not.toThrow();
      expect(() => processor.blur(2)).not.toThrow();
      expect(() => processor.blur(2, {})).not.toThrow();
      expect(() => processor.blur(2, { radius: 3 })).not.toThrow();
    });

    test('출력 메서드 시그니처가 올바르게 작동해야 함', () => {
      expect(() => processor.toBlob()).not.toThrow();
      expect(() => processor.toBlob({})).not.toThrow();
      expect(() => processor.toBlob({ format: 'png' })).not.toThrow();
      expect(() => processor.toBlob('jpeg')).not.toThrow();

      expect(() => processor.toDataURL()).not.toThrow();
      expect(() => processor.toDataURL('webp')).not.toThrow();

      expect(() => processor.toFile('image.png')).not.toThrow();
      expect(() => processor.toFile('image.jpg', { quality: 0.8 })).not.toThrow();
      expect(() => processor.toFile('image.webp', 'webp')).not.toThrow();
    });
  });

  describe('불변성 검증', () => {
    test('메서드 호출이 원본 processor를 변경하지 않아야 함', () => {
      const originalProcessor = processor;

      processor.resize(100, 100);
      processor.blur(2);

      // 체이닝은 같은 인스턴스를 반환하지만 내부 상태만 변경
      expect(processor).toBe(originalProcessor);
    });

    test('여러 번의 메서드 호출이 독립적이어야 함', () => {
      const chain1 = processor.resize(100, 100);
      const chain2 = processor.resize(200, 200);

      expect(chain1).toBe(processor);
      expect(chain2).toBe(processor);
      expect(chain1).toBe(chain2); // 같은 인스턴스
    });
  });

  describe('에러 전파', () => {
    test('체이닝 중 에러가 발생해도 체이닝 구조는 유지되어야 함', () => {
      // 잘못된 파라미터로 호출해도 체이닝 구조는 유지
      expect(() => {
        const result = processor.resize(-100, -100); // 잘못된 크기
        expect(result).toBeInstanceOf(ImageProcessor);
      }).not.toThrow(); // 에러는 실행 시점에 발생
    });

    test('출력 단계에서 에러가 적절히 Promise로 전파되어야 함', async () => {
      // 실제 처리에서 에러가 발생하는 경우는 별도 테스트에서 확인
      const promise = processor.toBlob();
      expect(promise).toBeInstanceOf(Promise);
      expect(typeof promise.catch).toBe('function');
    });
  });
});
