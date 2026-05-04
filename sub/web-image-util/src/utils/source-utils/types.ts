/**
 * 이미지 소스 판정에 사용되는 공개 타입 정의.
 */

import type { ImageFormat } from '../../types';

/** 문자열 이미지 소스의 경량 타입. */
export type ImageStringSourceType =
  | 'inline-svg'
  | 'svg-data-url'
  | 'data-url'
  | 'http-url'
  | 'protocol-relative-url'
  | 'blob-url'
  | 'svg-path'
  | 'path';

/** 이미지 소스 전반의 경량 타입. 문자열 외에도 Element/Blob/Binary를 포함한다. */
export type ImageSourceType =
  | 'element'
  | 'canvas'
  | 'blob'
  | 'svg-blob'
  | 'array-buffer'
  | 'uint8-array'
  | ImageStringSourceType;

/** 문자열 소스의 상세 판정 결과. */
export interface ImageStringSourceInfo {
  type: ImageStringSourceType;
  family: 'string';
  mimeType?: string;
  format: ImageFormat | 'unknown';
  isSvg: boolean;
  isUrl: boolean;
  isDataUrl: boolean;
  isBlobUrl: boolean;
}

/** 이미지 소스 전반의 상세 판정 결과. */
export type ImageSourceInfo =
  | ImageStringSourceInfo
  | {
      type: Exclude<ImageSourceType, ImageStringSourceType>;
      family: 'element' | 'canvas' | 'blob' | 'binary';
      mimeType?: string;
      format: ImageFormat | 'unknown';
      isSvg: boolean;
      isUrl: false;
      isDataUrl: false;
      isBlobUrl: false;
    };

/** `detectImageSourceInfo` 옵션. */
export interface DetectImageSourceInfoOptions {
  /** Blob MIME 타입이 비어 있거나 일반 타입일 때 앞부분을 읽어 SVG 여부를 확인할지 여부다. 기본값은 true다. */
  sniffSvgBlob?: boolean;
  /** SVG Blob 스니핑에 사용할 최대 바이트 수다. 기본값은 4096이다. */
  svgSniffBytes?: number;
}
