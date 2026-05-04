/**
 * Data URL의 base64 payload 처리.
 *
 * 실제 디코딩과 디코딩 없이 byte 길이만 추정하는 fast-path를 함께 제공한다.
 */

import { throwInvalidDataURL } from './errors';

/**
 * base64 payload를 디코딩해 raw byte로 반환한다.
 *
 * @description 예외 처리는 호출 측이 담당한다. 잘못된 base64는 `atob`이 던지는
 * 오류가 그대로 전파되며, 상위 `decodeDataURLPayload`에서 INVALID_DATA_URL_MESSAGE로 정규화한다.
 */
export function decodeBase64Payload(payload: string): Uint8Array {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/**
 * base64 payload의 디코딩 후 byte 길이를 실제 디코딩 없이 추정한다.
 *
 * @description whitespace는 제외하고, padding(`=`)은 최대 2개까지 허용하며 부적합한 문자가
 * 발견되면 `유효한 Data URL이 아닙니다`로 throw한다.
 */
export function estimateBase64PayloadByteLength(payload: string): number {
  let normalizedLength = 0;
  let padding = 0;
  let hasPadding = false;

  for (let index = 0; index < payload.length; index += 1) {
    const character = payload[index];

    if (isBase64IgnoredWhitespace(character)) {
      continue;
    }

    normalizedLength += 1;

    if (character === '=') {
      hasPadding = true;
      padding += 1;

      if (padding > 2) {
        throwInvalidDataURL();
      }

      continue;
    }

    if (hasPadding || !isBase64Character(character)) {
      throwInvalidDataURL();
    }
  }

  if (normalizedLength === 0) {
    return 0;
  }

  if (normalizedLength % 4 === 1 || (hasPadding && normalizedLength % 4 !== 0)) {
    throwInvalidDataURL();
  }

  return Math.floor((normalizedLength * 3) / 4) - padding;
}

function isBase64Character(character: string): boolean {
  const code = character.charCodeAt(0);

  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    character === '+' ||
    character === '/'
  );
}

function isBase64IgnoredWhitespace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\r' || character === '\n' || character === '\f';
}
