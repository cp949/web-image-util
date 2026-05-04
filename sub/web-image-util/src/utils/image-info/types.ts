/**
 * 이미지 정보 조회 API의 공개 타입 정의.
 *
 * 치수, 종합 정보, 원격 fetch 옵션·결과, 방향 값 등 외부에 노출되는 모든 타입은
 * 이 파일에 모아 둔다. 구현 모듈은 여기에서만 타입을 import한다.
 */

import type { ImageFormat } from '../../types';

/** 이미지 치수 정보다. */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** 입력 이미지에서 확인한 치수와 포맷 정보다. */
export interface ImageInfo extends ImageDimensions {
  /** 입력에서 확인한 이미지 포맷이다. DOM 요소처럼 원본 포맷을 알 수 없으면 `unknown`이다. */
  format: ImageFormat | 'unknown';
}

/** 네트워크 조회 기반 이미지 포맷 판정 옵션이다. */
export interface FetchImageFormatOptions {
  /** 응답 앞부분에서 읽을 최대 바이트 수다. 기본값은 4096이다. */
  sniffBytes?: number;
  /** fetch 요청에 전달할 추가 옵션이다. `method`는 본문 스니핑을 위해 항상 GET으로 고정된다. */
  fetchOptions?: Omit<RequestInit, 'body' | 'method'>;
}

export interface FetchImageSourceBlobOptions {
  allowedProtocols?: string[];
  maxBytes?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  fetchOptions?: Omit<RequestInit, 'body' | 'method' | 'signal'>;
}

export interface FetchImageSourceBlobResult {
  blob: Blob;
  bytes: number;
  contentType: string;
  url: string;
  responseUrl: string;
  status: number;
}

/** 이미지 치수 기준 방향 값이다. */
export type ImageOrientation = 'landscape' | 'portrait' | 'square';
