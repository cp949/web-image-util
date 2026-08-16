/**
 * 고해상도 리사이즈 전략 선택 정책 — quality tier(fast/balanced/high) × memory-pressure 표를
 * 한 곳에 모은 leaf.
 *
 * high-res-detector.internal.ts(analyzeImage의 balanced 기본값)와 high-res-manager.ts
 * (quality별 override)가 이 모듈을 공유한다. 두 파일은 서로 import하지 않고 이 leaf만
 * 바라보므로 순환 참조가 없다. 여기 숫자를 바꾸면 두 caller 모두 즉시 반영된다.
 *
 * 4개 티어 함수 전부 첫 줄에서 exceedsMaxSafeDimension()을 거친다 — 이전엔 balanced만
 * 캔버스 크기 한계를 체크하고 fast/high/memory-pressure는 건너뛰어, 극단적 종횡비(가로/세로
 * 하나만 매우 크고 메모리 총량은 작은) 이미지에서 canvas 디코드 한계를 넘는 DIRECT/STEPPED를
 * 고를 수 있었다. 이 가드를 공통화해 그 latent 격차를 없앤다.
 * estimatedMemoryMB의 반올림 여부는 호출자가 결정한다. 함수들은 전달받은 값을 그대로 비교한다.
 */

export type ProcessingStrategy = 'direct' | 'stepped' | 'tiled';

export const ProcessingStrategy = {
  DIRECT: 'direct' as const,
  STEPPED: 'stepped' as const,
  TILED: 'tiled' as const,
} as const;

/** ≤이 값이면 direct, 초과면 tiled로 갈리는 balanced 최하단 경계 */
export const SMALL_MEMORY_THRESHOLD_MB = 16;
/** balanced의 tiled/stepped 경계이자 fast의 direct/tiled 경계 */
export const MEDIUM_MEMORY_THRESHOLD_MB = 64;
/** balanced의 stepped/tiled 경계이자 high의 stepped/tiled 경계 */
export const LARGE_MEMORY_THRESHOLD_MB = 256;
/** memory-pressure(저메모리 강제 경로) 전용 direct/tiled 경계 — 다른 3개 임계값과 값이
 * 우연히도 겹치지 않는 독립 정책값이다(재조사 결과, 2026-08-15 design doc 결론 유지).
 * chunked가 tiled 프리셋으로 흡수되기 전엔 128MB 분기도 따로 있었다 — 그 분기가 tiled로
 * 수렴하면서 32MB만 direct/tiled를 가르는 경계로 남았다. */
export const MEMORY_EFFICIENT_THRESHOLD_MB = 32;
/** high 티어에서 stepped를 선택하는 축소 비율 상한 */
export const HIGH_QUALITY_STEPPED_SCALE_RATIO = 0.3;

/** 소스 이미지 가로/세로가 브라우저 Canvas 디코드 한계를 넘는지 — 넘으면 메모리 크기와
 * 무관하게 타일링이 강제돼야 한다. 4개 티어 함수가 전부 이 가드를 첫 줄에서 통과한다. */
export function exceedsMaxSafeDimension(width: number, height: number, maxSafeDimension: number): boolean {
  return width > maxSafeDimension || height > maxSafeDimension;
}

/** balanced(기본값) 티어 — high-res-detector.internal.ts의 analyzeImage()가 호출한다 */
export function selectBalancedStrategy(
  estimatedMemoryMB: number,
  width: number,
  height: number,
  maxSafeDimension: number
): ProcessingStrategy {
  if (exceedsMaxSafeDimension(width, height, maxSafeDimension)) {
    return ProcessingStrategy.TILED;
  }
  if (estimatedMemoryMB <= SMALL_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.DIRECT;
  } else if (estimatedMemoryMB <= MEDIUM_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.TILED;
  } else if (estimatedMemoryMB <= LARGE_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.STEPPED;
  } else {
    return ProcessingStrategy.TILED;
  }
}

/** fast(quality:'fast') 티어 — 가장 단순한 전략을 우선한다 */
export function selectFastStrategy(
  estimatedMemoryMB: number,
  width: number,
  height: number,
  maxSafeDimension: number
): ProcessingStrategy {
  if (exceedsMaxSafeDimension(width, height, maxSafeDimension)) {
    return ProcessingStrategy.TILED;
  }
  if (estimatedMemoryMB <= MEDIUM_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.DIRECT;
  }
  return ProcessingStrategy.TILED;
}

/** memory-pressure(isMemoryLow() 감지) 티어 — quality 설정과 무관하게 이 함수가 적용된다 */
export function selectMemoryEfficientStrategy(
  estimatedMemoryMB: number,
  width: number,
  height: number,
  maxSafeDimension: number
): ProcessingStrategy {
  if (exceedsMaxSafeDimension(width, height, maxSafeDimension)) {
    return ProcessingStrategy.TILED;
  }
  if (estimatedMemoryMB > MEMORY_EFFICIENT_THRESHOLD_MB) {
    return ProcessingStrategy.TILED;
  }
  return ProcessingStrategy.DIRECT;
}

/** high(quality:'high') 티어 — 큰 폭 축소는 stepped가 품질에 유리하다.
 * scaleRatio(축소 비율)와 estimatedMemoryMB 둘 다 stepped/tiled 어느 쪽 조건도
 * 만족시키지 않으면 balancedFallback(호출자가 이미 계산해 둔 balanced 결과)을 그대로 쓴다. */
export function selectHighQualityStrategy(
  estimatedMemoryMB: number,
  width: number,
  height: number,
  maxSafeDimension: number,
  scaleRatio: number,
  balancedFallback: ProcessingStrategy
): ProcessingStrategy {
  if (exceedsMaxSafeDimension(width, height, maxSafeDimension)) {
    return ProcessingStrategy.TILED;
  }
  if (scaleRatio < HIGH_QUALITY_STEPPED_SCALE_RATIO && estimatedMemoryMB <= LARGE_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.STEPPED;
  }
  if (estimatedMemoryMB > LARGE_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.TILED;
  }
  return balancedFallback;
}
