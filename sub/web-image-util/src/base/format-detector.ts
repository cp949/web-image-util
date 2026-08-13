// 통합 타입 시스템에서 ImageFormat을 가져온다.
import type { ImageFormat } from '../types';
import { ImageFormats } from '../types';
import { detectAVIFSupport, detectWebPSupport } from '../utils/browser-capabilities/format-detection.internal';
import { MIME_TYPE_BY_FORMAT } from '../utils/format-utils';

/**
 * 이미지 포맷별 MIME 타입 매핑이다.
 *
 * @description Canvas.toBlob()과 FileReader API에서 공통으로 사용한다.
 * 정본 테이블은 utils/format-utils가 소유하며, 이 이름은 공개 표면(advanced) 유지를 위한 별칭이다.
 */
export const FORMAT_MIME_MAP: Record<ImageFormat, string> = MIME_TYPE_BY_FORMAT;

/**
 * 브라우저의 이미지 포맷 지원 여부를 판별한다.
 *
 * @description 현재 환경에서 사용할 수 있는 포맷을 확인하고 최적 포맷 선택에 활용한다.
 * WebP/AVIF 디코드 프로브와 결과 캐시는 utils/browser-capabilities가 단일 소유한다.
 */
export class FormatDetector {
  /** 특정 포맷 지원 여부를 확인한다. */
  static async isSupported(format: ImageFormat): Promise<boolean> {
    switch (format) {
      case ImageFormats.WEBP:
        return detectWebPSupport();

      case ImageFormats.AVIF:
        return detectAVIFSupport();

      default:
        // JPEG/JPG/PNG/GIF는 기본 지원 포맷이고, SVG도 기본 지원 대상으로 본다.
        return true;
    }
  }

  /** 지원 가능한 모든 포맷을 반환한다. */
  static async getSupportedFormats(): Promise<ImageFormat[]> {
    const formats = Object.values(ImageFormats);
    const supported: ImageFormat[] = [];

    for (const format of formats) {
      if (await FormatDetector.isSupported(format)) {
        supported.push(format);
      }
    }

    return supported;
  }

  /** 압축 효율을 우선해 최적 포맷을 선택한다. */
  static async getBestFormat(hasTransparency: boolean = false): Promise<ImageFormat> {
    // Case with transparency
    if (hasTransparency) {
      if (await FormatDetector.isSupported(ImageFormats.AVIF)) return ImageFormats.AVIF;
      if (await FormatDetector.isSupported(ImageFormats.WEBP)) return ImageFormats.WEBP;
      return ImageFormats.PNG;
    }

    // Case without transparency
    if (await FormatDetector.isSupported(ImageFormats.AVIF)) return ImageFormats.AVIF;
    if (await FormatDetector.isSupported(ImageFormats.WEBP)) return ImageFormats.WEBP;
    return ImageFormats.JPEG;
  }
}
