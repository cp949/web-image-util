/**
 * 이미지 소스의 치수·포맷·종합 정보 조회 API.
 *
 * 실제 구현은 `utils/image-info/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type {
  FetchImageFormatOptions,
  FetchImageSourceBlobOptions,
  FetchImageSourceBlobResult,
  ImageDimensions,
  ImageInfo,
  ImageOrientation,
} from './image-info/index';

export {
  fetchImageFormat,
  fetchImageSourceBlob,
  getImageAspectRatio,
  getImageDimensions,
  getImageFormat,
  getImageInfo,
  getImageOrientation,
} from './image-info/index';
