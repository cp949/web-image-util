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
 * 완화할 수 있다. malformed 입력은 INVALID_DATA_URL_MESSAGE로 throw한다.
 */
export function parseDataURL(dataURL: string, options: ParseDataURLOptions = {}): ParsedDataURL {
  const normalizedDataURL = dataURL.trimStart();
  const caseSensitiveScheme = options.caseSensitiveScheme ?? true;
  const hasDataScheme = caseSensitiveScheme
    ? normalizedDataURL.startsWith('data:')
    : normalizedDataURL.slice(0, 'data:'.length).toLowerCase() === 'data:';

  if (!hasDataScheme) {
    throwInvalidDataURL();
  }

  const commaIndex = normalizedDataURL.indexOf(',');

  if (commaIndex === -1) {
    throwInvalidDataURL();
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
 * 디코딩 모듈에서 던진 오류는 INVALID_DATA_URL_MESSAGE로 정규화되어 전파된다.
 */
export function decodeDataURLPayload({ isBase64, payload }: ParsedDataURL): Uint8Array {
  try {
    if (isBase64) {
      return decodeBase64Payload(payload);
    }

    return decodePercentEncodedPayload(payload);
  } catch {
    throwInvalidDataURL();
  }
}
