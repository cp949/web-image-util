/**
 * SteppedProcessor 단위 테스트
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SteppedProcessor } from '../../../src/base/stepped-processor';

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
