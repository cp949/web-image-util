/**
 * SVG 문자열을 다루는 전용 처리 유틸리티다.
 *
 * @description SVG 정규화, 크기 추출, 브라우저 호환 보정을 함께 담당한다.
 */

import { ImageProcessError } from '../types';
import { enhanceSvgForBrowser } from './svg-compatibility';

/** SVG 크기 정보다. */
export interface SVGDimensions {
  width: number;
  height: number;
}

/** SVG 처리 옵션이다. */
export interface SVGProcessOptions {
  /** 크기 정보가 없을 때 사용할 기본 너비 */
  defaultWidth?: number;

  /** 크기 정보가 없을 때 사용할 기본 높이 */
  defaultHeight?: number;

  /** SVG 정규화 여부 */
  normalize?: boolean;

  /** CORS 설정 */
  crossOrigin?: string;
}

/**
 * SVG를 안전하게 HTMLImageElement로 변환한다.
 *
 * @description 필요하면 크기 보정과 정규화도 함께 수행한다.
 */
export class SVGProcessor {
  /**
   * SVG 문자열을 HTMLImageElement로 변환한다.
   *
   * @param svgString SVG XML 문자열
   * @param options 처리 옵션
   * @returns 변환된 이미지 요소
   */
  static async processSVGString(svgString: string, options: SVGProcessOptions = {}): Promise<HTMLImageElement> {
    const { normalize = true, crossOrigin } = options;

    try {
      // 필요하면 SVG를 브라우저 친화적으로 정규화한다.
      const processedSvg = normalize ? enhanceSvgForBrowser(svgString) : svgString;

      // SVG 크기를 추출하고 비어 있으면 기본값을 채운다.
      const dimensions = this.extractSVGDimensions(processedSvg);
      let finalSvg = processedSvg;

      if (!dimensions && (options.defaultWidth || options.defaultHeight)) {
        const width = options.defaultWidth || 300;
        const height = options.defaultHeight || 300;
        finalSvg = this.addDimensionsToSVG(processedSvg, width, height);
      }

      // Blob URL로 바꿔 일반 이미지 로더 경로를 재사용한다.
      const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);

      try {
        const img = document.createElement('img');

        if (crossOrigin) {
          img.crossOrigin = crossOrigin;
        }

        // 이미지 로딩이 끝날 때까지 기다린다.
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new ImageProcessError('SVG loading failed', 'SVG_LOAD_FAILED'));
          img.src = objectUrl;
        });

        return img;
      } finally {
        // 사용한 Object URL은 반드시 정리한다.
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }
      throw new ImageProcessError(
        `Error occurred during SVG processing: ${error instanceof Error ? error.message : String(error)}`,
        'SVG_PROCESSING_FAILED'
      );
    }
  }

  /**
   * SVG 문자열에서 크기 정보를 추출한다.
   *
   * @param svgString SVG XML 문자열
   * @returns 추출한 크기 정보 또는 null
   */
  static extractSVGDimensions(svgString: string): SVGDimensions | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) {
        return null;
      }

      // 1. width/height 속성에서 직접 추출한다.
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr && heightAttr) {
        const width = this.parseNumericValue(widthAttr);
        const height = this.parseNumericValue(heightAttr);

        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      // 2. viewBox가 있으면 그 값을 사용한다.
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const values = viewBox.trim().split(/\s+/).map(Number);
        if (values.length === 4 && values[2] > 0 && values[3] > 0) {
          return {
            width: values[2], // viewBox 너비
            height: values[3], // viewBox 높이
          };
        }
      }

      // 3. style 속성도 보조적으로 확인한다.
      const style = svgElement.getAttribute('style');
      if (style) {
        const widthMatch = style.match(/width\s*:\s*([^;]+)/);
        const heightMatch = style.match(/height\s*:\s*([^;]+)/);

        if (widthMatch && heightMatch) {
          const width = this.parseNumericValue(widthMatch[1].trim());
          const height = this.parseNumericValue(heightMatch[1].trim());

          if (width > 0 && height > 0) {
            return { width, height };
          }
        }
      }

      return null;
    } catch (error) {
      // Return null on parsing error
      return null;
    }
  }

  /**
   * Add dimension information to SVG
   *
   * @param svgString Original SVG string
   * @param width Width
   * @param height Height
   * @returns SVG string with dimension information added
   */
  static addDimensionsToSVG(svgString: string, width: number, height: number): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) {
        // Add wrapper when SVG element is not found
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgString}</svg>`;
      }

      // Only add if existing size information is not present
      if (!svgElement.getAttribute('width')) {
        svgElement.setAttribute('width', String(width));
      }
      if (!svgElement.getAttribute('height')) {
        svgElement.setAttribute('height', String(height));
      }
      if (!svgElement.getAttribute('viewBox')) {
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      // Add simple wrapper on parsing failure
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgString}</svg>`;
    }
  }

  /**
   * Convert CSS size value to pixel unit number
   *
   * @param value CSS size value (e.g., "100px", "50%", "2em")
   * @returns Pixel unit number or 0
   */
  private static parseNumericValue(value: string): number {
    if (!value) return 0;

    // When only numbers are present
    const numOnly = parseFloat(value);
    if (!isNaN(numOnly) && isFinite(numOnly)) {
      return numOnly;
    }

    // Remove px unit
    const pxMatch = value.match(/^([0-9.]+)px$/i);
    if (pxMatch) {
      const num = parseFloat(pxMatch[1]);
      return !isNaN(num) && isFinite(num) ? num : 0;
    }

    // Handle % unit as default (accurate calculation not possible)
    const percentMatch = value.match(/^([0-9.]+)%$/i);
    if (percentMatch) {
      return 0; // Do not process relative sizes
    }

    // Handle other units like em, rem, pt as default
    return 0;
  }

  /**
   * Validate SVG string
   *
   * @param svgString SVG string to validate
   * @returns Whether it is a valid SVG
   */
  static isValidSVG(svgString: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return false;
      }

      // Check for SVG element existence
      const svgElement = doc.querySelector('svg');
      return svgElement !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * SVG normalization and compatibility processing (existing function wrapper)
   *
   * @param svgString Original SVG string
   * @returns Normalized SVG string
   */
  static normalizeSVG(svgString: string): string {
    return enhanceSvgForBrowser(svgString);
  }
}
