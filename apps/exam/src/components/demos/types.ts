// 공통 타입 정의 - v2.0 API 완전 활용

import type { ResizeFit, ImageSource, ResultBlob, ResultDataURL, ResultFile, ImageProcessError } from '@cp949/web-image-util';

/**
 * 데모 애플리케이션 전체 상태
 */
export interface DemoState {
  originalImage: ImageInfo | null;
  processedImages: ProcessedImageInfo[];
  processing: boolean;
  error: ImageProcessError | Error | null;
}

/**
 * 이미지 기본 정보
 */
export interface ImageInfo {
  src: string;
  width: number;
  height: number;
  size?: number;
  format?: string;
  name?: string;
}

/**
 * 처리된 이미지 정보 (메타데이터 포함)
 */
export interface ProcessedImageInfo extends ImageInfo {
  processingTime: number;
  originalSize: { width: number; height: number };
  compressionRatio?: number;
  qualityScore?: number;
}

/**
 * 이미지 처리 옵션
 */
export interface ProcessingOptions {
  width?: number;
  height?: number;
  fit: ResizeFit;
  quality: number;
  format: 'jpeg' | 'png' | 'webp'; // OutputFormat 대신 직접 정의
  background?: string;
  withoutEnlargement?: boolean;
  withoutReduction?: boolean;
}

/**
 * 배치 처리 결과
 */
export interface BatchProcessResult {
  success: ProcessedImageInfo[];
  failed: Array<{
    index: number;
    error: ImageProcessError | Error;
  }>;
  totalTime: number;
}

/**
 * 성능 메트릭
 */
export interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  throughput: number;
}

// Re-export useful types from library
export type { ResizeFit, ImageSource, ResultBlob, ResultDataURL, ResultFile, ImageProcessError };

// Local type aliases
export type OutputFormat = 'jpeg' | 'png' | 'webp';