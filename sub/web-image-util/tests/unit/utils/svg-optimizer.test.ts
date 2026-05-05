/**
 * SVG 최적화 오케스트레이터가 단계 옵션과 결과 metadata를 안정적으로 반환하는지 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { SvgOptimizer } from '../../../src/utils/svg-optimizer';

describe('SVG 최적화', () => {
  it('기본 옵션은 안전한 단계들을 켜고 요소 병합은 끈다', () => {
    expect(SvgOptimizer.getDefaultOptions()).toEqual({
      removeMetadata: true,
      simplifyPaths: true,
      optimizeGradients: true,
      mergeElements: false,
      removeUnusedDefs: true,
      precision: 3,
    });
  });

  it('기본 최적화는 메타데이터와 불필요한 공백을 제거하고 결과 metadata를 반환한다', () => {
    const svg = `
      <?xml version="1.0"?>
      <!-- editor comment -->
      <svg width="10" height="10" xmlns:dc="http://purl.org/dc/elements/1.1/" data-name="sample">
        <title>sample title</title>
        <desc>sample description</desc>
        <rect id="box" x="0" y="0" width="10" height="10" style="" />
      </svg>
    `;

    const { optimizedSvg, result } = SvgOptimizer.optimize(svg);

    expect(optimizedSvg).toContain('<svg');
    expect(optimizedSvg).toContain('<rect');
    expect(optimizedSvg).not.toContain('<?xml');
    expect(optimizedSvg).not.toContain('editor comment');
    expect(optimizedSvg).not.toContain('<title>');
    expect(optimizedSvg).not.toContain('data-name');
    expect(optimizedSvg).not.toContain('id="box"');
    expect(result.originalSize).toBe(svg.length);
    expect(result.optimizedSize).toBe(optimizedSvg.length);
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.optimizations).toEqual([
      'metadata removal',
      'path simplification',
      'gradient optimization',
      'unused definitions removal',
      'whitespace cleanup',
    ]);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('단계 옵션을 끄면 해당 최적화 이름과 결과 변환을 생략한다', () => {
    const svg = '<svg><title>keep</title><rect id="box" width="10" height="10" /></svg>';

    const { optimizedSvg, result } = SvgOptimizer.optimize(svg, {
      removeMetadata: false,
      simplifyPaths: false,
      optimizeGradients: false,
      mergeElements: false,
      removeUnusedDefs: false,
      precision: 3,
    });

    expect(optimizedSvg).toBe('<svg><title>keep</title><rect id="box" width="10" height="10" /></svg>');
    expect(result.optimizations).toEqual(['whitespace cleanup']);
    expect(result.compressionRatio).toBe(0);
  });
});
