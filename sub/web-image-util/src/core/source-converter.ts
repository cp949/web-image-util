/**
 * 다양한 입력 소스를 HTMLImageElement로 정규화하는 변환기다.
 *
 * 실제 구현은 `core/source-converter/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type { SourceType } from './source-converter/detect';
export { detectSourceType } from './source-converter/detect';
export { convertToImageElement, getImageDimensions } from './source-converter/index';
export type { SvgPassthroughMode } from './source-converter/options';
