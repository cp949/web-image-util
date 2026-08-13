/**
 * 입력 소스의 형태를 판별해 변환 경로를 라우팅하는 모듈이다.
 *
 * 문자열 입력의 기초 사실은 `source-facts.internal.ts`가 단독으로 판정한다. 이 모듈은 그 사실을
 * SVG 하위 유형까지 구분하는 내부 union으로 투영하며, 문자열 로더는 이 판정 결과만 보고 분기한다.
 *
 * 객체 입력과 Blob의 메타데이터 판정은 동기 함수가 담당하고, `detectSourceTypeAsync`가
 * 크기 상한을 먼저 검사한 뒤 빈 MIME·octet-stream·text/plain·XML 후보의 본문을 스니핑해
 * 최종 판정을 확정한다.
 */

import type { ImageSource } from '../../types';
import { ImageProcessError } from '../../types';
import {
  type BlobSourceFacts,
  classifyStringSource,
  inspectBlobMetadata,
  type StringSourceFacts,
  sniffBlobSvgIfCandidate,
} from '../../utils/source-utils/source-facts.internal';
import { DEFAULT_MAX_SOURCE_BYTES } from './options.internal';

/**
 * 문자열 입력의 판정 결과다.
 *
 * SVG는 형태마다 처리 경로(즉시 렌더 / Data URL 복원 / fetch 검증)가 달라서
 * 단일 `'svg'`로 뭉치지 않고 하위 유형까지 구분한다.
 */
export type StringSourceType =
  /** 인라인 SVG XML 문자열 */
  | 'svg-inline'
  /** `image/svg+xml` Data URL */
  | 'svg-datauri'
  /** http(s) 또는 protocol-relative URL이 가리키는 `.svg` 리소스 */
  | 'svg-url'
  /** 스킴 없는 경로가 가리키는 `.svg` 리소스 */
  | 'svg-path'
  /** SVG가 아닌 Data URL */
  | 'dataurl'
  /** SVG가 아닌 http(s) 또는 protocol-relative URL */
  | 'url'
  /** `URL.createObjectURL`로 만든 Blob URL */
  | 'bloburl'
  /** 그 외 파일 경로 */
  | 'path';

/** 지원하는 이미지 입력 소스 타입이다. */
export type SourceType = 'element' | 'canvas' | 'blob' | 'svg-blob' | 'arrayBuffer' | 'uint8Array' | StringSourceType;

/**
 * SVG 전용 처리 경로로 보내야 하는 판정 결과인지 확인한다.
 *
 * @param type 판정 결과
 * @returns SVG 계열이면 true
 */
export function isSvgSourceType(type: SourceType): boolean {
  return (
    type === 'svg-inline' || type === 'svg-datauri' || type === 'svg-url' || type === 'svg-path' || type === 'svg-blob'
  );
}

/**
 * 문자열 입력의 형태를 판별한다.
 *
 * SVG Data URL, 인라인 SVG, 일반 Data URL, HTTP URL, protocol-relative URL,
 * Blob URL, 파일 경로 순으로 확인한다. 원격 리소스를 읽지 않는 동기 판정이다.
 *
 * @param source 분석할 문자열 입력
 * @returns 문자열 소스 타입
 */
export function detectStringSourceType(source: string): StringSourceType {
  return toInternalStringSourceType(classifyStringSource(source));
}

/** 문자열 기초 사실을 내부 라우팅 union으로 투영한다. */
function toInternalStringSourceType(facts: StringSourceFacts): StringSourceType {
  switch (facts.transport) {
    case 'inline':
      return 'svg-inline';
    case 'data-url':
      return facts.formatHint === 'svg' ? 'svg-datauri' : 'dataurl';
    case 'http':
    case 'protocol-relative':
      return facts.formatHint === 'svg' ? 'svg-url' : 'url';
    case 'blob-url':
      return 'bloburl';
    case 'path':
      return facts.formatHint === 'svg' ? 'svg-path' : 'path';
  }
}

