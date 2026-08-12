/**
 * Data URL 공개 API.
 *
 * Blob 변환과 payload 크기 추정 등 외부에서 직접 호출하는 함수만 모았다.
 * SVG 전용 디코더는 {@link ./svg}, 파싱/디코딩 코어는 {@link ./parse.internal}에 위치한다.
 */

import { estimateBase64PayloadByteLength } from './base64.internal';
import { decodeDataURLPayload, parseDataURL } from './parse.internal';
import { estimatePercentPayloadByteLength } from './percent.internal';
import type { EstimateDataURLPayloadByteLengthOptions } from './types';

/**
 * 값이 Data URL 문자열인지 판정한다.
 *
 * @description scheme 비교는 대소문자를 구분하지 않으며 앞쪽 공백을 무시한다.
 * 라이브러리 전체의 `data:` 여부 판정은 이 함수 하나로 수렴한다.
 *
 * string 인자 오버로드는 부정 분기가 `never`로 좁혀지는 것을 막기 위한 것으로,
 * unknown 인자에서만 타입 narrowing이 일어난다.
 *
 * @param value 판정할 값
 * @returns Data URL 문자열이면 true
 */
export function isDataURLString(value: string): boolean;
export function isDataURLString(value: unknown): value is string;
export function isDataURLString(value: unknown): boolean {
  return typeof value === 'string' && value.trimStart().slice(0, 'data:'.length).toLowerCase() === 'data:';
}

/**
 * Data URL 헤더의 첫 MIME 타입 토큰을 정규화해 반환한다.
 *
 * @description 헤더의 파라미터(`;charset=...` 등)와 base64 마커는 제외한다.
 * 쉼표가 없는 잘린 입력도 헤더 힌트로 취급해 MIME을 추출한다(전체 파싱은 parseDataURL 담당).
 *
 * @param source 검사할 문자열
 * @returns 정규화된 MIME 타입. Data URL이 아니거나 MIME 토큰이 비어 있으면 undefined
 */
export function parseDataURLMimeType(source: string): string | undefined {
  const trimmed = source.trimStart();
  if (!isDataURLString(trimmed)) {
    return undefined;
  }

  const commaIndex = trimmed.indexOf(',');
  const header = trimmed.slice('data:'.length, commaIndex >= 0 ? commaIndex : undefined);
  const mimeType = header.split(';', 1)[0]?.trim().toLowerCase() ?? '';

  return mimeType || undefined;
}

/**
 * Blob을 base64 Data URL 문자열로 변환한다.
 *
 * @param blob 변환할 Blob
 * @returns Data URL 문자열
 */
export async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob to Data URL conversion failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Data URL을 Blob으로 변환한다.
 *
 * @param dataURL 변환할 Data URL 문자열
 * @returns 디코딩된 Blob
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parsed = parseDataURL(dataURL);
  const bytes = decodeDataURLPayload(parsed);

  return new Blob([toArrayBuffer(bytes)], { type: parsed.mimeType });
}

/**
 * Data URL payload를 디코딩한 원본 바이트 크기로 추정한다.
 *
 * @param dataURL 크기를 계산할 Data URL 문자열
 * @returns 디코딩된 payload의 바이트 수
 */
export function estimateDataURLSize(dataURL: string): number {
  const parsed = parseDataURL(dataURL);

  return decodeDataURLPayload(parsed).byteLength;
}

/**
 * Data URL payload의 디코딩 후 byte 길이를 payload를 실제 디코딩하지 않고 추정한다.
 *
 * - base64 payload는 whitespace 제거 후 길이와 padding으로 계산한다.
 * - percent-encoded payload는 `%XX`를 1 byte로 세고 escape되지 않은 문자는 UTF-8 byte 길이로 센다.
 * - scheme 비교는 기본적으로 대소문자를 구분하지 않으며, `caseSensitiveScheme: true`로 엄격 모드를 사용할 수 있다.
 * - malformed input은 기본적으로 `INVALID_DATA_URL` code의 `ImageProcessError`로 throw하며, `invalid: 'null'` 옵션을 주면 `null`을 반환한다.
 *
 * @param dataURL 검사할 Data URL 문자열
 * @param options 동작 옵션
 * @returns payload의 byte 수 또는 `null`
 */
export function estimateDataURLPayloadByteLength(
  dataURL: string,
  options: EstimateDataURLPayloadByteLengthOptions = {}
): number | null {
  try {
    const parsed = parseDataURL(dataURL, { caseSensitiveScheme: options.caseSensitiveScheme ?? false });

    return parsed.isBase64
      ? estimateBase64PayloadByteLength(parsed.payload)
      : estimatePercentPayloadByteLength(parsed.payload);
  } catch (error) {
    if (options.invalid === 'null') {
      return null;
    }

    throw error;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  return buffer;
}
