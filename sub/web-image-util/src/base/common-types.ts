// ImageSource imported from unified type system
import type { ImageSource } from '../types';

export type { ImageSource };

/**
 * Image source conversion options
 *
 * @description Options used when converting image source to HTMLImageElement
 */
export interface ImageSourceConvertOptions {
  crossOrigin?: string;
  elementSize?: { width: number; height: number };
}

/**
 * Image string source type
 *
 * @description Type representing the kind of image source expressed as string
 */
export type ImageStringSourceType = 'SVG_XML' | 'DATA_URL' | 'HTTP_URL' | 'PATH';

/**
 * Image file extensions
 *
 * @description List of supported image file extensions
 */
export type ImageFileExt = 'jpg' | 'png' | 'svg' | 'bmp' | 'tiff' | 'webp' | 'gif' | 'ico';

// ImageFormat, OutputFormat imported from unified type system
import type { ImageFormat, OutputFormat } from '../types';

export interface ModernConversionOptions {
  format?: OutputFormat;
  quality?: number;
  fallbackFormat?: OutputFormat;
  autoOptimize?: boolean; // Automatic format selection
}

// Format-specific metadata
export interface FormatInfo {
  format: ImageFormat;
  mimeType: string;
  supportsTransparency: boolean;
  supportsAnimation: boolean;
  averageCompression: number; // Approximate compression ratio (%)
}

// Type definitions specific to processImage API

export type DataUrlWithSize = {
  dataUrl: string;
  width: number;
  height: number;
};

// Export specialized error classes (basic error types imported from unified system)
export { ImageSourceError, ImageConversionError, ImageCanvasError, ImageResizeError } from './errors';

export type BlobWithSize = {
  blob: Blob;
  width: number;
  height: number;
};
