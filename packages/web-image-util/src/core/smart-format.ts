/**
 * 스마트 포맷 선택 및 최적화 시스템
 * 이미지 특성과 브라우저 지원을 고려한 자동 포맷 최적화
 */

import { FormatDetector, ImageFormat, FORMAT_MIME_MAP } from '../base/format-detector';

/**
 * 이미지 용도별 최적화 프리셋
 */
export enum ImagePurpose {
  WEB = 'web', // 웹 페이지 (일반적인 웹 사용)
  THUMBNAIL = 'thumbnail', // 썸네일 (작은 크기, 빠른 로딩)
  PRINT = 'print', // 인쇄용 (고품질 유지)
  SOCIAL = 'social', // 소셜 미디어 (플랫폼별 최적화)
  ICON = 'icon', // 아이콘 (선명함 우선)
  ARCHIVE = 'archive', // 보관용 (무손실 우선)
}

/**
 * 스마트 포맷 옵션
 */
export interface SmartFormatOptions {
  /** 이미지 용도 (자동 최적화에 영향) */
  purpose?: ImagePurpose;

  /** 최대 파일 크기 (KB 단위) */
  maxSizeKB?: number;

  /** 품질 우선순위 (0: 압축률 우선, 1: 품질 우선) */
  qualityPriority?: number; // 0-1

  /** 브라우저 호환성 우선 여부 */
  legacyCompatible?: boolean;

  /** 투명도 보존 여부 (자동 감지 가능) */
  preserveTransparency?: boolean;

  /** 허용할 포맷들 (제한하고 싶은 경우) */
  allowedFormats?: ImageFormat[];
}

/**
 * 포맷 최적화 결과
 */
export interface FormatOptimizationResult {
  /** 선택된 최적 포맷 */
  format: ImageFormat;

  /** MIME 타입 */
  mimeType: string;

  /** 권장 품질 설정 */
  quality: number;

  /** 최적화 이유 */
  reason: string;

  /** 대체 포맷들 (우선순위 순) */
  alternatives: Array<{ format: ImageFormat; quality: number; reason: string }>;

  /** 예상 파일 크기 개선율 */
  estimatedSavings?: number; // 0-1 (백분율)
}

/**
 * 스마트 포맷 선택기 클래스
 */
export class SmartFormatSelector {
  private static purposeSettings: Record<ImagePurpose, Partial<SmartFormatOptions>> = {
    [ImagePurpose.WEB]: {
      qualityPriority: 0.6,
      maxSizeKB: 500,
      legacyCompatible: false,
    },
    [ImagePurpose.THUMBNAIL]: {
      qualityPriority: 0.3,
      maxSizeKB: 50,
      legacyCompatible: false,
    },
    [ImagePurpose.PRINT]: {
      qualityPriority: 0.95,
      legacyCompatible: true,
    },
    [ImagePurpose.SOCIAL]: {
      qualityPriority: 0.7,
      maxSizeKB: 300,
      legacyCompatible: false,
    },
    [ImagePurpose.ICON]: {
      qualityPriority: 0.9,
      maxSizeKB: 20,
      legacyCompatible: true,
    },
    [ImagePurpose.ARCHIVE]: {
      qualityPriority: 1.0,
      legacyCompatible: true,
      preserveTransparency: true,
    },
  };

  /**
   * 최적 포맷 자동 선택
   * @param canvas - 분석할 캔버스
   * @param options - 최적화 옵션
   */
  static async selectOptimalFormat(
    canvas: HTMLCanvasElement,
    options: SmartFormatOptions = {}
  ): Promise<FormatOptimizationResult> {
    // 용도별 기본 설정 적용
    const purposeDefaults = options.purpose ? this.purposeSettings[options.purpose] : {};

    const mergedOptions: Required<SmartFormatOptions> = {
      purpose: ImagePurpose.WEB,
      maxSizeKB: Infinity,
      qualityPriority: 0.6,
      legacyCompatible: false,
      preserveTransparency: false,
      allowedFormats: Object.values(ImageFormat),
      ...purposeDefaults,
      ...options,
    };

    // 이미지 특성 분석
    const analysis = await this.analyzeImage(canvas);

    // 투명도 감지 (옵션으로 지정되지 않은 경우)
    const hasTransparency = options.preserveTransparency ?? analysis.hasTransparency;

    // 지원 가능한 포맷들 확인
    const supportedFormats = await this.getSupportedFormats(mergedOptions);

    // 각 포맷별 점수 계산
    const formatScores = await this.scoreFormats(supportedFormats, analysis, hasTransparency, mergedOptions);

    // 최고 점수 포맷 선택
    const bestFormat = formatScores[0];

    return {
      format: bestFormat.format,
      mimeType: FORMAT_MIME_MAP[bestFormat.format],
      quality: bestFormat.quality,
      reason: bestFormat.reason,
      alternatives: formatScores.slice(1, 4), // 상위 3개 대안
      estimatedSavings: bestFormat.estimatedSavings,
    };
  }

