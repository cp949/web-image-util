/**
 * Data URL 헤더 파싱과 payload 디코딩 디스패치.
 *
 * - {@link parseDataURL}      `data:[mime][;base64],payload` 구조를 분해한다.
 * - {@link decodeDataURLPayload} parsed 결과의 base64/percent 여부에 맞춰 디코딩 모듈을 호출한다.
 */

import { decodeBase64Payload } from './base64';
import { throwInvalidDataURL } from './errors';
import { decodePercentEncodedPayload } from './percent';
import type { ParseDataURLOptions, ParsedDataURL } from './types';

/**
 * Data URL을 scheme/MIME/payload로 분해한다.
 *
 * @description scheme 비교는 기본적으로 대소문자 구분이며, `caseSensitiveScheme: false`로
 * 완화할 수 있다. malformed 입력은 `INVALID_DATA_URL` code의 `ImageProcessError`로 throw한다.
 */
export function parseDataURL(dataURL: string, options: ParseDataURLOptions = {}): ParsedDataURL {
  const normalizedDataURL = dataURL.trimStart();
  const caseSensitiveScheme = options.caseSensitiveScheme ?? true;
  const hasDataScheme = caseSensitiveScheme
    ? normalizedDataURL.startsWith('data:')
    : normalizedDataURL.slice(0, 'data:'.length).toLowerCase() === 'data:';

  if (!hasDataScheme) {
    throwInvalidDataURL('malformed');
  }

  const commaIndex = normalizedDataURL.indexOf(',');

  if (commaIndex === -1) {
    throwInvalidDataURL('malformed');
  }

  const metadata = normalizedDataURL.slice('data:'.length, commaIndex);
  const payload = normalizedDataURL.slice(commaIndex + 1);
  const metadataParts = metadata.split(';').filter(Boolean);
  const mimeType = metadataParts[0]?.includes('/') ? metadataParts[0].toLowerCase() : '';
  const isBase64 = metadataParts.some((part) => part.toLowerCase() === 'base64');

  return { isBase64, mimeType, payload };
}

/**
 * parseDataURL 결과의 payload를 raw byte로 디코딩한다.
 *
 * @description base64/percent-encoding 분기와 디코딩 모듈 위임만 담당한다.
 * base64는 `atob` 실패를 `INVALID_DATA_URL(invalid-base64)`으로 정규화하며 원본 오류는 `cause`로 보존한다.
 * percent는 `decodePercentEncodedPayload`가 이미 `INVALID_DATA_URL(invalid-percent)`로 throw하므로 그대로 전파한다.
 */
export function decodeDataURLPayload({ isBase64, payload }: ParsedDataURL): Uint8Array {
  if (!isBase64) {
    // percent 디코더가 이미 ImageProcessError로 throw하므로 그대로 전파한다.
    return decodePercentEncodedPayload(payload);
  }

  try {
    return decodeBase64Payload(payload);
  } catch (cause) {
    // atob의 DOMException을 INVALID_DATA_URL로 정규화하되 원본은 cause로 보존한다.
    throwInvalidDataURL('invalid-base64', cause);
  }
}
