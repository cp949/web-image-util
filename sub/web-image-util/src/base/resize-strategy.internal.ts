/**
 * 고해상도 리사이즈 전략 seam.
 *
 * HighResolutionManager는 전략 선택만 하고, 전략 실행 방법과 전략별 튜닝 지식
 * (품질 매핑·단계 수·동시성·타일 크기·예상 시간 배수)은 전부 adapter 안에 산다.
 * 전략 추가 = adapter 1개 + RESIZE_STRATEGY_ADAPTERS 맵 1행.
 */

import { applySmoothing, createOwnedCanvas, type SmoothingQuality } from './canvas-utils.internal';
import type { ImageAnalysis } from './high-res-detector.internal';
import { ProcessingStrategy } from './high-res-detector.internal';
import { SteppedProcessor } from './stepped-processor.internal';
import { TiledProcessor } from './tiled-processor.internal';

/** 전략 실행 입력 — 매니저가 조립해서 adapter에 넘긴다 */
export interface ResizeStrategyInput {
  img: HTMLImageElement;
  targetWidth: number;
  targetHeight: number;
  quality: SmoothingQuality;
  /** 매니저의 사전 분석 결과 재사용 — adapter가 재분석하지 않는다 */
  analysis: ImageAnalysis;
  onProgress?: (current: number, total: number) => void;
}

/** tiled 실행의 타일 크기·동시성 프리셋을 가르는 경계 — high-res-detector.internal.ts의
 * MEDIUM 임계값(64MB)과 같은 값이다(새 숫자를 만들지 않는다). */
const TILED_LIGHT_THRESHOLD_MB = 64;

/** 전략 adapter — 전략별 튜닝 지식은 전부 여기 산다 */
export interface ResizeStrategyAdapter {
  readonly id: ProcessingStrategy;
  /** validateProcessingCapability의 예상 소요시간 배수. tiled는 preset에 따라 갈리므로 analysis를 받는다. */
  getTimeMultiplier(analysis: ImageAnalysis): number;
  execute(input: ResizeStrategyInput): Promise<HTMLCanvasElement>;
}

const directAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.DIRECT,
  getTimeMultiplier: () => 1.0,
  async execute({ img, targetWidth, targetHeight, quality }) {
    // 결과 canvas는 호출자 소유 — pool을 거치지 않는다
    const { canvas, ctx } = createOwnedCanvas(targetWidth, targetHeight);
    applySmoothing(ctx, quality);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas;
  },
};

const steppedAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.STEPPED,
  getTimeMultiplier: () => 1.5,
  async execute({ img, targetWidth, targetHeight, quality }) {
    return SteppedProcessor.resizeWithSteps(img, targetWidth, targetHeight, {
      quality,
      maxSteps: quality === 'high' ? 15 : 8,
    });
  },
};

const tiledAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.TILED,
  getTimeMultiplier: (analysis) => (analysis.estimatedMemoryMB <= TILED_LIGHT_THRESHOLD_MB ? 1.0 : 2.0),
  async execute({ img, targetWidth, targetHeight, quality, analysis, onProgress }) {
    // light: 옛 chunkedAdapter 프리셋(작은 타일, 동시성 고정) — 메모리 절약이 목적이라 동시성을 늘리지 않는다
    // heavy: 옛 tiledAdapter 프리셋(기본 타일 크기, quality 따라 동시성)
    const preset =
      analysis.estimatedMemoryMB <= TILED_LIGHT_THRESHOLD_MB
        ? { tileSize: Math.min(2048, analysis.recommendedChunkSize), maxConcurrency: 2 }
        : { maxConcurrency: quality === 'fast' ? 4 : 2 };

    return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
      ...preset,
      quality,
      onProgress,
      enableMemoryMonitoring: true,
    });
  },
};

/** 전략 → adapter 레지스트리 */
export const RESIZE_STRATEGY_ADAPTERS: Record<ProcessingStrategy, ResizeStrategyAdapter> = {
  direct: directAdapter,
  stepped: steppedAdapter,
  tiled: tiledAdapter,
};

export function getResizeStrategyAdapter(strategy: ProcessingStrategy): ResizeStrategyAdapter | undefined {
  const adapter = RESIZE_STRATEGY_ADAPTERS[strategy];
  return adapter?.id === strategy ? adapter : undefined;
}
