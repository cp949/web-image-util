/**
 * High-resolution image processing strategy enum
 */
export type ProcessingStrategy =
  | 'direct' // Direct processing (small size)
  | 'chunked' // Chunk-based processing (medium size)
  | 'stepped' // Stepped reduction (large size)
  | 'tiled'; // Tile-based processing (ultra-large size)

export const ProcessingStrategy = {
  DIRECT: 'direct' as const,
  CHUNKED: 'chunked' as const,
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
  // Memory thresholds (bytes)
  private static readonly MEMORY_THRESHOLDS = {
    SMALL: 16 * 1024 * 1024, // 16MB - direct processing
    MEDIUM: 64 * 1024 * 1024, // 64MB - chunk processing
    LARGE: 256 * 1024 * 1024, // 256MB - stepped processing
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
   * Image analysis and optimal strategy determination
   *
   * @param img - Image element to analyze
   * @returns Detailed analysis results and recommended strategy
   */
  static analyzeImage(img: HTMLImageElement): ImageAnalysis {
    const { width, height } = img;
    const pixelCount = width * height;
    const estimatedMemory = pixelCount * this.BYTES_PER_PIXEL;
    const estimatedMemoryMB = estimatedMemory / (1024 * 1024);

    // Determine processing strategy
    const strategy = this.determineStrategy(estimatedMemory, width, height);

    // Calculate processing complexity
    const processingComplexity = this.calculateComplexity(pixelCount, strategy);

    return {
      width,
      height,
      pixelCount,
      totalPixels: pixelCount,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
      strategy,
      maxSafeDimension: this.getMaxSafeDimension(),
      recommendedChunkSize: this.getOptimalChunkSize(pixelCount),
      processingComplexity,
    };
  }

  /**
   * Determine processing strategy
   * @private
   */
  private static determineStrategy(estimatedMemory: number, width: number, height: number): ProcessingStrategy {
    const maxDimension = this.getMaxSafeDimension();

    // Force tile processing when Canvas size limit is exceeded
    if (width > maxDimension || height > maxDimension) {
      return ProcessingStrategy.TILED;
    }

    // Determine strategy based on memory usage
    if (estimatedMemory <= this.MEMORY_THRESHOLDS.SMALL) {
      return ProcessingStrategy.DIRECT;
    } else if (estimatedMemory <= this.MEMORY_THRESHOLDS.MEDIUM) {
      return ProcessingStrategy.CHUNKED;
    } else if (estimatedMemory <= this.MEMORY_THRESHOLDS.LARGE) {
      return ProcessingStrategy.STEPPED;
    } else {
      return ProcessingStrategy.TILED;
    }
  }

  /**
   * Calculate processing complexity
   * @private
   */
  private static calculateComplexity(
    pixelCount: number,
    strategy: ProcessingStrategy
  ): 'low' | 'medium' | 'high' | 'extreme' {
    const megaPixels = pixelCount / (1024 * 1024);

    switch (strategy) {
      case ProcessingStrategy.DIRECT:
        return megaPixels < 2 ? 'low' : 'medium';
      case ProcessingStrategy.CHUNKED:
        return 'medium';
      case ProcessingStrategy.STEPPED:
        return 'high';
      case ProcessingStrategy.TILED:
        return 'extreme';
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
      return this.MAX_CANVAS_SIZE.chrome;
    } else if (userAgent.includes('firefox')) {
      return this.MAX_CANVAS_SIZE.firefox;
    } else if (userAgent.includes('safari')) {
      return this.MAX_CANVAS_SIZE.safari;
    } else if (userAgent.includes('edge') || userAgent.includes('edg/')) {
      return this.MAX_CANVAS_SIZE.edge;
    }

    return this.MAX_CANVAS_SIZE.default;
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
    const maxChunkPixels = this.MEMORY_THRESHOLDS.SMALL / this.BYTES_PER_PIXEL;
    const theoreticalChunkSize = Math.floor(Math.sqrt(maxChunkPixels));

    // Limit to practical range (512px ~ 2048px)
    const minChunkSize = 512;
    const maxChunkSize = 2048;

    let chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, theoreticalChunkSize));

    // Adjust to value close to power of 2 (for processing efficiency)
    const powerOfTwo = Math.pow(2, Math.round(Math.log2(chunkSize)));
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
    const analysis = this.analyzeImage(img);
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

      case ProcessingStrategy.CHUNKED:
        baseTime = megaPixels * 0.2;
        multiplier = 1.2; // Chunk overhead
        factors.push('Chunk processing - memory efficient');
        break;

      case ProcessingStrategy.STEPPED:
        baseTime = megaPixels * 0.3;
        multiplier = 1.5; // Stepped processing overhead
        factors.push('Stepped processing - high quality');
        break;

      case ProcessingStrategy.TILED:
        baseTime = megaPixels * 0.5;
        multiplier = 2.0; // Tile processing overhead
        factors.push('Tile processing - ultra-large images');
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

  /**
   * Return description by processing strategy
   *
   * @param strategy - Processing strategy
   * @returns Detailed description of the strategy
   */
  static getStrategyDescription(strategy: ProcessingStrategy): {
    name: string;
    description: string;
    advantages: string[];
    disadvantages: string[];
  } {
    switch (strategy) {
      case ProcessingStrategy.DIRECT:
        return {
          name: 'Direct Processing',
          description: 'Loads the entire image into memory at once for processing.',
          advantages: ['Fastest processing speed', 'Simple implementation', 'High quality'],
          disadvantages: ['High memory usage', 'Unsuitable for large images'],
        };

      case ProcessingStrategy.CHUNKED:
        return {
          name: 'Chunk Processing',
          description: 'Divides the image into small blocks for sequential processing.',
          advantages: ['Memory efficient', 'Stable processing', 'Suitable for medium-sized images'],
          disadvantages: ['Increased processing time', 'Boundary processing required'],
        };

      case ProcessingStrategy.STEPPED:
        return {
          name: 'Stepped Reduction',
          description: 'Gradually reduces the image over multiple steps.',
          advantages: ['High-quality results', 'Minimized aliasing', 'Smooth gradation'],
          disadvantages: ['Long processing time', 'High CPU usage', 'Complex implementation'],
        };

      case ProcessingStrategy.TILED:
        return {
          name: 'Tile Processing',
          description: 'Divides the image into tiles for individual processing.',
          advantages: ['Can process ultra-large images', 'Limited memory usage', 'Scalability'],
          disadvantages: ['Longest processing time', 'Complex tile boundary processing', 'High implementation complexity'],
        };

      default:
        return {
          name: 'Unknown',
          description: 'Undefined processing strategy.',
          advantages: [],
          disadvantages: [],
        };
    }
  }
}
