/**
 * Data URL의 percent-encoded payload 처리.
 *
 * `%XX`는 1 byte, escape되지 않은 문자는 UTF-8 byte 길이로 환산한다.
 * 실제 디코딩 함수와 디코딩 없이 byte 길이만 추정하는 fast-path를 함께 제공한다.
 */

import { throwInvalidDataURL } from './errors';

/**
 * percent-encoded payload를 raw byte로 디코딩한다.
 *
 * @description `%XX`는 hex 한 byte로, escape되지 않은 문자는 UTF-8 byte로 변환한다.
 * 잘못된 hex나 codepoint를 만나면 INVALID_DATA_URL_MESSAGE로 throw한다.
 */
export function decodePercentEncodedPayload(payload: string): Uint8Array {
  const bytes: number[] = [];
  const encoder = new TextEncoder();

  for (let index = 0; index < payload.length; index += 1) {
    const character = payload[index];

    if (character === '%') {
      const hex = payload.slice(index + 1, index + 3);

      if (!isHexByte(hex)) {
        throwInvalidDataURL();
      }

      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }

    // escape되지 않은 문자는 Data URL 규칙에 맞춰 UTF-8 바이트로 보존한다.
    const codePoint = payload.codePointAt(index);

    if (codePoint === undefined) {
      throwInvalidDataURL();
    }

    const unescapedCharacter = String.fromCodePoint(codePoint);
    bytes.push(...encoder.encode(unescapedCharacter));

    if (codePoint > 0xffff) {
      index += 1;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * percent-encoded payload의 디코딩 후 byte 길이를 실제 디코딩 없이 추정한다.
 */
export function estimatePercentPayloadByteLength(payload: string): number {
  let bytes = 0;

  for (let index = 0; index < payload.length; index += 1) {
    const character = payload[index];

    if (character === '%') {
      const hex = payload.slice(index + 1, index + 3);

      if (!isHexByte(hex)) {
        throwInvalidDataURL();
      }

      bytes += 1;
      index += 2;
      continue;
    }

    const codePoint = payload.codePointAt(index);

    if (codePoint === undefined) {
      throwInvalidDataURL();
    }

    bytes += estimateUTF8CodePointByteLength(codePoint);

    if (codePoint > 0xffff) {
      index += 1;
    }
  }

  return bytes;
}

function estimateUTF8CodePointByteLength(codePoint: number): number {
  if (codePoint <= 0x7f) {
    return 1;
  }

  if (codePoint <= 0x7ff) {
    return 2;
  }

  if (codePoint <= 0xffff) {
    return 3;
  }

  if (codePoint <= 0x10ffff) {
    return 4;
  }

  throwInvalidDataURL();
}

function isHexByte(value: string): boolean {
  return /^[\da-fA-F]{2}$/.test(value);
}
