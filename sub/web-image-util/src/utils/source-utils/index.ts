/**
 * 이미지 소스 판정 유틸의 공개 진입점.
 *
 * 책임은 다음 모듈로 분리되어 있다.
 * - {@link ./types}             공개 타입 정의
 * - {@link ./mime}               MIME / data URL 헤더 파싱 헬퍼
 * - {@link ./path}               경로/URL 확장자 → ImageFormat 매핑
 * - {@link ./type-guards}        비문자열 소스(Element/Canvas/Blob)의 타입 가드
 * - `source-facts.internal.ts`   문자열·Blob 기초 판정 정본(비공개)
 * - {@link ./string-detection.internal}   문자열 소스의 동기 타입/상세 판정
 * - {@link ./detect.internal}             모든 소스 종류 통합 판정(동기/비동기)
 *
 * 외부에서는 이 배럴 또는 상위 `utils/source-utils`를 통해서만 import한다.
 */

export { detectImageSourceInfo, detectImageSourceType } from './detect.internal';
export { detectImageStringSourceInfo, detectImageStringSourceType } from './string-detection.internal';
export type {
  DetectImageSourceInfoOptions,
  ImageSourceInfo,
  ImageSourceType,
  ImageStringSourceInfo,
  ImageStringSourceType,
} from './types';
