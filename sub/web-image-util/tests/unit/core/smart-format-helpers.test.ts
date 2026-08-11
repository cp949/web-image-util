/**
 * SmartFormatSelector 내부 점수 계산 헬퍼를 검증한다.
 */

import { describe, expect, it } from 'vitest';
import type { ImageAnalysis } from '../../../src/core/smart-format-helpers.internal';
import {
  calculateFormatScores,
  ImagePurpose,
  mergeSmartFormatOptions,
  resolveRecommendedQuality,
} from '../../../src/core/smart-format-helpers.internal';
import { ImageFormats } from '../../../src/types';

const graphicAnalysis: ImageAnalysis = {
  hasTransparency: false,
  colorComplexity: 0.1,
  hasPhotographicContent: false,
  dominantColors: 10,
  sharpEdges: true,
};

describe('smart-format 내부 헬퍼', () => {
  it('mergeSmartFormatOptions: purpose 기본값과 사용자 옵션을 병합한다', () => {
    const options = mergeSmartFormatOptions({
      purpose: ImagePurpose.THUMBNAIL,
      allowedFormats: [ImageFormats.JPEG],
    });

    expect(options.purpose).toBe(ImagePurpose.THUMBNAIL);
    expect(options.maxSizeKB).toBe(50);
    expect(options.qualityPriority).toBe(0.3);
    expect(options.allowedFormats).toEqual([ImageFormats.JPEG]);
  });

  it('resolveRecommendedQuality: purpose와 qualityPriority를 반영한다', () => {
    const thumbnailOptions = mergeSmartFormatOptions({
      purpose: ImagePurpose.THUMBNAIL,
      allowedFormats: [ImageFormats.JPEG],
    });
    const archiveOptions = mergeSmartFormatOptions({
      purpose: ImagePurpose.ARCHIVE,
      allowedFormats: [ImageFormats.JPEG],
    });

    expect(resolveRecommendedQuality(ImageFormats.JPEG, thumbnailOptions)).toBe(0.72);
    expect(resolveRecommendedQuality(ImageFormats.JPEG, archiveOptions)).toBe(1);
  });

  it('calculateFormatScores: 그래픽 이미지에서는 WebP가 JPEG보다 높은 점수를 받는다', () => {
    const options = mergeSmartFormatOptions({
      allowedFormats: [ImageFormats.JPEG, ImageFormats.WEBP],
    });

    const scores = calculateFormatScores([ImageFormats.JPEG, ImageFormats.WEBP], graphicAnalysis, false, options);

    expect(scores[0].format).toBe(ImageFormats.WEBP);
    expect(scores[0].score).toBeGreaterThan(scores[1].score);
  });

  it('calculateFormatScores: 투명도 보존 시 JPEG는 PNG보다 낮은 점수를 받는다', () => {
    const options = mergeSmartFormatOptions({
      allowedFormats: [ImageFormats.JPEG, ImageFormats.PNG],
      preserveTransparency: true,
    });

    const scores = calculateFormatScores([ImageFormats.JPEG, ImageFormats.PNG], graphicAnalysis, true, options);

    expect(scores[0].format).toBe(ImageFormats.PNG);
    expect(scores[scores.length - 1]?.format).toBe(ImageFormats.JPEG);
  });

  it('calculateFormatScores: maxSizeKB가 있으면 압축 효율 포맷에 size score를 더한다', () => {
    const looseOptions = mergeSmartFormatOptions({
      allowedFormats: [ImageFormats.PNG, ImageFormats.WEBP],
    });
    const strictOptions = mergeSmartFormatOptions({
      allowedFormats: [ImageFormats.PNG, ImageFormats.WEBP],
      maxSizeKB: 50,
    });

    const looseWebP = calculateFormatScores(
      [ImageFormats.PNG, ImageFormats.WEBP],
      graphicAnalysis,
      false,
      looseOptions
    ).find((score) => score.format === ImageFormats.WEBP)!;
    const strictWebP = calculateFormatScores(
      [ImageFormats.PNG, ImageFormats.WEBP],
      graphicAnalysis,
      false,
      strictOptions
    ).find((score) => score.format === ImageFormats.WEBP)!;

    expect(strictWebP.score).toBeGreaterThan(looseWebP.score);
  });
});
