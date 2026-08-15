/**
 * High-resolution image processing strategy enum
 */
export type ProcessingStrategy =
  | 'direct' // Direct processing (small size)
  | 'stepped' // Stepped reduction (large size)
  | 'tiled'; // Tile-based processing (medium to ultra-large sizes, with memory-based presets)

export const ProcessingStrategy = {
  DIRECT: 'direct' as const,
  STEPPED: 'stepped' as const,
  TILED: 'tiled' as const,
} as const;

/**
 * Image analysis result interface
 */
export interface ImageAnalysis {
  width: number;
  height: number;
  pixelCount: number;
  totalPixels: number;
  estimatedMemoryMB: number;
  strategy: ProcessingStrategy;
  maxSafeDimension: number;
  recommendedChunkSize: number;
  processingComplexity: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * High-resolution image analyzer
 * Analyzes image size and browser environment to determine optimal processing strategy.
 */
export class HighResolutionDetector {
  /**
   * Single source for the boundaries selectFastStrategy()/selectHighQualityStrategy()
   * (high-res-manager.ts) compare against. These used to carry their own 64/256
   * literals that happened to match MEDIUM/LARGE below — same numbers, different
   * source, no compiler-enforced link between them.
   */
  static readonly MEDIUM_MEMORY_THRESHOLD_MB = 64;
  static readonly LARGE_MEMORY_THRESHOLD_MB = 256;

  // Memory thresholds (bytes)
  private static readonly MEMORY_THRESHOLDS = {
    SMALL: 16 * 1024 * 1024, // 16MB - direct processing
    MEDIUM: HighResolutionDetector.MEDIUM_MEMORY_THRESHOLD_MB * 1024 * 1024, // chunk processing
    LARGE: HighResolutionDetector.LARGE_MEMORY_THRESHOLD_MB * 1024 * 1024, // stepped processing
  };

  // Maximum Canvas size (by browser)
  private static readonly MAX_CANVAS_SIZE = {
    chrome: 32767,
    firefox: 32767,
    safari: 16384,
    edge: 32767,
    default: 16384, // Most conservative value as default
  };

  // Memory usage per pixel (RGBA 4 bytes)
  private static readonly BYTES_PER_PIXEL = 4;

  /**
   * Default pixel-count threshold for routing into the high-resolution processing
   * machine (HighResolutionManager) instead of a direct draw. Used by
   * AutoHighResProcessor via shouldUseHighResolutionPath() to determine
   * routing criteria.
   */
  static readonly DEFAULT_HIGH_RES_PIXEL_THRESHOLD = 8_000_000; // 8MP

  /**
   * Default scale-ratio threshold (source/target, larger axis) above which an image
   * is routed into the high-resolution machine regardless of pixel count — a small
   * image needing extreme downscale in one step can still produce quality artifacts.
   */
  static readonly DEFAULT_HIGH_RES_SCALE_RATIO_THRESHOLD = 4;

  /**
   * Image analysis and optimal strategy determination
   *
   * @param img - Image element to analyze
   * @returns Detailed analysis results and recommended strategy
   */
  static analyzeImage(img: HTMLImageElement): ImageAnalysis {
    const { width, height } = img;
    const pixelCount = width * height;
    const estimatedMemory = pixelCount * HighResolutionDetector.BYTES_PER_PIXEL;
    const estimatedMemoryMB = estimatedMemory / (1024 * 1024);

    // Determine processing strategy
    const strategy = HighResolutionDetector.determineStrategy(estimatedMemory, width, height);

    // Calculate processing complexity
    const processingComplexity = HighResolutionDetector.calculateComplexity(pixelCount, strategy, estimatedMemoryMB);

    return {
      width,
      height,
      pixelCount,
      totalPixels: pixelCount,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
      strategy,
      maxSafeDimension: HighResolutionDetector.getMaxSafeDimension(),
      recommendedChunkSize: HighResolutionDetector.getOptimalChunkSize(pixelCount),
      processingComplexity,
    };
  }

