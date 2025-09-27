/**
 * SVG 처리 전용 클래스
 *
 * @description SVG 문자열의 정규화, 크기 추출, 브라우저 호환성 처리를 담당
 */

import { ImageProcessError } from '../types';
import { normalizeSvgBasics } from './svg-compatibility';

/**
 * SVG 크기 정보
 */
export interface SVGDimensions {
  width: number;
  height: number;
}

/**
 * SVG 처리 옵션
 */
export interface SVGProcessOptions {
  /** 기본 크기 (크기 정보가 없는 경우) */
  defaultWidth?: number;
  defaultHeight?: number;
  /** SVG 정규화 여부 (기본: true) */
  normalize?: boolean;
  /** CORS 설정 */
  crossOrigin?: string;
}

/**
 * SVG 전용 처리기
 *
 * @description SVG 문자열을 HTMLImageElement로 안전하게 변환하고
 * 크기 정보 추출, 정규화 등의 고급 기능을 제공
 */
export class SVGProcessor {
  /**
   * SVG 문자열을 HTMLImageElement로 변환
   *
   * @param svgString SVG XML 문자열
   * @param options 처리 옵션
   * @returns HTMLImageElement
   */
  static async processSVGString(svgString: string, options: SVGProcessOptions = {}): Promise<HTMLImageElement> {
    const { normalize = true, crossOrigin } = options;

    try {
      // SVG 정규화 적용
      const processedSvg = normalize ? normalizeSvgBasics(svgString) : svgString;

      // 크기 정보 추출 및 기본값 적용
      const dimensions = this.extractSVGDimensions(processedSvg);
      let finalSvg = processedSvg;

      if (!dimensions && (options.defaultWidth || options.defaultHeight)) {
        const width = options.defaultWidth || 300;
        const height = options.defaultHeight || 300;
        finalSvg = this.addDimensionsToSVG(processedSvg, width, height);
      }

      // Blob 생성 및 Object URL로 변환
      const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);

      try {
        const img = new Image();

        if (crossOrigin) {
          img.crossOrigin = crossOrigin;
        }

        // Promise 기반 이미지 로딩
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new ImageProcessError('SVG 로딩에 실패했습니다', 'SVG_LOAD_FAILED'));
          img.src = objectUrl;
        });

        return img;
      } finally {
        // Object URL 정리 (메모리 누수 방지)
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }
      throw new ImageProcessError(
        `SVG 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
        'SVG_PROCESSING_FAILED'
      );
    }
  }

  /**
   * SVG 문자열에서 크기 정보를 추출
   *
   * @param svgString SVG XML 문자열
   * @returns 크기 정보 또는 null
   */
  static extractSVGDimensions(svgString: string): SVGDimensions | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) {
        return null;
      }

      // 1. width/height 속성에서 직접 추출
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr && heightAttr) {
        const width = this.parseNumericValue(widthAttr);
        const height = this.parseNumericValue(heightAttr);

        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      // 2. viewBox에서 추출
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const values = viewBox.trim().split(/\s+/).map(Number);
        if (values.length === 4 && values[2] > 0 && values[3] > 0) {
          return {
            width: values[2], // viewBox의 width
            height: values[3], // viewBox의 height
          };
        }
      }

      // 3. style 속성에서 추출
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
      // 파싱 에러 시 null 반환
      return null;
    }
  }

  /**
   * SVG에 크기 정보를 추가
   *
   * @param svgString 원본 SVG 문자열
   * @param width 폭
   * @param height 높이
   * @returns 크기 정보가 추가된 SVG 문자열
   */
  static addDimensionsToSVG(svgString: string, width: number, height: number): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) {
        // SVG 요소가 없는 경우 래퍼 추가
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgString}</svg>`;
      }

      // 기존 크기 정보가 없는 경우에만 추가
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
      // 파싱 실패 시 간단한 래퍼 추가
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgString}</svg>`;
    }
  }

  /**
   * CSS 크기 값을 픽셀 단위 숫자로 변환
   *
   * @param value CSS 크기 값 (예: "100px", "50%", "2em")
   * @returns 픽셀 단위 숫자 또는 0
   */
  private static parseNumericValue(value: string): number {
    if (!value) return 0;

    // 숫자만 있는 경우
    const numOnly = parseFloat(value);
    if (!isNaN(numOnly) && isFinite(numOnly)) {
      return numOnly;
    }

    // px 단위 제거
    const pxMatch = value.match(/^([0-9.]+)px$/i);
    if (pxMatch) {
      const num = parseFloat(pxMatch[1]);
      return !isNaN(num) && isFinite(num) ? num : 0;
    }

    // % 단위는 기본값으로 처리 (정확한 계산 불가)
    const percentMatch = value.match(/^([0-9.]+)%$/i);
    if (percentMatch) {
      return 0; // 상대적 크기는 처리하지 않음
    }

    // em, rem, pt 등 다른 단위는 기본값 처리
    return 0;
  }

  /**
   * SVG 문자열 유효성 검사
   *
   * @param svgString 검사할 SVG 문자열
   * @returns 유효한 SVG인지 여부
   */
  static isValidSVG(svgString: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');

      // 파싱 에러 확인
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return false;
      }

      // SVG 요소 존재 확인
      const svgElement = doc.querySelector('svg');
      return svgElement !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * SVG 정규화 및 호환성 처리 (기존 함수 래퍼)
   *
   * @param svgString 원본 SVG 문자열
   * @returns 정규화된 SVG 문자열
   */
  static normalizeSVG(svgString: string): string {
    return normalizeSvgBasics(svgString);
  }
}
