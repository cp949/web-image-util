// ImageSource는 통합 타입 시스템에서 import
import type { ImageSource } from '../types';

export type { ImageSource };

/**
 * 이미지 소스 변환 옵션
 *
 * @description 이미지 소스를 HTMLImageElement로 변환할 때 사용되는 옵션
 */
export interface ImageSourceConvertOptions {
  crossOrigin?: string;
  elementSize?: { width: number; height: number };
}

/**
 * 이미지 문자열 소스 타입
 *
 * @description 문자열로 표현된 이미지 소스의 종류를 나타내는 타입
 */
export type ImageStringSourceType = 'SVG_XML' | 'DATA_URL' | 'HTTP_URL' | 'PATH';

/**
 * 이미지 파일 확장자
 *
 * @description 지원되는 이미지 파일 확장자 목록
 */
export type ImageFileExt = 'jpg' | 'png' | 'svg' | 'bmp' | 'tiff' | 'webp' | 'gif' | 'ico';

// ImageFormat, OutputFormat는 통합 타입 시스템에서 import
import type { ImageFormat, OutputFormat } from '../types';

export interface ModernConversionOptions {
  format?: OutputFormat;
  quality?: number;
  fallbackFormat?: OutputFormat;
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

// processImage API 전용 타입 정의

export type DataUrlWithSize = {
  dataUrl: string;
  width: number;
  height: number;
};

// 특화된 에러 클래스들 export (기본 에러 타입은 통합 시스템에서 가져옴)
export { ImageSourceError, ImageConversionError, ImageCanvasError, ImageResizeError } from './errors';

export type BlobWithSize = {
  blob: Blob;
  width: number;
  height: number;
};