  /**
   * Decide whether an image should be routed through the high-resolution processing
   * machine (HighResolutionManager) instead of a direct draw.
   *
   * Routing decision used by AutoHighResProcessor to determine whether to use
   * high-resolution processing. Consumer-specific thresholds and policy (which
   * strategy to use once inside the machine, memory-pressure handling, etc.) stay
   * local to each caller — this function only answers "in or out."
   *
   * @param totalPixels - Source image pixel count (width * height)
   * @param scaleRatio - Larger-axis shrink ratio (source / target). Pass 1 (or omit)
   *   when there's no target-relative scaling to consider.
   * @param pixelThreshold - Pixel count above which the image is high-resolution
   *   (default: DEFAULT_HIGH_RES_PIXEL_THRESHOLD)
   * @param scaleRatioThreshold - Scale ratio above which the image is high-resolution
   *   regardless of pixel count (default: DEFAULT_HIGH_RES_SCALE_RATIO_THRESHOLD)
   */
  static shouldUseHighResolutionPath(
    totalPixels: number,
    scaleRatio: number = 1,
    pixelThreshold: number = HighResolutionDetector.DEFAULT_HIGH_RES_PIXEL_THRESHOLD,
    scaleRatioThreshold: number = HighResolutionDetector.DEFAULT_HIGH_RES_SCALE_RATIO_THRESHOLD
  ): boolean {
    return totalPixels > pixelThreshold || scaleRatio > scaleRatioThreshold;
  }

  /**
   * Determine processing strategy
   * @private
   */
  private static determineStrategy(estimatedMemory: number, width: number, height: number): ProcessingStrategy {
    const maxDimension = HighResolutionDetector.getMaxSafeDimension();

    // Force tile processing when Canvas size limit is exceeded
    if (width > maxDimension || height > maxDimension) {
      return ProcessingStrategy.TILED;
    }

    // Determine strategy based on memory usage
    // The former CHUNKED range is now TILED. resize-strategy.internal.ts selects
    // the light preset from analysis.estimatedMemoryMB.
    if (estimatedMemory <= HighResolutionDetector.MEMORY_THRESHOLDS.SMALL) {
      return ProcessingStrategy.DIRECT;
    } else if (estimatedMemory <= HighResolutionDetector.MEMORY_THRESHOLDS.MEDIUM) {
      return ProcessingStrategy.TILED;
    } else if (estimatedMemory <= HighResolutionDetector.MEMORY_THRESHOLDS.LARGE) {
      return ProcessingStrategy.STEPPED;
    } else {
      return ProcessingStrategy.TILED;
    }
  }

  /**
   * Calculate processing complexity
   * @private
   *
   * TILED absorbs the former CHUNKED (medium) and TILED (extreme) ranges.
   * Keep the 16–64MB range at medium complexity so estimateProcessingTime does not
   * apply the former heavy-path multiplier. estimatedMemoryMB distinguishes the ranges.
   */
  private static calculateComplexity(
    pixelCount: number,
    strategy: ProcessingStrategy,
    estimatedMemoryMB: number
  ): 'low' | 'medium' | 'high' | 'extreme' {
    const megaPixels = pixelCount / (1024 * 1024);

    switch (strategy) {
      case ProcessingStrategy.DIRECT:
        return megaPixels < 2 ? 'low' : 'medium';
      case ProcessingStrategy.STEPPED:
        return 'high';
      case ProcessingStrategy.TILED:
        return estimatedMemoryMB <= 64 ? 'medium' : 'extreme';
      default:
        return 'low';
    }
  }

  /**
   * Return maximum safe Canvas size by browser
   *
   * @returns Maximum safe Canvas size (pixels)
   */
  static getMaxSafeDimension(): number {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome') || userAgent.includes('chromium')) {
      return HighResolutionDetector.MAX_CANVAS_SIZE.chrome;
    } else if (userAgent.includes('firefox')) {
      return HighResolutionDetector.MAX_CANVAS_SIZE.firefox;
    } else if (userAgent.includes('safari')) {
      return HighResolutionDetector.MAX_CANVAS_SIZE.safari;
    } else if (userAgent.includes('edge') || userAgent.includes('edg/')) {
      return HighResolutionDetector.MAX_CANVAS_SIZE.edge;
    }

    return HighResolutionDetector.MAX_CANVAS_SIZE.default;
  }

