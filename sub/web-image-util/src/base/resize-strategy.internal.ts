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

/** 전략 adapter — 전략별 튜닝 지식은 전부 여기 산다 */
export interface ResizeStrategyAdapter {
  readonly id: ProcessingStrategy;
  /** validateProcessingCapability의 예상 소요시간 배수 */
  readonly timeMultiplier: number;
  execute(input: ResizeStrategyInput): Promise<HTMLCanvasElement>;
}

const directAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.DIRECT,
  timeMultiplier: 1.0,
  async execute({ img, targetWidth, targetHeight, quality }) {
    // 결과 canvas는 호출자 소유 — pool을 거치지 않는다
    const { canvas, ctx } = createOwnedCanvas(targetWidth, targetHeight);
    applySmoothing(ctx, quality);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas;
  },
};

const chunkedAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.CHUNKED,
  timeMultiplier: 1.0,
  async execute({ img, targetWidth, targetHeight, quality, analysis, onProgress }) {
    return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
      tileSize: Math.min(2048, analysis.recommendedChunkSize),
      quality,
      onProgress,
      // 청크 경로는 메모리 절약이 목적이라 동시성을 늘리지 않는다
      maxConcurrency: 2,
    });
  },
};

const steppedAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.STEPPED,
  timeMultiplier: 1.5,
  async execute({ img, targetWidth, targetHeight, quality }) {
    return SteppedProcessor.resizeWithSteps(img, targetWidth, targetHeight, {
      quality,
      maxSteps: quality === 'high' ? 15 : 8,
    });
  },
};

const tiledAdapter: ResizeStrategyAdapter = {
  id: ProcessingStrategy.TILED,
  timeMultiplier: 2.0,
  async execute({ img, targetWidth, targetHeight, quality, onProgress }) {
    return TiledProcessor.resizeInTiles(img, targetWidth, targetHeight, {
      quality,
      onProgress,
      enableMemoryMonitoring: true,
      maxConcurrency: quality === 'fast' ? 4 : 2,
    });
  },
};

/** 전략 → adapter 레지스트리 */
export const RESIZE_STRATEGY_ADAPTERS: Record<ProcessingStrategy, ResizeStrategyAdapter> = {
  direct: directAdapter,
  chunked: chunkedAdapter,
  stepped: steppedAdapter,
  tiled: tiledAdapter,
};

export function getResizeStrategyAdapter(strategy: ProcessingStrategy): ResizeStrategyAdapter | undefined {
  const adapter = RESIZE_STRATEGY_ADAPTERS[strategy];
  return adapter?.id === strategy ? adapter : undefined;
}
