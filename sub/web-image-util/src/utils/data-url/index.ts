/**
 * Data URL 유틸 서브모듈의 공개 진입점.
 *
 * 책임은 다음 모듈로 분리되어 있다.
 * - {@link ./types}   공개 타입 정의
 * - {@link ./errors}  오류 메시지 상수와 throw 헬퍼
 * - {@link ./base64}  base64 payload 디코딩과 byte 길이 추정
 * - {@link ./percent} percent-encoded payload 디코딩과 byte 길이 추정
 * - {@link ./parse}   Data URL 헤더 파싱과 payload 디코딩 디스패치
 * - {@link ./svg}     SVG Data URL → UTF-8 text 디코더
 * - {@link ./public}  Blob 변환·크기 추정 등 공개 API 본체
 *
 * 외부에서는 이 배럴 또는 상위 `utils/data-url`을 통해서만 import한다.
 */

export {
  blobToDataURL,
  dataURLToBlob,
  estimateDataURLPayloadByteLength,
  estimateDataURLSize,
  isDataURLString,
} from './public';

export { decodeSvgDataURL } from './svg';

export type { DecodedSvgDataURL, EstimateDataURLPayloadByteLengthOptions } from './types';
