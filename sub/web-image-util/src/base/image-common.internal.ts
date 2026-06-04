/**
 * 브라우저 환경의 이미지 변환과 입출력을 돕는 공통 유틸리티 facade다.
 */

export {
  base64ToBuffer,
  blobToDataUrl,
  blobToFile,
  fixBlobFileExt,
  isSvgDataUrl,
  svgToBlob,
  svgToDataUrl,
  urlToBlob,
  urlToBuffer,
  urlToDataUrl,
  urlToFile,
} from './image-common/conversion.internal';
export { downloadBlob, downloadLink } from './image-common/download.internal';
export { convertImageSourceToElement, urlToElement } from './image-common/element.internal';
export {
  checkImageFormatFromString,
  imageFormatFromDataUrl,
  sourceTypeFromString,
  stringToBlob,
  stringToDataUrl,
  stringToElement,
  stringToFile,
} from './image-common/string-source.internal';
