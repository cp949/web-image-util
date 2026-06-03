/**
 * SteppedProcessor 단위 테스트
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SteppedProcessor } from '../../../src/base/stepped-processor.internal';

// ============================================================================
// 헬퍼
// ============================================================================

function createMockImage(width = 200, height = 200): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

// ============================================================================
// resizeWithSteps — quality 분기 (fast vs high)
// ============================================================================

describe('SteppedProcessor.resizeWithSteps — quality 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("quality:'fast'이면 대축소비에서도 직접 리사이즈 경로를 사용하고 인자를 그대로 전달한다", async () => {
    // private 메서드를 spy해 jsdom drawImage 없이 경로 선택만 검증한다
    const directResizeSpy = vi
      .spyOn(SteppedProcessor as any, 'directResize')
      .mockResolvedValue(document.createElement('canvas'));
    const performSteppedResizeSpy = vi
      .spyOn(SteppedProcessor as any, 'performSteppedResize')
      .mockResolvedValue(document.createElement('canvas'));

    // 비대칭 치수: width/height 전달 순서가 뒤바뀌면 검출 가능
    const img = createMockImage(1000, 800);
    // scaleX=12/1000=0.012, scaleY=8/800=0.01 → minScale=0.01 < 0.5
    // quality:'fast' → OR 두 번째 항(quality==='fast')이 true → directResize 경로
    await SteppedProcessor.resizeWithSteps(img, 12, 8, { quality: 'fast' });

    expect(directResizeSpy).toHaveBeenCalledOnce();
    expect(directResizeSpy).toHaveBeenCalledWith(img, 12, 8, 'fast');
    expect(performSteppedResizeSpy).not.toHaveBeenCalled();
  });

  it("quality:'high'이고 대축소비이면 다단계 리사이즈 경로를 사용하고 인자를 그대로 전달한다", async () => {
    const directResizeSpy = vi
      .spyOn(SteppedProcessor as any, 'directResize')
      .mockResolvedValue(document.createElement('canvas'));
    const performSteppedResizeSpy = vi
      .spyOn(SteppedProcessor as any, 'performSteppedResize')
      .mockResolvedValue(document.createElement('canvas'));

    // 비대칭 치수: width/height 전달 순서가 뒤바뀌면 검출 가능
    const img = createMockImage(1000, 800);
    // minScale=0.01 < 0.5, quality:'high' → performSteppedResize 경로
    await SteppedProcessor.resizeWithSteps(img, 12, 8, { quality: 'high' });

    expect(performSteppedResizeSpy).toHaveBeenCalledOnce();
    // minScale=Math.min(12/1000, 8/800)=0.01, opts는 기본값+quality:'high'
    expect(performSteppedResizeSpy).toHaveBeenCalledWith(img, 12, 8, 0.01, {
      quality: 'high',
      maxSteps: 10,
      minStepRatio: 0.5,
    });
    expect(directResizeSpy).not.toHaveBeenCalled();
  });

  it('minScale이 minStepRatio 이상이면 quality 무관하게 직접 리사이즈 경로를 사용한다', async () => {
    // OR 첫 번째 항(minScale >= opts.minStepRatio)이 true인 분기
    const directResizeSpy = vi
      .spyOn(SteppedProcessor as any, 'directResize')
      .mockResolvedValue(document.createElement('canvas'));
    const performSteppedResizeSpy = vi
      .spyOn(SteppedProcessor as any, 'performSteppedResize')
      .mockResolvedValue(document.createElement('canvas'));

    // 비대칭 치수: scaleX=700/1000=0.7, scaleY=560/800=0.7 → minScale=0.7 >= 0.5
    const img = createMockImage(1000, 800);
    await SteppedProcessor.resizeWithSteps(img, 700, 560, { quality: 'high' });

    expect(directResizeSpy).toHaveBeenCalledOnce();
    expect(directResizeSpy).toHaveBeenCalledWith(img, 700, 560, 'high');
    expect(performSteppedResizeSpy).not.toHaveBeenCalled();
  });
});

// ============================================================================
// batchResizeWithSteps — 결과 순서 검증
// ============================================================================

describe('SteppedProcessor.batchResizeWithSteps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('입력 이미지 순서대로 결과를 반환한다', async () => {
    // resizeWithSteps를 mock해 각 이미지마다 고유한 크기의 canvas를 반환한다
    const widths = [10, 20, 30, 40, 50, 60, 70];
    const images = widths.map((w) => createMockImage(w, w));

    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockImplementation(async (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      return canvas;
    });

    // concurrency=3으로 3개 청크가 생성된다 (3+3+1)
    const results = await SteppedProcessor.batchResizeWithSteps(images, 100, 100, {
      concurrency: 3,
    });

    expect(results).toHaveLength(7);
    // 각 결과의 width가 원본 이미지 순서와 일치해야 한다
    expect(results.map((c) => c.width)).toEqual(widths);
  });
});

// ============================================================================
// shouldUseSteppedResize — 임계값 분기
// ============================================================================

describe('SteppedProcessor.shouldUseSteppedResize', () => {
  it('축소 비율이 기본 임계값(0.5) 미만이면 true를 반환한다', () => {
    // minScale = 100/1000 = 0.1 < 0.5
    expect(SteppedProcessor.shouldUseSteppedResize(1000, 1000, 100, 100)).toBe(true);
  });

  it('축소 비율이 기본 임계값(0.5) 이상이면 false를 반환한다', () => {
    // minScale = 60/100 = 0.6 >= 0.5
    expect(SteppedProcessor.shouldUseSteppedResize(100, 100, 60, 60)).toBe(false);
  });

  it('축소 비율이 기본 임계값(0.5)과 정확히 같으면 false를 반환한다 (엄격 < 이므로 경계값 제외)', () => {
    // minScale = 50/100 = 0.5, 조건은 < 0.5이므로 false
    expect(SteppedProcessor.shouldUseSteppedResize(100, 100, 50, 50)).toBe(false);
  });

  it('축소 비율이 임계값보다 아주 조금 작으면 true를 반환한다', () => {
    // minScale = 49/100 = 0.49 < 0.5
    expect(SteppedProcessor.shouldUseSteppedResize(100, 100, 49, 49)).toBe(true);
  });

  it('커스텀 임계값 미만이면 true를 반환한다', () => {
    // minScale = 25/100 = 0.25, threshold=0.3 → 0.25 < 0.3 → true
    expect(SteppedProcessor.shouldUseSteppedResize(100, 100, 25, 25, 0.3)).toBe(true);
  });

  it('커스텀 임계값 이상이면 false를 반환한다', () => {
    // minScale = 40/100 = 0.4, threshold=0.3 → 0.4 >= 0.3 → false
    expect(SteppedProcessor.shouldUseSteppedResize(100, 100, 40, 40, 0.3)).toBe(false);
  });

  it('X/Y 축소 비율 중 작은 쪽을 기준으로 판단한다', () => {
    // scaleX = 80/100 = 0.8, scaleY = 30/100 = 0.3 → minScale = 0.3 < 0.5 → true
    expect(SteppedProcessor.shouldUseSteppedResize(100, 100, 80, 30)).toBe(true);
  });
});

// ============================================================================
// estimateSteps — 단계 수 계산 및 maxSteps 클램프 분기
// ============================================================================

describe('SteppedProcessor.estimateSteps', () => {
  it('minScale이 0.5 이상이면 1단계(직접 리사이즈)를 반환한다', () => {
    // minScale = 60/100 = 0.6 >= 0.5 → 1
    expect(SteppedProcessor.estimateSteps(100, 100, 60, 60)).toBe(1);
  });

  it('minScale이 정확히 0.5이면 1단계를 반환한다', () => {
    // minScale = 50/100 = 0.5 → >= 0.5 조건으로 1 반환
    expect(SteppedProcessor.estimateSteps(100, 100, 50, 50)).toBe(1);
  });

  it('minScale = 0.25이면 2단계를 반환한다', () => {
    // log2(1/0.25) = log2(4) = 2, ceil(2) = 2 → min(10, 2) = 2
    expect(SteppedProcessor.estimateSteps(100, 100, 25, 25)).toBe(2);
  });

  it('minScale = 0.1이면 계산된 단계 수를 반환한다', () => {
    // log2(1/0.1) = log2(10) ≈ 3.32, ceil = 4 → min(10, 4) = 4
    expect(SteppedProcessor.estimateSteps(1000, 1000, 100, 100)).toBe(4);
  });

  it('이론적 단계 수가 기본 maxSteps(10)를 초과하면 10으로 클램프한다', () => {
    // minScale = 1/10000 = 0.0001 → log2(10000) ≈ 13.3, ceil = 14 → min(10, 14) = 10
    expect(SteppedProcessor.estimateSteps(10000, 10000, 1, 1)).toBe(10);
  });

  it('커스텀 maxSteps로 클램프한다', () => {
    // 이론 14단계, maxSteps=3 → 3
    expect(SteppedProcessor.estimateSteps(10000, 10000, 1, 1, 3)).toBe(3);
  });

  it('이론 단계 수가 maxSteps보다 적으면 이론 단계 수를 반환한다', () => {
    // minScale = 0.25 → 이론 2단계, maxSteps=10 → 2
    expect(SteppedProcessor.estimateSteps(100, 100, 25, 25, 10)).toBe(2);
  });

  it('minScale이 0.5 바로 아래(0.49)이면 1이 아닌 다단계를 반환한다', () => {
    // minScale = 49/100 = 0.49 < 0.5 → log2(1/0.49) ≈ 1.03, ceil = 2 → min(10, 2) = 2
    // shouldUseSteppedResize의 0.49 케이스와 대칭: 경계 바로 아래에서 분기가 달라짐을 검증
    expect(SteppedProcessor.estimateSteps(100, 100, 49, 49)).toBe(2);
  });
});

// ============================================================================
// calculateOptimalSteps — 단계 배열 계산(private)
// ============================================================================

describe('SteppedProcessor.calculateOptimalSteps — 단계 배열 계산', () => {
  it('minScale이 1 이상이면 축소 불필요로 [1]을 반환한다', () => {
    // 확대(>1) 또는 동일 크기(=1)는 단계 분할 없이 [1]
    expect((SteppedProcessor as any).calculateOptimalSteps(1, 10)).toEqual([1]);
    expect((SteppedProcessor as any).calculateOptimalSteps(1.5, 10)).toEqual([1]);
  });

  it('minScale<1이면 targetSteps 길이 배열을 만들고 마지막 단계는 정확히 minScale이다', () => {
    // minScale=0.1 → ceil(log2(10))=4단계, 마지막 단계는 정확한 목표 비율(minScale)
    const steps = (SteppedProcessor as any).calculateOptimalSteps(0.1, 10) as number[];
    expect(steps).toHaveLength(4);
    expect(steps[steps.length - 1]).toBeCloseTo(0.1, 10);
  });

  it('마지막을 제외한 중간 단계는 0.5 이상으로 바닥을 적용한다', () => {
    // 중간 단계는 Math.max(0.5, minScale**(i/targetSteps))로 한 번에 절반 이하로 줄지 않게 한다
    const steps = (SteppedProcessor as any).calculateOptimalSteps(0.1, 10) as number[];
    for (let i = 0; i < steps.length - 1; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('이론 단계 수가 maxSteps를 초과하면 maxSteps로 클램프한다', () => {
    // minScale=0.0001 → 이론 ceil(log2(10000))=14단계, maxSteps=10 → 10으로 클램프
    const steps = (SteppedProcessor as any).calculateOptimalSteps(0.0001, 10) as number[];
    expect(steps).toHaveLength(10);
    expect(steps[steps.length - 1]).toBeCloseTo(0.0001, 10);
  });
});

// ============================================================================
// resizeWithSteps — 잘못된 치수 입력 검증
// ============================================================================

describe('SteppedProcessor.resizeWithSteps — 잘못된 치수 입력', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('targetWidth가 0이면 RESIZE_FAILED 오류를 던지고 dimensions context를 포함한다', async () => {
    const img = createMockImage(200, 200);
    await expect(SteppedProcessor.resizeWithSteps(img, 0, 100)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { dimensions: { width: 0, height: 100 } },
    });
  });

  it('targetHeight가 음수이면 RESIZE_FAILED 오류를 던지고 dimensions context를 포함한다', async () => {
    const img = createMockImage(200, 200);
    await expect(SteppedProcessor.resizeWithSteps(img, 100, -1)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { dimensions: { width: 100, height: -1 } },
    });
  });

  it('source의 width가 0이면 RESIZE_FAILED 오류를 던지고 source dimensions context를 포함한다', async () => {
    const img = createMockImage(0, 200);
    await expect(SteppedProcessor.resizeWithSteps(img, 100, 100)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { dimensions: { width: 0, height: 200 } },
    });
  });

  it('source의 height가 0이면 RESIZE_FAILED 오류를 던지고 source dimensions context를 포함한다', async () => {
    const img = createMockImage(200, 0);
    await expect(SteppedProcessor.resizeWithSteps(img, 100, 100)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { dimensions: { width: 200, height: 0 } },
    });
  });
});

// ============================================================================
// performSteppedResize — canvasToCanvas 실패 래핑
// ============================================================================

describe('SteppedProcessor.performSteppedResize — canvasToCanvas 실패 래핑', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canvasToCanvas가 실패하면 RESIZE_FAILED와 stage context로 래핑한다', async () => {
    // imageToCanvas를 mock해 실제 drawImage 없이 stepped 경로만 타도록 한다
    vi.spyOn(SteppedProcessor as any, 'imageToCanvas').mockResolvedValue(document.createElement('canvas'));
    vi.spyOn(SteppedProcessor as any, 'canvasToCanvas').mockRejectedValue(new Error('drawImage 실패'));

    // minScale = 10/1000 = 0.01 < 0.5, quality:'high' → performSteppedResize 경로
    const img = createMockImage(1000, 1000);
    await expect(SteppedProcessor.resizeWithSteps(img, 10, 10, { quality: 'high' })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { debug: { stage: 'stepped reduction processing' } },
      cause: expect.objectContaining({ message: 'drawImage 실패' }),
    });
  });
});

// ============================================================================
// batchResizeWithSteps — 특정 index 실패 시 context 보존
// ============================================================================

describe('SteppedProcessor.batchResizeWithSteps — 실패 index context 보존', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('index 1 이미지 실패 시 batch processing stage와 index=1 context를 보존한다', async () => {
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(300, 300)];

    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockImplementation(async (img: HTMLImageElement) => {
      if (img.width === 200) {
        throw new Error('index 1 실패');
      }
      return document.createElement('canvas');
    });

    // concurrency=3으로 3개 이미지가 한 청크에서 병렬 처리되고 index 1이 실패한다
    await expect(SteppedProcessor.batchResizeWithSteps(images, 50, 50, { concurrency: 3 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { debug: { stage: 'batch processing', index: 1 } },
      cause: expect.objectContaining({ message: 'index 1 실패' }),
    });
  });
});

// ============================================================================
// memoryEfficientResize — 메모리 한도 및 stepped 옵션 분기
// ============================================================================

describe('SteppedProcessor.memoryEfficientResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('target pixels가 메모리 한도를 초과하면 FILE_TOO_LARGE를 던진다', async () => {
    // maxMemoryMB=1 → maxPixels = 1*1024*1024/4 = 262,144
    // target = 1000*1000 = 1,000,000 > 262,144 → FILE_TOO_LARGE
    const img = createMockImage(5000, 5000);
    await expect(SteppedProcessor.memoryEfficientResize(img, 1000, 1000, 1)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('target pixels가 maxPixels와 정확히 같으면 FILE_TOO_LARGE를 던지지 않는다 (엄격 > 비교)', async () => {
    // maxMemoryMB=1 → maxPixels=262144, 512*512=262144=maxPixels → 262144 > 262144 = false → 통과
    // >=로 회귀하면 이 케이스에서 FILE_TOO_LARGE가 발생해 잡힌다
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(document.createElement('canvas'));
    const img = createMockImage(5000, 5000);
    await expect(SteppedProcessor.memoryEfficientResize(img, 512, 512, 1)).resolves.toBeDefined();
  });

  it('target pixels가 maxPixels를 초과하면 FILE_TOO_LARGE를 던진다 (경계 바로 위)', async () => {
    // maxMemoryMB=1 → maxPixels=262144, 513*512=262656 > 262144 → 던짐
    // < 또는 <= 로 회귀하면 이 케이스가 FILE_TOO_LARGE를 못 잡아 실패한다
    const img = createMockImage(5000, 5000);
    await expect(SteppedProcessor.memoryEfficientResize(img, 513, 512, 1)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('source가 stepDimension 이하이면 resizeWithSteps에 quality:high만 전달한다 (maxSteps/minStepRatio 없음)', async () => {
    // maxMemoryMB=1 → stepPixelLimit=min(10000, 209715.2)=10000, stepDimension=floor(sqrt(10000))=100
    // max(100,100)=100 <= 100 → 직접 처리 분기: { quality: 'high' } 만 전달
    // maxSteps:15 분기에 quality:high를 추가해도 엄격 매치에서 바로 잡힌다
    const resizeWithStepsSpy = vi
      .spyOn(SteppedProcessor, 'resizeWithSteps')
      .mockResolvedValue(document.createElement('canvas'));

    const img = createMockImage(100, 100);
    await SteppedProcessor.memoryEfficientResize(img, 50, 50, 1);

    expect(resizeWithStepsSpy).toHaveBeenCalledWith(img, 50, 50, { quality: 'high' });
  });

  it('source가 stepDimension보다 크면 resizeWithSteps에 maxSteps:15, minStepRatio:0.3을 전달한다', async () => {
    // maxMemoryMB=1 → maxPixels=262144 → stepPixelLimit=min(1000000, 209715.2)=209715.2
    // stepDimension=floor(sqrt(209715.2))=457
    // max(1000,1000)=1000 > 457 → stepped 분기, target=100*100=10000 < 262144 → FILE_TOO_LARGE 아님
    const resizeWithStepsSpy = vi
      .spyOn(SteppedProcessor, 'resizeWithSteps')
      .mockResolvedValue(document.createElement('canvas'));

    const img = createMockImage(1000, 1000);
    await SteppedProcessor.memoryEfficientResize(img, 100, 100, 1);

    expect(resizeWithStepsSpy).toHaveBeenCalledWith(img, 100, 100, {
      quality: 'high',
      maxSteps: 15,
      minStepRatio: 0.3,
    });
  });
});
