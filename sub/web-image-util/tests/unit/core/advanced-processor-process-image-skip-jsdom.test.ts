/**
 * AdvancedImageProcessor.processImage에서 빈 필터와 빈 워터마크 옵션이
 * 처리 단계를 건너뛰는 분기를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor, filterManager } from '../../../src/advanced-index';
import { createDrawableSource } from './advanced-processor-branches.helpers';

// ==========================================================================
// processImage 단계 스킵 분기 — 기존 테스트 미커버 경로만
// ==========================================================================
describe('processImage 단계 스킵 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters.filters가 빈 배열이면 필터 블록을 건너뛴다 (applyFilterChain 미호출)', async () => {
    // options.filters는 존재하지만 filters.length === 0 → 필터 블록을 건너뜀
    // filtersApplied === 0 단독으로는 실행/스킵을 구분 못 하므로 spy로 직접 검증
    const applyChainSpy = vi.spyOn(filterManager, 'applyFilterChain');

    const source = createDrawableSource(100, 100);
    const result = await AdvancedImageProcessor.processImage(source, {
      filters: { filters: [] },
    });

    expect(result.processing.filtersApplied).toBe(0);
    expect(applyChainSpy).not.toHaveBeenCalled();
  });

  it('watermark 객체가 있지만 text · image 모두 없으면 watermarkApplied가 false이다', async () => {
    // options.watermark는 truthy지만 text·image 둘 다 없어 watermarkApplied가 설정되지 않음
    const source = createDrawableSource(100, 100);
    const result = await AdvancedImageProcessor.processImage(source, {
      watermark: {},
    });

    expect(result.processing.watermarkApplied).toBe(false);
  });

  it('watermark 객체가 있지만 text · image 모두 없으면 "Watermark applied." 메시지가 없다', async () => {
    const source = createDrawableSource(100, 100);
    const result = await AdvancedImageProcessor.processImage(source, {
      watermark: {},
    });

    expect(result.messages).not.toContain('Watermark applied.');
  });
});
