/**
 * Smart format selection and optimization system
 * Automatic format optimization considering image characteristics and browser support
 */

import { FORMAT_MIME_MAP, FormatDetector } from '../base/format-detector';
import type { ImageFormat } from '../types';
import {
  calculateFormatScores,
  type ImageAnalysis,
  ImagePurpose,
  mergeSmartFormatOptions,
  type SmartFormatOptions,
} from './smart-format-helpers.internal';

// 공개 타입·enum의 정의는 스택의 leaf(smart-format-helpers.internal.ts)에 있다.
// 이 재export가 공개 표면(advanced-index.ts 경유)을 그대로 유지한다.
export type { SmartFormatOptions } from './smart-format-helpers.internal';
export { ImagePurpose } from './smart-format-helpers.internal';

/**
 * Format optimization result
 */
export interface FormatOptimizationResult {
  /** Selected optimal format */
  format: ImageFormat;

  /** MIME type */
  mimeType: string;

  /** Recommended quality setting */
  quality: number;

  /** Optimization reason */
  reason: string;

  /** Alternative formats (in priority order) */
  alternatives: Array<{ format: ImageFormat; quality: number; reason: string }>;

  /** Expected file size improvement rate */
  estimatedSavings?: number; // 0-1 (percentage)
}

/**
 * Smart format selector class
 *
 * @description Class that automatically selects optimal format by analyzing image characteristics and browser support
 * Comprehensively considers color complexity, transparency, image purpose, etc.
 *
 * 이 클래스와 서로 무관하게 "최적 포맷"을 정의하는 곳이 적어도 한 곳 더 있다(프리셋 폴백까지
 * 세면 둘) — 병합 대상은 아니고 참조용 교차 링크다: core 경로의 기본값은 `OutputPipeline`의
 * 내부 `getBestFormat()`(`core/output-pipeline.internal.ts`, webp>png 2줄 판정)이 결정한다.
 * 이 클래스만 픽셀 샘플링(색상 복잡도·투명도·엣지 비율)으로 실제 이미지를 분석한다.
 */
export class SmartFormatSelector {
  /**
   * Automatic optimal format selection
   * @param canvas - Canvas to analyze
   * @param options - Optimization options
   */
  static async selectOptimalFormat(
    canvas: HTMLCanvasElement,
    options: SmartFormatOptions = {}
  ): Promise<FormatOptimizationResult> {
    const mergedOptions = mergeSmartFormatOptions(options);

    // Analyze image characteristics
    const analysis = await SmartFormatSelector.analyzeImage(canvas);

    // Detect transparency (if not specified in options)
    const hasTransparency = options.preserveTransparency ?? analysis.hasTransparency;

    // Check supported formats
    const supportedFormats = await SmartFormatSelector.getSupportedFormats(mergedOptions);

    // Calculate scores for each format
    const formatScores = calculateFormatScores(supportedFormats, analysis, hasTransparency, mergedOptions);

    // Select format with highest score
    const bestFormat = formatScores[0];

    return {
      format: bestFormat.format,
      mimeType: FORMAT_MIME_MAP[bestFormat.format],
      quality: bestFormat.quality,
      reason: bestFormat.reason,
      alternatives: formatScores.slice(1, 4), // Top 3 alternatives
      estimatedSavings: bestFormat.estimatedSavings,
    };
  }

  /**
   * Analyze image characteristics
   */
  private static async analyzeImage(canvas: HTMLCanvasElement): Promise<ImageAnalysis> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let hasTransparency = false;
    let nonTransparentPixels = 0;
    const colorSet = new Set<string>();
    let edgePixels = 0;

    // Performance optimization through sampling (for large images)
    const sampleStep = Math.max(1, Math.floor(data.length / 40000)); // Sample up to 10,000 pixels

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Transparency check
      if (a < 255) {
        hasTransparency = true;
      } else {
        nonTransparentPixels++;
      }