  /**
   * Calculate recommended chunk size
   * Determines optimal chunk size considering memory usage and processing efficiency.
   *
   * @param totalPixels - Total pixel count
   * @returns Recommended chunk size (side length)
   */
  static getOptimalChunkSize(totalPixels: number): number {
    // Limit to maximum 16MB memory usage per chunk
    const maxChunkPixels = HighResolutionDetector.MEMORY_THRESHOLDS.SMALL / HighResolutionDetector.BYTES_PER_PIXEL;
    const theoreticalChunkSize = Math.floor(Math.sqrt(maxChunkPixels));

    // Limit to practical range (512px ~ 2048px)
    const minChunkSize = 512;
    const maxChunkSize = 2048;

    let chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, theoreticalChunkSize));

    // Adjust to value close to power of 2 (for processing efficiency)
    const powerOfTwo = 2 ** Math.round(Math.log2(chunkSize));
    chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, powerOfTwo));

    return chunkSize;
  }

  /**
   * Check image processing capability
   *
   * @param img - Image to check
   * @returns Processing capability status and detailed information
   */
  static validateProcessingCapability(img: HTMLImageElement): {
    canProcess: boolean;
    analysis: ImageAnalysis;
    limitations: string[];
    recommendations: string[];
  } {
    const analysis = HighResolutionDetector.analyzeImage(img);
    const limitations: string[] = [];
    const recommendations: string[] = [];
    let canProcess = true;

    // Check Canvas size limitation
    if (img.width > analysis.maxSafeDimension || img.height > analysis.maxSafeDimension) {
      limitations.push(`Image size exceeds browser Canvas limit. Maximum: ${analysis.maxSafeDimension}px`);
      recommendations.push('Recommend using tile-based processing for segmented processing.');
    }

    // Check memory usage
    if (analysis.estimatedMemoryMB > 512) {
      limitations.push(`High memory usage: ${analysis.estimatedMemoryMB}MB`);
      recommendations.push('Recommend using memory-efficient processing or reducing image size.');
    }

    // Check processing complexity
    if (analysis.processingComplexity === 'extreme') {
      limitations.push('Very complex processing is expected and may take a long time.');
      recommendations.push('Monitor processing progress and be prepared to cancel if necessary.');
    }

    // Determine overall processing feasibility
    const hasBlockingLimitations =
      analysis.estimatedMemoryMB > 1024 || Math.max(img.width, img.height) > analysis.maxSafeDimension * 2;

    if (hasBlockingLimitations) {
      canProcess = false;
      recommendations.push(
        'Recommend pre-processing the image to a smaller size or using professional image processing tools.'
      );
    }

    return {
      canProcess,
      analysis,
      limitations,
      recommendations,
    };
  }

  /**
   * Estimate processing time
   *
   * @param analysis - Image analysis result
   * @returns Expected processing time (seconds)
   */
  static estimateProcessingTime(analysis: ImageAnalysis): {
    estimatedSeconds: number;
    range: { min: number; max: number };
    factors: string[];
  } {
    const megaPixels = analysis.pixelCount / (1024 * 1024);
    const factors: string[] = [];

    let baseTime = 0;
    let multiplier = 1;

    switch (analysis.strategy) {
      case ProcessingStrategy.DIRECT:
        baseTime = megaPixels * 0.1; // 0.1 seconds per megapixel
        factors.push('Direct processing - fastest');
        break;

      case ProcessingStrategy.STEPPED:
        baseTime = megaPixels * 0.3;
        multiplier = 1.5; // Stepped processing overhead
        factors.push('Stepped processing - high quality');
        break;

      case ProcessingStrategy.TILED:
        // Preserve the former CHUNKED (light) and TILED (heavy) preset boundary.
        if (analysis.estimatedMemoryMB <= 64) {
          baseTime = megaPixels * 0.2;
          multiplier = 1.2; // Chunk overhead
          factors.push('Chunk processing - memory efficient');
        } else {
          baseTime = megaPixels * 0.5;
          multiplier = 2.0; // Tile processing overhead
          factors.push('Tile processing - ultra-large images');
        }
        break;
    }

    // Additional time based on complexity
    switch (analysis.processingComplexity) {
      case 'high':
        multiplier *= 1.3;
        factors.push('High complexity');
        break;
      case 'extreme':
        multiplier *= 2.0;
        factors.push('Extremely high complexity');
        break;
    }

    const estimatedSeconds = Math.max(0.1, baseTime * multiplier);

    return {
      estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
      range: {
        min: Math.round(estimatedSeconds * 0.7 * 10) / 10,
        max: Math.round(estimatedSeconds * 1.5 * 10) / 10,
      },
      factors,
    };
  }
}
