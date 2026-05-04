/**
 * SVG Data URL을 동기적으로 UTF-8 text로 디코딩한다.
 *
 * 본 모듈은 Data URL 디코딩만 책임지며, DOMParser 검증/sanitizer/브라우저 호환성
 * 보정은 호출 측 정책에 위임한다.
 */

import { isInlineSvg } from '../svg-detection';
import { INVALID_SVG_DATA_URL_MESSAGE, throwInvalidSvgDataURL } from './errors';
import { decodeDataURLPayload, parseDataURL } from './parse';
import type { DecodedSvgDataURL } from './types';

/**
 * SVG Data URL을 동기적으로 UTF-8 text로 decode한다.
 *
 * - `image/svg+xml` MIME만 허용하며 scheme/MIME 비교는 대소문자를 구분하지 않는다.
 * - percent-encoded와 base64 payload를 모두 지원한다.
 * - DOMParser 검증, sanitizer, 브라우저 호환성 보정은 수행하지 않는다. 호출 측 정책에 위임한다.
 * - malformed Data URL, non-SVG MIME, decode 실패, SVG root가 아닌 text는 `유효한 SVG Data URL이 아닙니다`로 throw한다.
 *   원본 오류는 `Error.cause`에 보존되어 디버깅에 활용할 수 있다.
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
    // 내부에서 이미 INVALID_SVG_DATA_URL_MESSAGE로 throw한 경우 self-wrap을 피해 그대로 rethrow한다.
    if (error instanceof Error && error.message === INVALID_SVG_DATA_URL_MESSAGE) {
      throw error;
    }
    throwInvalidSvgDataURL(error);
  }
}
