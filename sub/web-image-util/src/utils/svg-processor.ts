/**
 * SVG 문자열을 다루는 전용 처리 유틸리티다.
 *
 * @description SVG 정규화, 크기 추출, 브라우저 호환 보정을 함께 담당한다.
 */

import { ImageProcessError } from '../types';
import { enhanceSvgForBrowser } from './svg-compatibility';
import {
  applyMissingDimensions,
  getSvgRoot,
  hasParserError,
  parseSvgDocument,
  readSvgDimensions,
  serializeSvgDocument,
  wrapSvgContent,
} from './svg-processor-dom.internal';

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
      const dimensions = SVGProcessor.extractSVGDimensions(processedSvg);
      let finalSvg = processedSvg;

      if (!dimensions && (options.defaultWidth || options.defaultHeight)) {
        const width = options.defaultWidth || 300;
        const height = options.defaultHeight || 300;
        finalSvg = SVGProcessor.addDimensionsToSVG(processedSvg, width, height);
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
    const doc = parseSvgDocument(svgString);
    if (!doc) {
      return null;
    }

    const svgElement = getSvgRoot(doc);
    if (!svgElement) {
      return null;
    }

    return readSvgDimensions(svgElement);
  }

  /**
   * SVG 문자열에 크기 정보를 추가한다.
   *
   * @description 기존 width/height/viewBox는 덮어쓰지 않고 누락된 속성만 채운다.
   * @param svgString 원본 SVG 문자열
   * @param width 너비
   * @param height 높이
   * @returns 크기 정보가 보강된 SVG 문자열
   */
  static addDimensionsToSVG(svgString: string, width: number, height: number): string {
    const doc = parseSvgDocument(svgString);
    if (!doc) {
      return wrapSvgContent(svgString, width, height);
    }

    const svgElement = getSvgRoot(doc);
    if (!svgElement) {
      return wrapSvgContent(svgString, width, height);
    }

    applyMissingDimensions(svgElement, width, height);

    try {
      return serializeSvgDocument(doc);
    } catch {
      // 직렬화 실패 시 원본 동작대로 단순 래퍼로 폴백한다.
      return wrapSvgContent(svgString, width, height);
    }
  }

  /**
   * SVG 문자열의 유효성을 검사한다.
   *
   * @description parsererror가 있거나 svg 루트가 없으면 false를 반환한다.
   * @param svgString 검사할 SVG 문자열
   * @returns 유효한 SVG 여부
   */
  static isValidSVG(svgString: string): boolean {
    const doc = parseSvgDocument(svgString);
    if (!doc || hasParserError(doc)) {
      return false;
    }

    return getSvgRoot(doc) !== null;
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
