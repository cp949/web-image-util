// 통합 타입 시스템에서 ImageFormat을 가져온다.
import type { ImageFormat } from '../types';
import { ImageFormats } from '../types';
import { createImageElement } from '../utils/image-element';

export type { ImageFormat };

/**
 * 이미지 포맷별 MIME 타입 매핑이다.
 *
 * @description Canvas.toBlob()과 FileReader API에서 공통으로 사용한다.
 */
export const FORMAT_MIME_MAP: Record<ImageFormat, string> = {
  [ImageFormats.JPEG]: 'image/jpeg',
  [ImageFormats.JPG]: 'image/jpeg',
  [ImageFormats.PNG]: 'image/png',
  [ImageFormats.WEBP]: 'image/webp',
  [ImageFormats.AVIF]: 'image/avif',
  [ImageFormats.GIF]: 'image/gif',
  [ImageFormats.SVG]: 'image/svg+xml',
};

/**
 * 브라우저의 이미지 포맷 지원 여부를 판별한다.
 *
 * @description 현재 환경에서 사용할 수 있는 포맷을 확인하고 최적 포맷 선택에 활용한다.
 */
export class FormatDetector {
  private static supportCache = new Map<ImageFormat, boolean>();

  /** 특정 포맷 지원 여부를 확인한다. */
  static async isSupported(format: ImageFormat): Promise<boolean> {
    // 이미 계산한 결과가 있으면 캐시를 재사용한다.
    if (FormatDetector.supportCache.has(format)) {
      return FormatDetector.supportCache.get(format)!;
    }

    let supported = false;

    switch (format) {
      case ImageFormats.JPEG:
      case ImageFormats.JPG:
      case ImageFormats.PNG:
      case ImageFormats.GIF:
        supported = true; // 기본 지원 포맷이다.
        break;

      case ImageFormats.WEBP:
        supported = await FormatDetector.testWebPSupport();
        break;

      case ImageFormats.AVIF:
        supported = await FormatDetector.testAVIFSupport();
        break;

      case ImageFormats.SVG:
        supported = true; // SVG는 기본 지원 대상으로 본다.
        break;
    }

    FormatDetector.supportCache.set(format, supported);
    return supported;
  }

  /** WebP 지원 여부를 테스트한다. */
  private static testWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webpData =
        'data:image/webp;base64,UklGRjoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==';
      const img = createImageElement();

      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);

      img.src = webpData;
    });
  }

  /** AVIF 지원 여부를 테스트한다. */
  private static testAVIFSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const avifData =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgS0AAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
      const img = createImageElement();

      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);

      img.src = avifData;
    });
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
