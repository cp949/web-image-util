/**
 * Data URL 판정과 Blob 변환을 담당하는 유틸리티 모음이다.
 */

import { isInlineSvg } from './svg-detection';

const INVALID_DATA_URL_MESSAGE = '유효한 Data URL이 아닙니다';
const INVALID_SVG_DATA_URL_MESSAGE = '유효한 SVG Data URL이 아닙니다';

type ParsedDataURL = {
  isBase64: boolean;
  mimeType: string;
  payload: string;
};

export interface EstimateDataURLPayloadByteLengthOptions {
  invalid?: 'throw' | 'null';
  caseSensitiveScheme?: boolean;
}

export interface DecodedSvgDataURL {
  mimeType: 'image/svg+xml';
  text: string;
  isBase64: boolean;
}

type ParseDataURLOptions = {
  caseSensitiveScheme?: boolean;
};

/**
 * 값이 Data URL 문자열인지 판정한다.
 *
 * @param value 판정할 값
 * @returns Data URL 문자열이면 true
 */
export function isDataURLString(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('data:');
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

function parseDataURL(dataURL: string, options: ParseDataURLOptions = {}): ParsedDataURL {
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

function decodeDataURLPayload({ isBase64, payload }: ParsedDataURL): Uint8Array {
  try {
    if (isBase64) {
      return decodeBase64Payload(payload);
    }

    return decodePercentEncodedPayload(payload);
  } catch {
    throwInvalidDataURL();
  }
}

function estimateBase64PayloadByteLength(payload: string): number {
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

function estimatePercentPayloadByteLength(payload: string): number {
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

function decodePercentEncodedPayload(payload: string): Uint8Array {
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

function isHexByte(value: string): boolean {
  return /^[\da-fA-F]{2}$/.test(value);
}

function decodeBase64Payload(payload: string): Uint8Array {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function throwInvalidDataURL(): never {
  throw new Error(INVALID_DATA_URL_MESSAGE);
}

function throwInvalidSvgDataURL(cause?: unknown): never {
  // 원본 오류를 cause에 보존해 호출자가 정확한 원인(예: malformed Data URL vs. non-SVG MIME)을 추적할 수 있게 한다.
  // ES2020 lib에는 ErrorOptions가 없어 런타임에서 속성을 직접 부여한다.
  const error = new Error(INVALID_SVG_DATA_URL_MESSAGE);
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  throw error;
}
