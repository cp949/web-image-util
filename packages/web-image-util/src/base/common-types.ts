/**
 * image source
 *
 * source of string type is
 * svg xml
 * dataUrl
 * httpUrl
 * path
 *
 */
export type ImageSource = HTMLImageElement | Blob | string;

/**
 * 이미지 소스 변환 옵션
 */
export interface ImageSourceConvertOptions {
  crossOrigin?: string;
  elementSize?: { width: number; height: number };
}

export type ImageStringSourceType = 'SVG_XML' | 'DATA_URL' | 'HTTP_URL' | 'PATH';

export type ImageFileExt = 'jpg' | 'png' | 'svg' | 'bmp' | 'tiff' | 'webp' | 'gif' | 'ico';

// ImageFormat import
import type { ImageFormat } from './format-detector';

export interface ModernConversionOptions {
  format?: ImageFormat;
  quality?: number;
  fallbackFormat?: ImageFormat;
  autoOptimize?: boolean; // 자동 포맷 선택
}

// 포맷별 메타데이터
export interface FormatInfo {
  format: ImageFormat;
  mimeType: string;
  supportsTransparency: boolean;
  supportsAnimation: boolean;
  averageCompression: number; // 대략적인 압축률 (%)
}

// 레거시 타입들 제거됨 - v2.0에서는 processImage API만 사용

export type DataUrlWithSize = {
  dataUrl: string;
  width: number;
  height: number;
};

// 에러 타입 export
export {
  ImageProcessingError,
  ImageSourceError,
  ImageConversionError,
  ImageCanvasError,
  ImageResizeError,
  ImageErrorCode,
} from './errors';

export type BlobWithSize = {
  blob: Blob;
  width: number;
  height: number;
};
