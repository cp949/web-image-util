/**
 * Data URL 유틸 진입점.
 *
 * 실제 구현은 `utils/data-url/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type { DecodedSvgDataURL, EstimateDataURLPayloadByteLengthOptions } from './data-url/index';
export {
  blobToDataURL,
  dataURLToBlob,
  decodeSvgDataURL,
  estimateDataURLPayloadByteLength,
  estimateDataURLSize,
  isDataURLString,
} from './data-url/index';
