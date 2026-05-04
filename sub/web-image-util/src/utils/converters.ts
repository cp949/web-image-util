/**
 * 이미지 입력을 Blob/Data URL/File/HTMLImageElement로 변환하는 유틸 모음.
 *
 * 실제 구현은 `utils/converters/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type {
  ConvertToBlobDetailedOptions,
  ConvertToBlobOptions,
  ConvertToDataURLDetailedOptions,
  ConvertToDataURLOptions,
  ConvertToFileDetailedOptions,
  ConvertToFileOptions,
  EnsureBlobDetailedOptions,
  EnsureBlobOptions,
  EnsureDataURLDetailedOptions,
  EnsureDataURLOptions,
  EnsureFileDetailedOptions,
  EnsureFileOptions,
} from './converters/index';
export {
  convertToBlob,
  convertToBlobDetailed,
  convertToDataURL,
  convertToDataURLDetailed,
  convertToElement,
  convertToFile,
  convertToFileDetailed,
  ensureBlob,
  ensureBlobDetailed,
  ensureDataURL,
  ensureDataURLDetailed,
  ensureFile,
  ensureFileDetailed,
  ensureImageElement,
  ensureImageElementDetailed,
  isDataURLString,
} from './converters/index';
