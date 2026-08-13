import type { ImageFormat } from '../types';
import { ImageFormats } from '../types';

/**
 * Image purpose-based optimization presets
 *
 * @description Enum defining optimization strategies based on image usage purpose
 * Optimization criteria such as quality, size, and compatibility vary by purpose.
 */
export enum ImagePurpose {
  WEB = 'web', // Web pages (general web usage)
  THUMBNAIL = 'thumbnail', // Thumbnails (small size, fast loading)
  PRINT = 'print', // Print use (maintain high quality)
  SOCIAL = 'social', // Social media (platform-specific optimization)
  ICON = 'icon', // Icons (clarity priority)
  ARCHIVE = 'archive', // Archive use (lossless priority)
}

/**
 * Smart format options
 */
export interface SmartFormatOptions {
  /** Image purpose (affects automatic optimization) */
  purpose?: ImagePurpose;

  /** Maximum file size (in KB) */
  maxSizeKB?: number;

  /** Quality priority (0: compression priority, 1: quality priority) */
  qualityPriority?: number; // 0-1

  /** Whether to prioritize browser compatibility */
  legacyCompatible?: boolean;

  /** Whether to preserve transparency (auto-detectable) */
  preserveTransparency?: boolean;

  /** Allowed formats (if you want to restrict) */
  allowedFormats?: ImageFormat[];
}

export interface ImageAnalysis {
  hasTransparency: boolean;
  colorComplexity: number;
  hasPhotographicContent: boolean;
  dominantColors: number;
  sharpEdges: boolean;
}

export interface FormatScore {
  format: ImageFormat;
  score: number;
  quality: number;
  reason: string;
  estimatedSavings: number;
}

const PURPOSE_SETTINGS: Record<NonNullable<SmartFormatOptions['purpose']>, Partial<SmartFormatOptions>> = {
  web: {
    qualityPriority: 0.6,
    maxSizeKB: 500,
    legacyCompatible: false,
  },
  thumbnail: {
    qualityPriority: 0.3,
    maxSizeKB: 50,
    legacyCompatible: false,
  },
  print: {
    qualityPriority: 0.95,
    legacyCompatible: true,
  },
  social: {
    qualityPriority: 0.7,
    maxSizeKB: 300,
    legacyCompatible: false,
  },
  icon: {
    qualityPriority: 0.9,
    maxSizeKB: 20,
    legacyCompatible: true,
  },
  archive: {
    qualityPriority: 1.0,
    legacyCompatible: true,
    preserveTransparency: true,
  },
};

export function mergeSmartFormatOptions(options: SmartFormatOptions = {}): Required<SmartFormatOptions> {
  const purposeDefaults = options.purpose ? PURPOSE_SETTINGS[options.purpose] : {};

  return {
    purpose: 'web' as Required<SmartFormatOptions>['purpose'],
    maxSizeKB: Infinity,
    qualityPriority: 0.6,
    legacyCompatible: false,
    preserveTransparency: false,
    allowedFormats: Object.values(ImageFormats),
    ...purposeDefaults,
    ...options,
  };
}

export function calculateFormatScores(
  formats: ImageFormat[],
  analysis: ImageAnalysis,
  hasTransparency: boolean,
  options: Required<SmartFormatOptions>
): FormatScore[] {
  const formatScores = formats.map((format) => calculateFormatScore(format, analysis, hasTransparency, options));

  return formatScores.sort((a, b) => b.score - a.score);
}

export function resolveRecommendedQuality(format: ImageFormat, options: SmartFormatOptions): number {
  const baseQuality = {
    [ImageFormats.JPEG]: 0.8,
    [ImageFormats.JPG]: 0.8,
    [ImageFormats.WEBP]: 0.8,
    [ImageFormats.AVIF]: 0.75,
    [ImageFormats.PNG]: 1.0,
    [ImageFormats.GIF]: 1.0,
    [ImageFormats.SVG]: 1.0,
  };

  let quality = baseQuality[format] || 0.8;

  switch (options.purpose) {
    case 'thumbnail':
      quality = Math.max(0.6, quality - 0.2);
      break;
    case 'print':
      quality = Math.min(1.0, quality + 0.1);
      break;
    case 'archive':
      quality = 1.0;
      break;
  }

  if (options.qualityPriority) {
    quality = quality + (1 - quality) * options.qualityPriority;
  }

  return Math.round(quality * 100) / 100;
}

