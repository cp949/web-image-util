/**
 * 이미지 소스 판정 유틸 진입점.
 *
 * 실제 구현은 `utils/source-utils/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type {
  DetectImageSourceInfoOptions,
  ImageSourceInfo,
  ImageSourceType,
  ImageStringSourceInfo,
  ImageStringSourceType,
} from './source-utils/index';
export {
  detectImageSourceInfo,
  detectImageSourceType,
  detectImageStringSourceInfo,
  detectImageStringSourceType,
} from './source-utils/index';
