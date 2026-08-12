/**
 * SVG Data URL을 동기적으로 UTF-8 text로 디코딩한다.
 *
 * 본 모듈은 Data URL 디코딩만 책임지며, DOMParser 검증/sanitizer/브라우저 호환성
 * 보정은 호출 측 정책에 위임한다.
 */

import { ImageProcessError } from '../../errors.internal';
import { isInlineSvg } from '../svg-detection';
import { throwInvalidSvgDataURL } from './errors.internal';
import { decodeDataURLPayload, parseDataURL } from './parse.internal';
import type { DecodedSvgDataURL } from './types';

/**
 * 문자열이 `data:image/svg+xml` 계열 Data URL인지 판정한다.
 *
 * @description 헤더 prefix만 검사하는 판정이며 쉼표 없는 잘린 입력도 허용한다.
 * scheme과 MIME 비교는 대소문자를 구분하지 않는다. 앞쪽 공백은 호출 측에서 정리한다.
 *
 * @param value 검사할 문자열
 * @returns SVG Data URL이면 true
 */
export function isSvgDataURL(value: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(value);
}

/**
 * SVG Data URL을 동기적으로 UTF-8 text로 decode한다.
 *
 * - `image/svg+xml` MIME만 허용하며 scheme/MIME 비교는 대소문자를 구분하지 않는다.
 * - percent-encoded와 base64 payload를 모두 지원한다.
 * - DOMParser 검증, sanitizer, 브라우저 호환성 보정은 수행하지 않는다. 호출 측 정책에 위임한다.
 * - malformed Data URL, non-SVG MIME, decode 실패, SVG root가 아닌 text는
 *   `INVALID_SVG_DATA_URL` code의 `ImageProcessError`로 throw한다.
 *   원본 오류는 `error.cause`에 보존되어 디버깅에 활용할 수 있다.
 *
 * @param source decode할 Data URL 문자열
 * @returns decode된 SVG text와 메타데이터
 */
export function decodeSvgDataURL(source: string): DecodedSvgDataURL {
  try {
    const parsed = parseDataURL(source, { caseSensitiveScheme: false });

    if (parsed.mimeType !== 'image/svg+xml') {
      throwInvalidSvgDataURL();
    }

    const bytes = decodeDataURLPayload(parsed);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    if (!isInlineSvg(text)) {
      throwInvalidSvgDataURL();
    }

    return {
      mimeType: 'image/svg+xml',
      text,
      isBase64: parsed.isBase64,
    };
  } catch (error) {
    // 내부에서 이미 INVALID_SVG_DATA_URL로 throw한 경우 self-wrap을 피해 그대로 rethrow한다.
    if (error instanceof ImageProcessError && error.code === 'INVALID_SVG_DATA_URL') {
      throw error;
    }
    throwInvalidSvgDataURL(error);
  }
}
