/**
 * 변환 유틸의 옵션 타입 정의 모음.
 *
 * @description 출력/보장 변환 함수들이 공유하는 옵션 인터페이스와 타입 alias.
 */

import type { OutputOptions } from '../../types';

/**
 * Basic Blob conversion options
 */
export interface ConvertToBlobOptions extends OutputOptions {
  // includeMetadata option removed - separated into dedicated function
}

/**
 * Detailed Blob conversion options with metadata
 */
export interface ConvertToBlobDetailedOptions extends OutputOptions {
  // Detailed information is always included
}

/**
 * Basic DataURL conversion options
 */
export interface ConvertToDataURLOptions extends OutputOptions {
  // includeMetadata option removed - separated into dedicated function
}

/**
 * Detailed DataURL conversion options with metadata
 */
export interface ConvertToDataURLDetailedOptions extends OutputOptions {
  // Detailed information is always included
}

/**
 * Basic File conversion options
 */
export interface ConvertToFileOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}

/**
 * Detailed File conversion options with metadata
 */
export interface ConvertToFileDetailedOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}

/**
 * Blob 보장 변환 옵션
 */
export type EnsureBlobOptions = ConvertToBlobOptions;

/**
 * 상세 Blob 보장 변환 옵션
 */
export type EnsureBlobDetailedOptions = ConvertToBlobDetailedOptions;

/**
 * Data URL 보장 변환 옵션
 */
export type EnsureDataURLOptions = ConvertToDataURLOptions;

/**
 * 상세 Data URL 보장 변환 옵션
 */
export type EnsureDataURLDetailedOptions = ConvertToDataURLDetailedOptions;

/**
 * File 보장 변환 옵션
 */
export type EnsureFileOptions = ConvertToFileOptions;

/**
 * 상세 File 보장 변환 옵션
 */
export type EnsureFileDetailedOptions = ConvertToFileDetailedOptions;
