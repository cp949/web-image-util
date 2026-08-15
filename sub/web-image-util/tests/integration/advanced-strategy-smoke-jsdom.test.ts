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
import { RESIZE_STRATEGY_ADAPTERS } from '../../src/base/resize-strategy.internal';
import { SteppedProcessor } from '../../src/base/stepped-processor.internal';
import { TiledProcessor } from '../../src/base/tiled-processor.internal';
import { createTestCanvas } from '../utils/canvas-helper';

describe('advanced 공개 API 종단 경로 스모크 테스트 — 모킹 없음', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forceStrategy: "tiled"를 지정하면 실제 TiledProcessor 실행까지 관통해 목표 크기 캔버스를 반환한다', async () => {
    // pass-through spy: 구현은 그대로 두고 "실제로 호출됐는가"만 관찰한다
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles');

    // 소스 32×32 → 타깃 4×4 (배율 8 > 기본 임계값 4)로 고해상도 게이트를 연다.
    // thresholds 오버라이드 대신 실제 사용 시나리오(scaleRatio)로 게이트를 통과시킨다.
    const img = createTestCanvas(32, 32, '#3399ff') as unknown as HTMLImageElement;
    const result = await AutoHighResProcessor.smartResize(img, 4, 4, {
      forceStrategy: 'tiled',
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    // AutoHighResProcessor.smartResize는 leaf가 던지면 DIRECT 폴백(standardResize)으로
    // 조용히 전환된다 — 폴백도 크기가 맞는 캔버스를 실제로 그려내므로 위 크기/alpha
    // 검증만으로는 "leaf가 정말 실행됐는지"와 "폴백이 대신 그렸는지"를 구분할 수 없다.
    // pass-through spy가 기록한 실제 반환 canvas와 result.canvas의 객체 동일성을
    // 확인해 leaf의 결과물이 그대로 흘러나왔음을 증명한다.
    expect(result.canvas).toBe(await tiledSpy.mock.results[0]?.value);
    expect(result.canvas.width).toBe(4);
    expect(result.canvas.height).toBe(4);
    expect(result.optimizations.tileProcessing).toBe(true);
  });

  it('forceStrategy: "stepped"를 지정하면 실제 SteppedProcessor 실행까지 관통해 목표 크기 캔버스를 반환한다', async () => {
    const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps');

    const img = createTestCanvas(32, 32, '#3399ff') as unknown as HTMLImageElement;
    const result = await AutoHighResProcessor.smartResize(img, 4, 4, {
      forceStrategy: 'stepped',
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    // tiled 테스트와 동일한 이유로, 폴백과 구분하기 위해 canvas 객체 동일성을 확인한다.
    expect(result.canvas).toBe(await steppedSpy.mock.results[0]?.value);
    expect(result.canvas.width).toBe(4);
    expect(result.canvas.height).toBe(4);
  });

  it('RESIZE_STRATEGY_ADAPTERS에 새 전략이 추가되면 이 스모크 파일도 갱신해야 함을 알려준다', () => {
    // 새 전략이 registry에 추가되는데 이 파일에 대응 케이스가 없으면 여기서 실패한다.
    // 실패 시 design 문서(2026-08-15-advanced-strategy-smoke-design.md)의
    // "재검토 조건"에 따라 새 전략용 forceStrategy 테스트를 추가한다.
    expect(Object.keys(RESIZE_STRATEGY_ADAPTERS).sort()).toEqual(['direct', 'stepped', 'tiled']);
  });
});
