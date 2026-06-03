/**
 * 출력 포맷 선택과 파일명 확장자 정규화를 담당하는 내부 헬퍼다.
 *
 * @description ImageProcessor의 포맷 관련 private 메서드 구현을 분리한 모듈이다.
 * 공개 동작은 그대로 유지하며, 클래스는 이 함수들에 위임한다.
 */

import type { ImageFormat, OutputFormat } from '../types';
import { OPTIMAL_QUALITY_BY_FORMAT } from '../types';
import { detectCanvasFormatSupport } from '../utils/browser-capabilities/index';

/**
 * 브라우저 지원에 따라 기본 출력 포맷을 고른다.
 *
 * WebP 지원 시 WebP, 아니면 PNG(무손실·투명도 지원)를 반환한다.
 */
export function getBestFormat(): OutputFormat {
  if (supportsFormat('webp')) {
    return 'webp';
  }
  return 'png';
}

/**
 * 포맷별 권장 품질 값을 반환한다.
 *
 * gif/svg처럼 품질 개념이 없는 포맷은 defaultQuality(없으면 0.8)를 사용한다.
 */
export function getOptimalQuality(format: ImageFormat, defaultQuality?: number): number {
  if (format === 'gif' || format === 'svg') {
    return defaultQuality ?? 0.8;
  }
  return OPTIMAL_QUALITY_BY_FORMAT[format as OutputFormat] ?? defaultQuality ?? 0.8;
}

/**
 * 브라우저의 Canvas 인코딩 포맷 지원 여부를 확인한다.
 */
export function supportsFormat(format: ImageFormat): boolean {
  return detectCanvasFormatSupport(format);
}

/**
 * 파일명에서 출력 포맷을 추출한다. 지원하지 않는 확장자는 null을 반환한다.
 */
export function getFormatFromFilename(filename: string): OutputFormat | null {
  const ext = filename.toLowerCase().split('.').pop();

  // 지원 포맷만 매핑한다.
  const formatMap: Record<string, OutputFormat> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
  };

  return formatMap[ext || ''] || null;
}

/**
 * 출력 포맷에 해당하는 권장 파일 확장자(소문자)를 반환한다.
 *
 * JPEG 계열은 일반적으로 더 흔히 쓰이는 `.jpg`로 통일한다.
 */
export function getCanonicalExtension(format: OutputFormat): string {
  if (format === 'jpeg' || format === 'jpg') return 'jpg';
  return format;
}

/**
 * 명시된 출력 포맷에 맞춰 파일명 확장자를 정규화한다.
 *
 * - 기존 확장자가 같은 포맷을 나타내면(`photo.jpg` + `jpeg`) 그대로 유지한다.
 * - 알려진 이미지 확장자(`.jpg/.jpeg/.png/.webp/.avif/.gif/.svg/.bmp/.ico/.tif/.tiff`)
 *   가 있으면 포맷에 맞는 확장자로 교체한다.
 * - 그 외에는 권장 확장자를 덧붙인다.
 */
export function applyFormatExtensionToFilename(filename: string, format: OutputFormat): string {
  const currentFormat = getFormatFromFilename(filename);
  const normalizedFormat: OutputFormat = format === 'jpg' ? 'jpeg' : format;
  if (currentFormat === normalizedFormat) {
    return filename;
  }

  const canonicalExt = getCanonicalExtension(format);
  const imageExtensionPattern = /\.(jpg|jpeg|png|webp|avif|gif|svg|bmp|ico|tiff?)$/i;
  if (imageExtensionPattern.test(filename)) {
    return filename.replace(imageExtensionPattern, `.${canonicalExt}`);
  }

  return `${filename}.${canonicalExt}`;
}
