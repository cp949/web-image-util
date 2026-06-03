/**
 * 필터 블렌딩 helper의 픽셀 합성 규칙을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { applyBlendMode, applyOpacity } from '../../../src/filters/filter-blending.internal';
import { BlendMode } from '../../../src/filters/plugin-system';
import { createSinglePixelImageData } from './plugin-system-helpers';

describe('filter-blending helper', () => {
  it('MULTIPLY는 원본과 필터 RGB 값을 곱한다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(200, 100, 50);
    const result = applyBlendMode(original, filtered, BlendMode.MULTIPLY);

    expect(Array.from(result.data)).toEqual([
      Math.round((200 / 255) * (200 / 255) * 255),
      Math.round((100 / 255) * (100 / 255) * 255),
      Math.round((50 / 255) * (50 / 255) * 255),
      255,
    ]);
  });

  it('opacity는 원본과 필터 RGB 값을 선형 보간한다', () => {
    const original = createSinglePixelImageData(0, 20, 40);
    const filtered = createSinglePixelImageData(100, 120, 140);
    const result = applyOpacity(original, filtered, 0.5);

    expect(Array.from(result.data)).toEqual([50, 70, 90, 255]);
  });
});
