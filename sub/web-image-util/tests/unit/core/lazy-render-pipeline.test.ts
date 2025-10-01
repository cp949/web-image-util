import { ImageProcessError } from '../../../src/types';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline';

// 테스트용 가상 이미지 생성
function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  // naturalWidth/Height는 읽기 전용이므로 Object.defineProperty 사용
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

describe('LazyRenderPipeline', () => {
  let mockImage: HTMLImageElement;
  let pipeline: LazyRenderPipeline;

  beforeEach(() => {
    mockImage = createMockImage(800, 600);
    pipeline = new LazyRenderPipeline(mockImage);
  });

  describe('기본 기능', () => {
    it('LazyRenderPipeline 인스턴스를 생성할 수 있어야 함', () => {
      expect(pipeline).toBeInstanceOf(LazyRenderPipeline);
      expect(pipeline.getOperationCount()).toBe(0);
    });

    it('연산들을 누적할 수 있어야 함', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });
      pipeline.addBlur({ radius: 2 });

      expect(pipeline.getOperationCount()).toBe(2);

      const operations = pipeline.getOperations();
      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('resize');
      expect(operations[1].type).toBe('blur');
    });
  });

  describe('resize() 단일 호출 제약', () => {
    it('resize()를 한 번 호출하는 것은 성공해야 함', () => {
      expect(() => {
        pipeline.addResize({ fit: 'cover', width: 300, height: 200 });
      }).not.toThrow();
    });

    it('resize()를 두 번 호출하면 에러가 발생해야 함', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      expect(() => {
        pipeline.addResize({ fit: 'contain', width: 150, height: 150 });
      }).toThrow(ImageProcessError);

      expect(() => {
        pipeline.addResize({ fit: 'contain', width: 150, height: 150 });
      }).toThrow(/resize\(\)는 한 번만 호출할 수 있습니다/);
    });

    it('blur()는 여러 번 호출할 수 있어야 함', () => {
      expect(() => {
        pipeline.addBlur({ radius: 2 });
        pipeline.addBlur({ radius: 5 });
        pipeline.addBlur({ radius: 1 });
      }).not.toThrow();

      expect(pipeline.getOperationCount()).toBe(3);
    });
  });

  describe('체이닝 API', () => {
    it('메서드 체이닝이 가능해야 함', () => {
      const result = pipeline
        .addResize({ fit: 'cover', width: 300, height: 200 })
        .addBlur({ radius: 2 })
        .addFilter({ brightness: 1.2 });

      expect(result).toBe(pipeline);
      expect(pipeline.getOperationCount()).toBe(3);
    });
  });

  describe('지연 렌더링 개념', () => {
    it('연산 추가 후 toCanvas() 호출 시 렌더링이 수행되어야 함', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      // toCanvas() 호출 시 실제 렌더링 수행
      const result = pipeline.toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.operations).toBe(1);
    });
  });

  describe('메타데이터', () => {
    it('처리 결과와 함께 메타데이터를 반환해야 함', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      const result = pipeline.toCanvas();

      expect(result.metadata).toEqual({
        width: 300,
        height: 200,
        format: 'canvas',
        size: expect.any(Number),
        processingTime: expect.any(Number),
        operations: 1,
      });
    });

    it('여러 연산 후 메타데이터가 올바르게 기록되어야 함', () => {
      pipeline
        .addResize({ fit: 'contain', width: 400, height: 300 })
        .addBlur({ radius: 3 })
        .addFilter({ brightness: 1.1 });

      const result = pipeline.toCanvas();

      expect(result.metadata.operations).toBe(3);
      expect(result.metadata.width).toBe(400);
      expect(result.metadata.height).toBe(300);
    });
  });

  describe('에러 처리', () => {
    it('잘못된 resize 설정에 대해 적절한 에러를 발생시켜야 함', () => {
      const mockImage = createMockImage(100, 100);
      const invalidPipeline = new LazyRenderPipeline(mockImage);

      // LazyRenderPipeline은 지연 실행이므로, addResize는 에러를 발생시키지 않음
      // 대신 toCanvas() 호출 시 에러가 발생해야 함
      expect(() => {
        // @ts-expect-error 테스트를 위한 잘못된 타입
        invalidPipeline.addResize({ fit: 'invalid', width: -100 });
        invalidPipeline.toCanvas(); // 실제 렌더링 시 에러 발생
      }).toThrow();
    });
  });
});

describe('단일 렌더링 개념 검증', () => {
  it('복잡한 연산 파이프라인도 정상 동작해야 함', () => {
    const mockImage = createMockImage(1000, 800);
    const pipeline = new LazyRenderPipeline(mockImage);

    // 복잡한 연산 체이닝
    const result = pipeline
      .addResize({ fit: 'cover', width: 500, height: 400 })
      .addBlur({ radius: 2 })
      .addBlur({ radius: 1 })
      .addFilter({ brightness: 1.2 })
      .addFilter({ contrast: 1.1 })
      .toCanvas();

    // 결과가 올바르게 생성되었는지 확인
    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.metadata.operations).toBe(5);
    expect(result.metadata.width).toBe(500);
    expect(result.metadata.height).toBe(400);
  });
});
