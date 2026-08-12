/**
 * 변환 유틸의 옵션 타입 정의 모음.
 *
 * @description 보장(ensure*) 변환 함수들이 공유하는 옵션 인터페이스.
 */

import type { OutputOptions } from '../../types';

/**
 * Blob 보장 변환 옵션. 출력 옵션과 동일하다.
 *
 * @description 상세 정보는 `ensureBlobDetailed`로 분리돼 있어 별도 옵션이 없다.
 */
export type EnsureBlobOptions = OutputOptions;

/**
 * 상세 Blob 보장 변환 옵션. 출력 옵션과 동일하다.
 */
export type EnsureBlobDetailedOptions = OutputOptions;

/**
 * Data URL 보장 변환 옵션. 출력 옵션과 동일하다.
 *
 * @description 상세 정보는 `ensureDataURLDetailed`로 분리돼 있어 별도 옵션이 없다.
 */
export type EnsureDataURLOptions = OutputOptions;

/**
 * 상세 Data URL 보장 변환 옵션. 출력 옵션과 동일하다.
 */
export type EnsureDataURLDetailedOptions = OutputOptions;

/**
 * File 보장 변환 옵션. 출력 옵션에 확장자 자동 조정을 더한다.
 */
export interface EnsureFileOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}

/**
 * 상세 File 보장 변환 옵션. `EnsureFileOptions`와 동일하다.
 */
export type EnsureFileDetailedOptions = EnsureFileOptions;
