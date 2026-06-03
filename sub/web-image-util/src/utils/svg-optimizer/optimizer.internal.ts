/**
 * SVG 최적화 오케스트레이터.
 *
 * 책임별로 분리된 단계 모듈(`removeMetadata`/`simplifyPaths`/`optimizeGradients`/
 * `removeUnusedDefs`/`cleanupWhitespace`)을 옵션에 따라 순서대로 적용하고,
 * 처리 시간과 압축률 등을 담은 결과를 반환한다.
 *
 * 외부 공개 API는 `SvgOptimizer` 클래스로 유지된다(기존 정적 메서드 호환).
 */

import { productionLog } from '../debug.internal';
import { cleanupWhitespace } from './cleanup-whitespace.internal';
import { optimizeGradients } from './optimize-gradients.internal';
import { removeMetadata } from './remove-metadata.internal';
import { removeUnusedDefs } from './remove-unused-defs.internal';
import { simplifyPaths } from './simplify-paths.internal';
import type { OptimizationResult, SvgOptimizationOptions } from './types';

/**
 * SVG 최적화 엔진.
 *
 * 벡터 그래픽 렌더링 품질 향상을 위한 전처리 최적화를 수행한다.
 */
export class SvgOptimizer {
  /**
   * 기본 최적화 옵션을 반환한다.
   */
  static getDefaultOptions(): SvgOptimizationOptions {
    return {
      removeMetadata: true,
      simplifyPaths: true,
      optimizeGradients: true,
      // 안전을 위해 기본값은 false.
      mergeElements: false,
      removeUnusedDefs: true,
      // 소수점 3자리 유지.
      precision: 3,
    };
  }

  /**
   * SVG 최적화를 실행한다.
   *
   * @param svgString 원본 SVG 문자열
   * @param options 최적화 옵션
   * @returns 최적화된 SVG와 결과 정보
   */
  static optimize(
    svgString: string,
    options: SvgOptimizationOptions = SvgOptimizer.getDefaultOptions()
  ): { optimizedSvg: string; result: OptimizationResult } {
    const startTime = performance.now();
    const originalSize = svgString.length;
    let optimizedSvg = svgString;
    const optimizations: string[] = [];

    try {
      // 1. 메타데이터 제거.
      if (options.removeMetadata) {
        optimizedSvg = removeMetadata(optimizedSvg);
        optimizations.push('metadata removal');
      }

      // 2. path 단순화.
      if (options.simplifyPaths) {
        optimizedSvg = simplifyPaths(optimizedSvg, options.precision);
        optimizations.push('path simplification');
      }

      // 3. 그라디언트 최적화.
      if (options.optimizeGradients) {
        optimizedSvg = optimizeGradients(optimizedSvg);
        optimizations.push('gradient optimization');
      }

      // 4. 사용되지 않는 정의 제거.
      if (options.removeUnusedDefs) {
        optimizedSvg = removeUnusedDefs(optimizedSvg);
        optimizations.push('unused definitions removal');
      }

      // 5. 공백 정리.
      optimizedSvg = cleanupWhitespace(optimizedSvg);
      optimizations.push('whitespace cleanup');

      const optimizedSize = optimizedSvg.length;
      const processingTimeMs = performance.now() - startTime;

      return {
        optimizedSvg,
        result: {
          originalSize,
          optimizedSize,
          compressionRatio: (originalSize - optimizedSize) / originalSize,
          optimizations,
          processingTimeMs,
        },
      };
    } catch (error) {
      // 최적화 실패 시 원본을 그대로 반환한다.
      productionLog.warn('Error occurred during SVG optimization:', error);
      const processingTimeMs = performance.now() - startTime;

      return {
        optimizedSvg: svgString,
        result: {
          originalSize,
          optimizedSize: originalSize,
          compressionRatio: 0,
          optimizations: ['optimization failed - returned original'],
          processingTimeMs,
        },
      };
    }
  }
}