  /**
   * 이미지 특성 분석
   */
  private static async analyzeImage(canvas: HTMLCanvasElement): Promise<{
    hasTransparency: boolean;
    colorComplexity: number; // 0-1
    hasPhotographicContent: boolean;
    dominantColors: number;
    sharpEdges: boolean;
  }> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let hasTransparency = false;
    let nonTransparentPixels = 0;
    const colorSet = new Set<string>();
    let edgePixels = 0;

    // 샘플링으로 성능 최적화 (큰 이미지의 경우)
    const sampleStep = Math.max(1, Math.floor(data.length / 40000)); // 최대 10,000 픽셀 샘플링

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // 투명도 검사
      if (a < 255) {
        hasTransparency = true;
      } else {
        nonTransparentPixels++;
      }

      // 색상 복잡도 (고유 색상 수)
      if (colorSet.size < 1000) {
        // 메모리 절약을 위해 제한
        colorSet.add(`${r}-${g}-${b}`);
      }

      // 에지 검출 (간단한 방법)
      if (i > 0 && i < data.length - 4) {
        const prevR = data[i - 4] || r;
        const nextR = data[i + 4] || r;
        if (Math.abs(r - prevR) > 30 || Math.abs(r - nextR) > 30) {
          edgePixels++;
        }
      }
    }

    const totalSampledPixels = Math.floor(data.length / 4 / sampleStep);
    const colorComplexity = Math.min(colorSet.size / 256, 1); // 0-1 정규화
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
   * 지원 가능한 포맷 목록 반환
   */
  private static async getSupportedFormats(options: SmartFormatOptions): Promise<ImageFormat[]> {
    let formats = await FormatDetector.getSupportedFormats();

    // 허용된 포맷으로 필터링
    if (options.allowedFormats) {
      formats = formats.filter((format) => options.allowedFormats!.includes(format));
    }

    // 레거시 호환성이 필요한 경우 모던 포맷 제외
    if (options.legacyCompatible) {
      formats = formats.filter((format) => !['avif', 'webp'].includes(format));
    }

    return formats;
  }

  /**
   * 포맷별 점수 계산
   */
  private static async scoreFormats(
    formats: ImageFormat[],
    analysis: any,
    hasTransparency: boolean,
    options: Required<SmartFormatOptions>
  ): Promise<
    Array<{
      format: ImageFormat;
      score: number;
      quality: number;
      reason: string;
      estimatedSavings: number;
    }>
  > {
    const formatScores = [];

    for (const format of formats) {
      let score = 0;
      const quality = this.getRecommendedQuality(format, options);
      let reason = '';
      let estimatedSavings = 0;

      // 포맷별 기본 점수
      switch (format) {
        case ImageFormat.AVIF:
          score += 90; // 최신, 최고 압축률
          estimatedSavings = 0.6; // 60% 크기 감소
          reason = 'AVIF: 최고 압축률과 품질';
          break;
        case ImageFormat.WEBP:
          score += 80;
          estimatedSavings = 0.3; // 30% 크기 감소
          reason = 'WebP: 우수한 압축률';
          break;
        case ImageFormat.JPEG:
          score += 60;
          estimatedSavings = 0.1;
          reason = 'JPEG: 사진에 최적화';
          break;
        case ImageFormat.PNG:
          score += 50;
          estimatedSavings = -0.2; // 20% 크기 증가 (무손실)
          reason = 'PNG: 무손실 압축';
          break;
      }

      // 투명도 지원 보너스/페널티
      if (hasTransparency) {
        if (format === ImageFormat.PNG || format === ImageFormat.WEBP || format === ImageFormat.AVIF) {
          score += 20;
          reason += ' + 투명도 지원';
        } else {
          score -= 30; // JPEG는 투명도 미지원
        }
      }

      // 이미지 특성에 따른 조정
      if (analysis.hasPhotographicContent) {
        if (format === ImageFormat.JPEG || format === ImageFormat.WEBP || format === ImageFormat.AVIF) {
          score += 15;
          reason += ' + 사진 최적화';
        }
      } else {
        // 그래픽/일러스트
        if (format === ImageFormat.PNG || format === ImageFormat.WEBP || format === ImageFormat.AVIF) {
          score += 10;
          reason += ' + 그래픽 최적화';
        }
      }

      // 색상 복잡도에 따른 조정
      if (analysis.colorComplexity > 0.8) {
        // 복잡한 색상
        if (format === ImageFormat.JPEG || format === ImageFormat.AVIF) {
          score += 5;
        }
      } else {
        // 단순한 색상
        if (format === ImageFormat.PNG || format === ImageFormat.WEBP) {
          score += 5;
        }
      }

      // 품질 우선순위 적용
      const qualityBonus = this.calculateQualityBonus(format, options.qualityPriority);
      score += qualityBonus;

      // 파일 크기 제한 고려
      const sizeScore = this.calculateSizeScore(format, options.maxSizeKB, estimatedSavings);
      score += sizeScore;

      formatScores.push({
        format,
        score,
        quality,
        reason,
        estimatedSavings,
      });
    }

    // 점수 순으로 정렬
    return formatScores.sort((a, b) => b.score - a.score);
  }

  /**
   * 포맷별 권장 품질 설정
   */
  private static getRecommendedQuality(format: ImageFormat, options: SmartFormatOptions): number {
    const baseQuality = {
      [ImageFormat.JPEG]: 0.8,
      [ImageFormat.WEBP]: 0.8,
      [ImageFormat.AVIF]: 0.75,
      [ImageFormat.PNG]: 1.0, // 무손실
      [ImageFormat.GIF]: 1.0,
      [ImageFormat.SVG]: 1.0,
    };

    let quality = baseQuality[format] || 0.8;

    // 용도별 조정
    switch (options.purpose) {
      case ImagePurpose.THUMBNAIL:
        quality = Math.max(0.6, quality - 0.2);
        break;
      case ImagePurpose.PRINT:
        quality = Math.min(1.0, quality + 0.1);
        break;
      case ImagePurpose.ARCHIVE:
        quality = 1.0;
        break;
    }

    // 품질 우선순위에 따른 조정
    if (options.qualityPriority) {
      quality = quality + (1 - quality) * options.qualityPriority;
    }

    return Math.round(quality * 100) / 100;
  }

  /**
   * 품질 우선순위 보너스 계산
   */
  private static calculateQualityBonus(format: ImageFormat, qualityPriority: number): number {
    const qualityRanking = {
      [ImageFormat.AVIF]: 10,
      [ImageFormat.PNG]: 9,
      [ImageFormat.WEBP]: 8,
      [ImageFormat.JPEG]: 6,
      [ImageFormat.GIF]: 4,
      [ImageFormat.SVG]: 10,
    };

    return (qualityRanking[format] || 5) * qualityPriority;
  }

  /**
   * 파일 크기 점수 계산
   */
  private static calculateSizeScore(format: ImageFormat, maxSizeKB: number, estimatedSavings: number): number {
    if (maxSizeKB === Infinity) return 0;

    // 크기 제한이 있는 경우 압축률 높은 포맷 선호
    const compressionRanking = {
      [ImageFormat.AVIF]: 10,
      [ImageFormat.WEBP]: 8,
      [ImageFormat.JPEG]: 6,
      [ImageFormat.GIF]: 4,
      [ImageFormat.PNG]: 2,
      [ImageFormat.SVG]: 8,
    };

    const sizeScore = (compressionRanking[format] || 5) + estimatedSavings * 10;

    // 파일 크기 제한이 엄격할수록 압축률 중요
    const strictnessMultiplier = Math.max(0.5, Math.min(2.0, 1000 / maxSizeKB));

    return sizeScore * strictnessMultiplier;
  }

  /**
   * 배치 최적화 - 여러 이미지의 최적 포맷을 한 번에 결정
   */
  static async batchOptimize(
    canvases: Array<{ canvas: HTMLCanvasElement; name?: string; options?: SmartFormatOptions }>,
    globalOptions: SmartFormatOptions = {}
  ): Promise<Array<{ name?: string; result: FormatOptimizationResult }>> {
    const results = [];

    for (const { canvas, name, options } of canvases) {
      const mergedOptions = { ...globalOptions, ...options };
      const result = await this.selectOptimalFormat(canvas, mergedOptions);

      results.push({ name, result });
    }

    return results;
  }
}

/**
 * 편의 함수들
 */

/**
 * 웹용 최적화
 */
export async function optimizeForWeb(canvas: HTMLCanvasElement): Promise<FormatOptimizationResult> {
  return SmartFormatSelector.selectOptimalFormat(canvas, {
    purpose: ImagePurpose.WEB,
  });
}

/**
 * 썸네일용 최적화
 */
export async function optimizeForThumbnail(canvas: HTMLCanvasElement): Promise<FormatOptimizationResult> {
  return SmartFormatSelector.selectOptimalFormat(canvas, {
    purpose: ImagePurpose.THUMBNAIL,
  });
}

/**
 * 간단한 자동 최적화
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