export function calculateQualityBonus(format: ImageFormat, qualityPriority: number): number {
  const qualityRanking = {
    [ImageFormats.AVIF]: 10,
    [ImageFormats.PNG]: 9,
    [ImageFormats.WEBP]: 8,
    [ImageFormats.JPEG]: 6,
    [ImageFormats.JPG]: 6,
    [ImageFormats.GIF]: 4,
    [ImageFormats.SVG]: 10,
  };

  return (qualityRanking[format] || 5) * qualityPriority;
}

export function calculateSizeScore(format: ImageFormat, maxSizeKB: number, estimatedSavings: number): number {
  if (maxSizeKB === Infinity) {
    return 0;
  }

  const compressionRanking = {
    [ImageFormats.AVIF]: 10,
    [ImageFormats.WEBP]: 8,
    [ImageFormats.JPEG]: 6,
    [ImageFormats.JPG]: 6,
    [ImageFormats.GIF]: 4,
    [ImageFormats.PNG]: 2,
    [ImageFormats.SVG]: 8,
  };

  const sizeScore = (compressionRanking[format] || 5) + estimatedSavings * 10;
  const strictnessMultiplier = Math.max(0.5, Math.min(2.0, 1000 / maxSizeKB));

  return sizeScore * strictnessMultiplier;
}

function calculateFormatScore(
  format: ImageFormat,
  analysis: ImageAnalysis,
  hasTransparency: boolean,
  options: Required<SmartFormatOptions>
): FormatScore {
  let score = 0;
  const quality = resolveRecommendedQuality(format, options);
  let reason = '';
  let estimatedSavings = 0;

  switch (format) {
    case ImageFormats.AVIF:
      score += 90;
      estimatedSavings = 0.6;
      reason = 'AVIF: Best compression ratio and quality';
      break;
    case ImageFormats.WEBP:
      score += 80;
      estimatedSavings = 0.3;
      reason = 'WebP: Excellent compression ratio';
      break;
    case ImageFormats.JPEG:
      score += 60;
      estimatedSavings = 0.1;
      reason = 'JPEG: Optimized for photos';
      break;
    case ImageFormats.PNG:
      score += 50;
      estimatedSavings = -0.2;
      reason = 'PNG: Lossless compression';
      break;
  }

  if (hasTransparency) {
    if (format === ImageFormats.PNG || format === ImageFormats.WEBP || format === ImageFormats.AVIF) {
      score += 20;
      reason += ' + transparency support';
    } else {
      score -= 30;
    }
  }

  if (analysis.hasPhotographicContent) {
    if (format === ImageFormats.JPEG || format === ImageFormats.WEBP || format === ImageFormats.AVIF) {
      score += 15;
      reason += ' + photo optimization';
    }
  } else if (format === ImageFormats.PNG || format === ImageFormats.WEBP || format === ImageFormats.AVIF) {
    score += 10;
    reason += ' + graphics optimization';
  }

  if (analysis.colorComplexity > 0.8) {
    if (format === ImageFormats.JPEG || format === ImageFormats.AVIF) {
      score += 5;
    }
  } else if (format === ImageFormats.PNG || format === ImageFormats.WEBP || format === ImageFormats.AVIF) {
    score += 5;
  }

  score += calculateQualityBonus(format, options.qualityPriority);
  score += calculateSizeScore(format, options.maxSizeKB, estimatedSavings);

  return {
    format,
    score,
    quality,
    reason,
    estimatedSavings,
  };
}
