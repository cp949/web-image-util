/**
 * 문자열 이미지 소스의 타입과 상세 정보를 판정한다.
 *
 * 외부 리소스를 로드하거나 data URL 본문을 디코딩하지 않는다.
 */

import { classifyStringSource, type StringSourceFacts } from './source-facts.internal';
import type { ImageStringSourceInfo, ImageStringSourceType } from './types';

/**
 * 문자열 이미지 소스의 경량 타입을 판정한다.
 *
 * 외부 리소스를 로드하거나 Data URL 본문을 디코딩하지 않고 문자열 형태만 확인한다.
 */
export function detectImageStringSourceType(source: string): ImageStringSourceType {
  return toPublicStringSourceType(classifyStringSource(source));
}

/**
 * 문자열 이미지 소스의 상세 정보를 동기적으로 판정한다.
 *
 * URL은 fetch하지 않고, Data URL은 헤더만 파싱한다.
 */
export function detectImageStringSourceInfo(source: string): ImageStringSourceInfo {
  const facts = classifyStringSource(source);
  const type = toPublicStringSourceType(facts);
  const mimeType = facts.mimeType;
  const isDataUrl = type === 'data-url' || type === 'svg-data-url';
  const isBlobUrl = type === 'blob-url';
  const isUrl = type === 'http-url' || type === 'protocol-relative-url';
  const format = facts.formatHint;

  return {
    type,
    family: 'string',
    ...(mimeType ? { mimeType } : {}),
    format,
    isSvg: type === 'inline-svg' || type === 'svg-data-url' || format === 'svg',
    isUrl,
    isDataUrl,
    isBlobUrl,
  };
}

/** 문자열 기초 사실을 기존 공개 union으로 투영한다. */
function toPublicStringSourceType(facts: StringSourceFacts): ImageStringSourceType {
  switch (facts.transport) {
    case 'inline':
      return 'inline-svg';
    case 'data-url':
      return facts.formatHint === 'svg' ? 'svg-data-url' : 'data-url';
    case 'http':
      return 'http-url';
    case 'protocol-relative':
      return 'protocol-relative-url';
    case 'blob-url':
      return 'blob-url';
    case 'path':
      return facts.formatHint === 'svg' ? 'svg-path' : 'path';
  }
}
