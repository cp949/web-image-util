/**
 * Data URL 서브모듈 공개 타입 정의.
 */

/** parseDataURL이 반환하는 분해 결과 — 서브모듈 간 공유되는 내부 타입 */
export type ParsedDataURL = {
  isBase64: boolean;
  mimeType: string;
  payload: string;
};

/** parseDataURL 호출 옵션 */
export type ParseDataURLOptions = {
  caseSensitiveScheme?: boolean;
};

/** {@link estimateDataURLPayloadByteLength} 호출 옵션 */
export interface EstimateDataURLPayloadByteLengthOptions {
  invalid?: 'throw' | 'null';
  caseSensitiveScheme?: boolean;
}

/** {@link decodeSvgDataURL} 결과 */
export interface DecodedSvgDataURL {
  mimeType: 'image/svg+xml';
  text: string;
  isBase64: boolean;
}
