/**
 * 변환 유틸의 옵션 타입 정의 모음.
 *
 * @description 보장(ensure*) 변환 함수들이 공유하는 옵션 인터페이스.
 */

import type { OutputOptions } from '../../types';

/**
 * Blob 보장 변환 옵션
 */
export interface EnsureBlobOptions extends OutputOptions {
  // includeMetadata 옵션 제거 — 별도 *Detailed 함수로 분리됨
}

/**
 * 상세 Blob 보장 변환 옵션
 */
export interface EnsureBlobDetailedOptions extends OutputOptions {
  // 상세 정보는 항상 포함됨
}

/**
 * Data URL 보장 변환 옵션
 */
export interface EnsureDataURLOptions extends OutputOptions {
  // includeMetadata 옵션 제거 — 별도 *Detailed 함수로 분리됨
}

/**
 * 상세 Data URL 보장 변환 옵션
 */
export interface EnsureDataURLDetailedOptions extends OutputOptions {
  // 상세 정보는 항상 포함됨
}

/**
 * File 보장 변환 옵션
 */
export interface EnsureFileOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}

/**
 * 상세 File 보장 변환 옵션
 */
export interface EnsureFileDetailedOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}
