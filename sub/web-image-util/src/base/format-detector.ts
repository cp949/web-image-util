// ImageFormat imported from unified type system
import type { ImageFormat } from '../types';
import { ImageFormats } from '../types';

export type { ImageFormat };

/**
 * Image format to MIME type mapping
 *
 * @description Map defining MIME types corresponding to each image format
 * Used by Canvas.toBlob() and FileReader API.
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
 * Browser image format support detector
 *
 * @description Class that checks supported image formats in current browser and selects optimal format
 * Dynamically verifies support for modern formats like WebP, AVIF, etc.
 */
export class FormatDetector {
  private static supportCache = new Map<ImageFormat, boolean>();

  /**
   * Check support for specific format
   */
  static async isSupported(format: ImageFormat): Promise<boolean> {
    // Return cached result
    if (this.supportCache.has(format)) {
      return this.supportCache.get(format)!;
    }

    let supported = false;

    switch (format) {
      case ImageFormats.JPEG:
      case ImageFormats.JPG:
      case ImageFormats.PNG:
      case ImageFormats.GIF:
        supported = true; // Basic support
        break;

      case ImageFormats.WEBP:
        supported = await this.testWebPSupport();
        break;

      case ImageFormats.AVIF:
        supported = await this.testAVIFSupport();
        break;

      case ImageFormats.SVG:
        supported = true; // SVG has basic support
        break;
    }

    this.supportCache.set(format, supported);
    return supported;
  }

  /**
   * Test WebP support
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
   * Test AVIF support
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
   * Return all supported formats
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
   * Select optimal format (compression ratio priority)
   */
  static async getBestFormat(hasTransparency: boolean = false): Promise<ImageFormat> {
    // Case with transparency
    if (hasTransparency) {
      if (await this.isSupported(ImageFormats.AVIF)) return ImageFormats.AVIF;
      if (await this.isSupported(ImageFormats.WEBP)) return ImageFormats.WEBP;
      return ImageFormats.PNG;
    }

    // Case without transparency
    if (await this.isSupported(ImageFormats.AVIF)) return ImageFormats.AVIF;
    if (await this.isSupported(ImageFormats.WEBP)) return ImageFormats.WEBP;
    return ImageFormats.JPEG;
  }
}
