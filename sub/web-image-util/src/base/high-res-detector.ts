/**
 * 고해상도 이미지 처리 전략 열거형
 */
export type ProcessingStrategy =
  | 'direct' // 직접 처리 (소용량)
  | 'chunked' // 청크 단위 처리 (중용량)
  | 'stepped' // 단계적 축소 (대용량)
  | 'tiled'; // 타일 기반 처리 (초대용량)

export const ProcessingStrategy = {
  DIRECT: 'direct' as const,
  CHUNKED: 'chunked' as const,
  STEPPED: 'stepped' as const,
  TILED: 'tiled' as const,
} as const;

/**
 * 이미지 분석 결과 인터페이스
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
 * 고해상도 이미지 분석기
 * 이미지 크기와 브라우저 환경을 분석하여 최적의 처리 전략을 결정합니다.
 */
export class HighResolutionDetector {
  // 메모리 임계값 (바이트)
  private static readonly MEMORY_THRESHOLDS = {
    SMALL: 16 * 1024 * 1024, // 16MB - 직접 처리
    MEDIUM: 64 * 1024 * 1024, // 64MB - 청크 처리
    LARGE: 256 * 1024 * 1024, // 256MB - 단계적 처리
  };

  // Canvas 최대 크기 (브라우저별)
  private static readonly MAX_CANVAS_SIZE = {
    chrome: 32767,
    firefox: 32767,
    safari: 16384,
    edge: 32767,
    default: 16384, // 가장 보수적인 값을 기본값으로
  };

  // 픽셀당 메모리 사용량 (RGBA 4바이트)
  private static readonly BYTES_PER_PIXEL = 4;