      // Color complexity (unique color count)
      if (colorSet.size < 1000) {
        // Limited to save memory
        colorSet.add(`${r}-${g}-${b}`);
      }

      // Edge detection (simple method)
      if (i > 0 && i < data.length - 4) {
        const prevR = data[i - 4] || r;
        const nextR = data[i + 4] || r;
        if (Math.abs(r - prevR) > 30 || Math.abs(r - nextR) > 30) {
          edgePixels++;
        }
      }
    }

    const totalSampledPixels = Math.floor(data.length / 4 / sampleStep);
    const colorComplexity = Math.min(colorSet.size / 256, 1); // 0-1 normalization
    const edgeRatio = edgePixels / totalSampledPixels;

    return {
      hasTransparency,
      colorComplexity,
      hasPhotographicContent: colorComplexity > 0.3 && edgeRatio < 0.2,
      dominantColors: colorSet.size,
      sharpEdges: edgeRatio > 0.1,
    };
  }

  /**
   * Return list of supported formats
   */
  private static async getSupportedFormats(options: SmartFormatOptions): Promise<ImageFormat[]> {
    let formats = await FormatDetector.getSupportedFormats();

    // Filter by allowed formats
    if (options.allowedFormats) {
      formats = formats.filter((format) => options.allowedFormats!.includes(format));
    }

    // Exclude modern formats if legacy browser compatibility is needed
    if (options.legacyCompatible) {
      formats = formats.filter((format) => !['webp'].includes(format));
    }

    return formats;
  }

  /**
   * Batch optimization - determine optimal formats for multiple images at once
   */
  static async batchOptimize(
    canvases: Array<{ canvas: HTMLCanvasElement; name?: string; options?: SmartFormatOptions }>,
    globalOptions: SmartFormatOptions = {}
  ): Promise<Array<{ name?: string; result: FormatOptimizationResult }>> {
    const results = [];

    for (const { canvas, name, options } of canvases) {
      const mergedOptions = { ...globalOptions, ...options };
      const result = await SmartFormatSelector.selectOptimalFormat(canvas, mergedOptions);

      results.push({ name, result });
    }

    return results;
  }
}

/**
 * Convenience functions
 */

/**
 * Web optimization
 *
 * @description Performs optimization for images to be used on web pages.
 * Uses settings that balance loading speed and quality.
 * @param canvas Canvas element to optimize
 * @returns Optimization result (format, quality, reason, etc.)
 */
export async function optimizeForWeb(canvas: HTMLCanvasElement): Promise<FormatOptimizationResult> {
  return SmartFormatSelector.selectOptimalFormat(canvas, {
    purpose: ImagePurpose.WEB,
  });
}

/**
 * Thumbnail optimization
 *
 * @description Performs optimization for thumbnail images.
 * Uses settings that focus on small file size and fast loading.
 * @param canvas Canvas element to optimize
 * @returns Optimization result (format, quality, reason, etc.)
 */
export async function optimizeForThumbnail(canvas: HTMLCanvasElement): Promise<FormatOptimizationResult> {
  return SmartFormatSelector.selectOptimalFormat(canvas, {
    purpose: ImagePurpose.THUMBNAIL,
  });
}

/**
 * Simple automatic optimization
 *
 * @description Automatically analyzes image and selects optimal format and quality.
 * The simplest form of optimization that automatically applies web-appropriate settings.
 * @param canvas Canvas element to optimize
 * @param maxSizeKB Maximum file size limit (in KB, optional)
 * @returns Optimized format, quality, and MIME type information
 */
export async function autoOptimize(
  canvas: HTMLCanvasElement,
  maxSizeKB?: number
): Promise<{
  format: ImageFormat;
  quality: number;
  mimeType: string;
}> {
  const result = await SmartFormatSelector.selectOptimalFormat(canvas, {
    maxSizeKB,
    purpose: ImagePurpose.WEB,
  });

  return {
    format: result.format,
    quality: result.quality,
    mimeType: result.mimeType,
  };
}
