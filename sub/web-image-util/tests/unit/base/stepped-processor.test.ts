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