/**
 * 입력값의 실제 형태를 판별해 적절한 변환 경로로 라우팅한다.
 *
 * 문자열 입력은 {@link detectStringSourceType}에 위임하고,
 * 객체 입력은 `instanceof`와 덕 타이핑을 함께 사용해 브라우저 호환성을 확보한다.
 *
 * @param source 분석할 이미지 입력
 * @returns 후속 처리 파이프라인에 사용할 소스 타입
 * @throws {ImageProcessError} 지원하지 않는 입력이면
 */
export function detectSourceType(source: ImageSource): SourceType {
  if (source instanceof HTMLImageElement) {
    return 'element';
  }

  // Detect HTMLCanvasElement
  if (
    source instanceof HTMLCanvasElement ||
    (source &&
      typeof source === 'object' &&
      'getContext' in source &&
      'toDataURL' in source &&
      typeof (source as any).getContext === 'function')
  ) {
    return 'canvas';
  }

  // Detect Blob - use both instanceof and duck typing
  if (isBlobLikeSource(source)) {
    const blob = source as Blob;
    const facts = inspectBlobMetadata(blob);
    return hasInternalSvgMetadataHint(facts) ? 'svg-blob' : 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'arrayBuffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8Array';
  }

  if (typeof source === 'string') {
    return detectStringSourceType(source);
  }

  throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
}

/**
 * Blob 본문 스니핑까지 포함해 입력 소스의 최종 형태를 판별한다.
 *
 * 동기 판정에서 SVG로 확정되지 않은 Blob 중 MIME이 비어 있거나 octet-stream·text/plain·XML
 * 계열인 입력만 첫 4KB를 읽는다. 그 외 입력은 동기 판정 결과를 그대로 유지한다.
 *
 * @param source 분석할 이미지 입력
 * @param maxSourceBytes Blob 본문을 읽기 전에 적용할 최대 바이트 수. 0이면 제한하지 않음
 * @returns 후속 처리 파이프라인에 사용할 최종 소스 타입
 */
export async function detectSourceTypeAsync(
  source: ImageSource,
  maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES
): Promise<SourceType> {
  if (isBlobLikeSource(source)) {
    const blob = source as Blob;
    assertBlobSizeWithinLimit(blob, maxSourceBytes);
    const facts = inspectBlobMetadata(blob);
    if (hasInternalSvgMetadataHint(facts)) {
      return 'svg-blob';
    }

    return (await sniffBlobSvgIfCandidate(blob, facts)) ? 'svg-blob' : 'blob';
  }

  return detectSourceType(source);
}

/**
 * 내부 라우팅은 MIME과 파일명 중 하나라도 SVG이면 보수적으로 SVG 경로를 선택한다.
 *
 * 공개 진단의 MIME 우선 정책(`blob-projection.internal.ts`)과 의도적으로 다르다.
 * fetch로 얻은 Blob처럼 파일명이 없는 입력에서도 같은 술어를 쓰도록 export한다 —
 * 소비자가 조건을 각자 조립하면 정책이 다시 갈린다.
 */
export function hasInternalSvgMetadataHint(facts: BlobSourceFacts): boolean {
  return facts.mimeFormat === 'svg' || facts.fileNameFormat === 'svg';
}

/** 실제 Blob과 호환 가능한 Blob-like 입력을 함께 판정한다. */
function isBlobLikeSource(source: ImageSource): boolean {
  return (
    source instanceof Blob ||
    (typeof source === 'object' &&
      source !== null &&
      'type' in source &&
      'size' in source &&
      ('slice' in source || 'arrayBuffer' in source))
  );
}

/** Blob 본문을 읽기 전에 설정된 소스 크기 상한을 검사한다. */
export function assertBlobSizeWithinLimit(blob: Blob, maxBytes = DEFAULT_MAX_SOURCE_BYTES): void {
  if (maxBytes > 0 && blob.size > maxBytes) {
    throw new ImageProcessError(
      `Blob size (${blob.size} bytes) exceeds the maximum allowed (${maxBytes} bytes)`,
      'SOURCE_BYTES_EXCEEDED',
      { details: { actualBytes: blob.size, maxBytes } }
    );
  }
}
