// Common type definitions - Full utilization of v2.0 API

import type { ResizeFit, ImageSource, ResultBlob, ResultDataURL, ResultFile, ImageProcessError, Padding } from '@cp949/web-image-util';

/**
 * Demo application global state
 */
export interface DemoState {
  originalImage: ImageInfo | null;
  processedImages: ProcessedImageInfo[];
  processing: boolean;
  error: ImageProcessError | Error | null;
}

/**
 * Basic image information
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
 * Processed image information (including metadata)
 */
export interface ProcessedImageInfo extends ImageInfo {
  processingTime: number;
  originalSize?: { width: number; height: number };
  compressionRatio?: number;
  qualityScore?: number;
}

/**
 * Image processing options
 */
export interface ProcessingOptions {
  width?: number;
  height?: number;
  fit: ResizeFit;
  quality: number;
  format: 'jpeg' | 'png' | 'webp'; // Direct definition instead of OutputFormat
  background?: string;
  withoutEnlargement?: boolean;
  padding?: Padding; // 🆕 Phase 1: Added padding option
}

/**
 * Batch processing results
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
 * Performance metrics
 */
export interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  throughput: number;
}

// Re-export useful types from library
export type { ResizeFit, ImageSource, ResultBlob, ResultDataURL, ResultFile, ImageProcessError, Padding };

// Local type aliases
export type OutputFormat = 'jpeg' | 'png' | 'webp';