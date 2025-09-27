// ImageFormat은 통합 타입 시스템에서 import
import type { ImageFormat } from '../types';
import { ImageFormats } from '../types';

export type { ImageFormat };

/**
 * 이미지 포맷과 MIME 타입 매핑
 *
 * @description 각 이미지 포맷에 대응하는 MIME 타입을 정의한 맵
 * Canvas.toBlob()이나 FileReader API에서 사용됩니다.
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
 * 브라우저 이미지 포맷 지원 감지기
 *
 * @description 현재 브라우저에서 지원하는 이미지 포맷을 검사하고 최적의 포맷을 선택하는 클래스
 * WebP, AVIF 등의 최신 포맷 지원 여부를 동적으로 확인합니다.
 */
export class FormatDetector {
  private static supportCache = new Map<ImageFormat, boolean>();

  /**
   * 특정 포맷 지원 여부 확인
   */
  static async isSupported(format: ImageFormat): Promise<boolean> {
    // 캐시된 결과 반환
    if (this.supportCache.has(format)) {
      return this.supportCache.get(format)!;
    }

    let supported = false;

    switch (format) {
      case ImageFormats.JPEG:
      case ImageFormats.JPG:
      case ImageFormats.PNG:
      case ImageFormats.GIF:
        supported = true; // 기본 지원
        break;

      case ImageFormats.WEBP:
        supported = await this.testWebPSupport();
        break;

      case ImageFormats.AVIF:
        supported = await this.testAVIFSupport();
        break;

      case ImageFormats.SVG:
        supported = true; // SVG는 기본 지원
        break;
    }

    this.supportCache.set(format, supported);
    return supported;
  }

  /**
   * WebP 지원 테스트
   */
  private static testWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webpData =
        'data:image/webp;base64,UklGRjoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==';
      const img = new Image();

      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);

      img.src = webpData;
    });
  }

  /**
   * AVIF 지원 테스트
   */
  private static testAVIFSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const avifData =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgS0AAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
      const img = new Image();

      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);

      img.src = avifData;
    });
  }

  /**
   * 지원되는 모든 포맷 반환
   */
  static async getSupportedFormats(): Promise<ImageFormat[]> {
    const formats = Object.values(ImageFormats);
    const supported: ImageFormat[] = [];

    for (const format of formats) {
      if (await this.isSupported(format)) {
        supported.push(format);
      }
    }

    return supported;
  }

  /**
   * 최적 포맷 선택 (압축률 우선순위)
   */
  static async getBestFormat(hasTransparency: boolean = false): Promise<ImageFormat> {
    // 투명도가 있는 경우
    if (hasTransparency) {
      if (await this.isSupported(ImageFormats.AVIF)) return ImageFormats.AVIF;
      if (await this.isSupported(ImageFormats.WEBP)) return ImageFormats.WEBP;
      return ImageFormats.PNG;
    }

    // 투명도가 없는 경우
    if (await this.isSupported(ImageFormats.AVIF)) return ImageFormats.AVIF;
    if (await this.isSupported(ImageFormats.WEBP)) return ImageFormats.WEBP;
    return ImageFormats.JPEG;
  }
}
