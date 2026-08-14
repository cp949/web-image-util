/**
 * advanced 공개 API 진입점(AutoHighResProcessor.smartResize)에서 실제
 * TiledProcessor/SteppedProcessor 실행까지 모킹 없이 관통하는지 확인하는
 * 스모크 테스트다.
 *
 * 기존 계약 테스트(auto-high-res.smart-resize.test.ts,
 * high-res-manager-smart-resize-strategy-jsdom.test.ts)는 층마다 바로 아래
 * 층을 vi.spyOn(...).mockResolvedValue(...)로 걷어내 "호출 인자가 맞는가"만
 * 검증한다 — 레이어 사이 실제 배선이 끊겨도 통과한다. 이 파일은
 * mockImplementation 없는 pass-through spy(구현은 그대로 두고 호출 여부만
 * 관찰하는 spy)만 사용해 공개 API → HighResolutionManager → 실제 leaf
 * 프로세서까지 실행이 이어지는지 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoHighResProcessor } from '../../src/advanced-index';
import { SteppedProcessor } from '../../src/base/stepped-processor.internal';
import { TiledProcessor } from '../../src/base/tiled-processor.internal';

/**
 * drawImage 소스로 사용 가능한 단색 canvas 픽스처를 만든다.
 * jsdom + node-canvas 환경에서 HTMLImageElement는 src 없이 drawImage에 쓸 수
 * 없으므로, canvas를 HTMLImageElement로 캐스팅해 대신 사용한다(다른
 * jsdom 스모크 테스트와 동일한 관례 — tests/unit/base/tiled-processor.helpers.ts).
 */
function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3399ff';
  ctx.fillRect(0, 0, width, height);
  return canvas as unknown as HTMLImageElement;
}

describe('advanced 공개 API 종단 경로 스모크 테스트 — 모킹 없음', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forceStrategy: "tiled"를 지정하면 실제 TiledProcessor 실행까지 관통해 목표 크기 캔버스를 반환한다', async () => {
    // pass-through spy: 구현은 그대로 두고 "실제로 호출됐는가"만 관찰한다
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles');

    // 소스 32×32 → 타깃 4×4 (배율 8 > 기본 임계값 4)로 고해상도 게이트를 연다.
    // thresholds 오버라이드 대신 실제 사용 시나리오(scaleRatio)로 게이트를 통과시킨다.
    const img = createDrawableImage(32, 32);
    const result = await AutoHighResProcessor.smartResize(img, 4, 4, {
      forceStrategy: 'tiled',
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    expect(result.canvas.width).toBe(4);
    expect(result.canvas.height).toBe(4);
    expect(result.optimizations.tileProcessing).toBe(true);

    // 레이어 배선이 끊겨 크기만 맞는 빈 캔버스가 반환되는 회귀를 잡는다.
    const ctx = result.canvas.getContext('2d')!;
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    expect(pixel[3]).toBeGreaterThan(0); // alpha: 완전 투명(빈 캔버스)이 아니다
  });

  it('forceStrategy: "stepped"를 지정하면 실제 SteppedProcessor 실행까지 관통해 목표 크기 캔버스를 반환한다', async () => {
    const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps');

    const img = createDrawableImage(32, 32);
    const result = await AutoHighResProcessor.smartResize(img, 4, 4, {
      forceStrategy: 'stepped',
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    expect(result.canvas.width).toBe(4);
    expect(result.canvas.height).toBe(4);

    const ctx = result.canvas.getContext('2d')!;
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    expect(pixel[3]).toBeGreaterThan(0);
  });
});