  /**
   * 이미지 분석 및 최적 전략 결정
   *
   * @param img - 분석할 이미지 요소
   * @returns 상세한 분석 결과와 권장 전략
   */
  static analyzeImage(img: HTMLImageElement): ImageAnalysis {
    const { width, height } = img;
    const pixelCount = width * height;
    const estimatedMemory = pixelCount * this.BYTES_PER_PIXEL;
    const estimatedMemoryMB = estimatedMemory / (1024 * 1024);

    // 처리 전략 결정
    const strategy = this.determineStrategy(estimatedMemory, width, height);

    // 처리 복잡도 계산
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
   * 처리 전략 결정
   * @private
   */
  private static determineStrategy(estimatedMemory: number, width: number, height: number): ProcessingStrategy {
    const maxDimension = this.getMaxSafeDimension();

    // Canvas 크기 제한 초과 시 타일 처리 강제
    if (width > maxDimension || height > maxDimension) {
      return ProcessingStrategy.TILED;
    }

    // 메모리 사용량에 따른 전략 결정
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
   * 처리 복잡도 계산
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
   * 브라우저별 최대 안전 Canvas 크기 반환
   *
   * @returns 최대 안전 Canvas 크기 (픽셀)
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
   * 권장 청크 크기 계산
   * 메모리 사용량과 처리 효율성을 고려하여 최적의 청크 크기를 결정합니다.
   *
   * @param totalPixels - 전체 픽셀 수
   * @returns 권장 청크 크기 (한 변의 길이)
   */
  static getOptimalChunkSize(totalPixels: number): number {
    // 청크 하나당 최대 16MB 메모리 사용하도록 제한
    const maxChunkPixels = this.MEMORY_THRESHOLDS.SMALL / this.BYTES_PER_PIXEL;
    const theoreticalChunkSize = Math.floor(Math.sqrt(maxChunkPixels));

    // 실용적인 범위로 제한 (512px ~ 2048px)
    const minChunkSize = 512;
    const maxChunkSize = 2048;

    let chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, theoreticalChunkSize));

    // 2의 거듭제곱에 가까운 값으로 조정 (처리 효율성을 위해)
    const powerOfTwo = Math.pow(2, Math.round(Math.log2(chunkSize)));
    chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, powerOfTwo));

    return chunkSize;
  }

  /**
   * 이미지 처리 가능 여부 검사
   *
   * @param img - 검사할 이미지
   * @returns 처리 가능 여부와 상세 정보
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

    // Canvas 크기 제한 검사
    if (img.width > analysis.maxSafeDimension || img.height > analysis.maxSafeDimension) {
      limitations.push(`이미지 크기가 브라우저 Canvas 한계를 초과합니다. 최대: ${analysis.maxSafeDimension}px`);
      recommendations.push('타일 기반 처리를 사용하여 분할 처리하는 것을 권장합니다.');
    }

    // 메모리 사용량 검사
    if (analysis.estimatedMemoryMB > 512) {
      limitations.push(`높은 메모리 사용량: ${analysis.estimatedMemoryMB}MB`);
      recommendations.push('메모리 효율적인 처리 방식을 사용하거나 이미지 크기를 줄이는 것을 권장합니다.');
    }

    // 처리 복잡도 검사
    if (analysis.processingComplexity === 'extreme') {
      limitations.push('매우 복잡한 처리가 예상되어 시간이 오래 걸릴 수 있습니다.');
      recommendations.push('처리 진행 상황을 모니터링하고 필요시 중간에 중단할 수 있도록 준비하세요.');
    }

    // 전체적인 처리 가능 여부 결정
    const hasBlockingLimitations =
      analysis.estimatedMemoryMB > 1024 || Math.max(img.width, img.height) > analysis.maxSafeDimension * 2;

    if (hasBlockingLimitations) {
      canProcess = false;
      recommendations.push(
        '이미지를 더 작은 크기로 사전 처리하거나 전문적인 이미지 처리 도구를 사용하는 것을 권장합니다.'
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
   * 처리 시간 추정
   *
   * @param analysis - 이미지 분석 결과
   * @returns 예상 처리 시간 (초)
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
        baseTime = megaPixels * 0.1; // 메가픽셀당 0.1초
        factors.push('직접 처리 - 가장 빠름');
        break;

      case ProcessingStrategy.CHUNKED:
        baseTime = megaPixels * 0.2;
        multiplier = 1.2; // 청크 오버헤드
        factors.push('청크 처리 - 메모리 효율적');
        break;

      case ProcessingStrategy.STEPPED:
        baseTime = megaPixels * 0.3;
        multiplier = 1.5; // 단계별 처리 오버헤드
        factors.push('단계별 처리 - 고품질');
        break;

      case ProcessingStrategy.TILED:
        baseTime = megaPixels * 0.5;
        multiplier = 2.0; // 타일 처리 오버헤드
        factors.push('타일 처리 - 초대용량 이미지');
        break;
    }

    // 복잡도에 따른 추가 시간
    switch (analysis.processingComplexity) {
      case 'high':
        multiplier *= 1.3;
        factors.push('높은 복잡도');
        break;
      case 'extreme':
        multiplier *= 2.0;
        factors.push('극도로 높은 복잡도');
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
   * 처리 전략별 설명 반환
   *
   * @param strategy - 처리 전략
   * @returns 전략에 대한 상세 설명
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
          name: '직접 처리',
          description: '이미지를 한 번에 메모리로 로드하여 처리합니다.',
          advantages: ['가장 빠른 처리 속도', '단순한 구현', '높은 품질'],
          disadvantages: ['높은 메모리 사용량', '대용량 이미지에 부적합'],
        };

      case ProcessingStrategy.CHUNKED:
        return {
          name: '청크 처리',
          description: '이미지를 작은 블록으로 나누어 순차적으로 처리합니다.',
          advantages: ['메모리 효율적', '안정적 처리', '중간 크기 이미지에 적합'],
          disadvantages: ['처리 시간 증가', '경계 부분 처리 필요'],
        };

      case ProcessingStrategy.STEPPED:
        return {
          name: '단계적 축소',
          description: '이미지를 여러 단계에 걸쳐 점진적으로 축소합니다.',
          advantages: ['고품질 결과', '앨리어싱 최소화', '부드러운 그라데이션'],
          disadvantages: ['긴 처리 시간', '높은 CPU 사용량', '복잡한 구현'],
        };

      case ProcessingStrategy.TILED:
        return {
          name: '타일 처리',
          description: '이미지를 타일 단위로 분할하여 개별적으로 처리합니다.',
          advantages: ['초대용량 이미지 처리 가능', '메모리 사용량 제한', '확장성'],
          disadvantages: ['가장 긴 처리 시간', '타일 경계 처리 복잡', '높은 구현 복잡도'],
        };

      default:
        return {
          name: '알 수 없음',
          description: '정의되지 않은 처리 전략입니다.',
          advantages: [],
          disadvantages: [],
        };
    }
  }
}
