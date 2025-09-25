/**
 * 이미지 포맷 정의
 *
 * @description 지원하는 이미지 포맷:
 * - 'jpeg': JPEG 형식 (손실 압축, 투명도 미지원)
 * - 'png': PNG 형식 (무손실 압축, 투명도 지원)
 * - 'webp': WebP 형식 (고압축, 투명도 지원, 모던 브라우저)
 * - 'avif': AVIF 형식 (최고 압축률, 투명도 지원, 최신 브라우저)
 * - 'gif': GIF 형식 (애니메이션 지원, 256색 제한)
 * - 'svg': SVG 형식 (벡터 그래픽, 확장성 우수)
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg';

export const ImageFormat = {
  JPEG: 'jpeg' as const,
  PNG: 'png' as const,
  WEBP: 'webp' as const,
  AVIF: 'avif' as const,
  GIF: 'gif' as const,
  SVG: 'svg' as const,
} as const;

/**
 * MIME 타입 매핑
 */
export const FORMAT_MIME_MAP: Record<ImageFormat, string> = {
  [ImageFormat.JPEG]: 'image/jpeg',
  [ImageFormat.PNG]: 'image/png',
  [ImageFormat.WEBP]: 'image/webp',
  [ImageFormat.AVIF]: 'image/avif',
  [ImageFormat.GIF]: 'image/gif',
  [ImageFormat.SVG]: 'image/svg+xml',
};

/**
 * 브라우저 포맷 지원 감지
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
      case ImageFormat.JPEG:
      case ImageFormat.PNG:
      case ImageFormat.GIF:
        supported = true; // 기본 지원
        break;

      case ImageFormat.WEBP:
        supported = await this.testWebPSupport();
        break;

      case ImageFormat.AVIF:
        supported = await this.testAVIFSupport();
        break;

      case ImageFormat.SVG:
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
    const formats = Object.values(ImageFormat);
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
      if (await this.isSupported(ImageFormat.AVIF)) return ImageFormat.AVIF;
      if (await this.isSupported(ImageFormat.WEBP)) return ImageFormat.WEBP;
      return ImageFormat.PNG;
    }

    // 투명도가 없는 경우
    if (await this.isSupported(ImageFormat.AVIF)) return ImageFormat.AVIF;
    if (await this.isSupported(ImageFormat.WEBP)) return ImageFormat.WEBP;
    return ImageFormat.JPEG;
  }
}
