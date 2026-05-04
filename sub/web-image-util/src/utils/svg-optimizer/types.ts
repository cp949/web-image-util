/**
 * SVG 최적화 옵션과 결과 타입 정의 모듈.
 *
 * 각 단계별 최적화 모듈과 오케스트레이터(`SvgOptimizer`)가 공유하는 공개 타입만 둔다.
 */

export interface SvgOptimizationOptions {
  /** 메타데이터(주석, 불필요한 속성)를 제거한다. */
  removeMetadata: boolean;
  /** path 데이터를 단순화한다(소수점 자릿수 축소, 공백 정리). */
  simplifyPaths: boolean;
  /** 중복 그라디언트를 병합·최적화한다. */
  optimizeGradients: boolean;
  /** 유사한 요소를 병합한다. */
  mergeElements: boolean;
  /** 사용되지 않는 정의(defs)를 제거한다. */
  removeUnusedDefs: boolean;
  /** 수치 정밀도(소수점 자릿수). */
  precision: number;
}

export interface OptimizationResult {
  /** 원본 SVG 크기(문자열 길이). */
  originalSize: number;
  /** 최적화 후 SVG 크기. */
  optimizedSize: number;
  /** 압축률(0-1). */
  compressionRatio: number;
  /** 적용된 최적화 항목 목록. */
  optimizations: string[];
  /** 처리 시간(밀리초). */
  processingTimeMs: number;
}
