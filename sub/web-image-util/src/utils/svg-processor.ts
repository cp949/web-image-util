/**
 * Dedicated SVG processing class
 *
 * @description Handles SVG string normalization, dimension extraction, and browser compatibility processing
 */

import { ImageProcessError } from '../types';
import { enhanceSvgForBrowser } from './svg-compatibility';

/**
 * SVG dimension information
 */
export interface SVGDimensions {
  width: number;
  height: number;
}

/**
 * SVG processing options
 */
export interface SVGProcessOptions {
  /** Default size (when size information is not available) */
  defaultWidth?: number;
  defaultHeight?: number;
  /** Whether to normalize SVG (default: true) */
  normalize?: boolean;
  /** CORS settings */
  crossOrigin?: string;
}

/**
 * Dedicated SVG processor
 *
 * @description Safely converts SVG strings to HTMLImageElement and
 * provides advanced features like dimension extraction and normalization
 */
export class SVGProcessor {
  /**
   * Convert SVG string to HTMLImageElement
   *
   * @param svgString SVG XML string
   * @param options Processing options
   * @returns HTMLImageElement
   */
  static async processSVGString(svgString: string, options: SVGProcessOptions = {}): Promise<HTMLImageElement> {
    const { normalize = true, crossOrigin } = options;

    try {
      // Apply SVG normalization
      const processedSvg = normalize ? enhanceSvgForBrowser(svgString) : svgString;

      // Extract dimension information and apply defaults
      const dimensions = this.extractSVGDimensions(processedSvg);
      let finalSvg = processedSvg;

      if (!dimensions && (options.defaultWidth || options.defaultHeight)) {
        const width = options.defaultWidth || 300;
        const height = options.defaultHeight || 300;
        finalSvg = this.addDimensionsToSVG(processedSvg, width, height);
      }

      // Create Blob and convert to Object URL
      const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);

      try {
        const img = new Image();

        if (crossOrigin) {
          img.crossOrigin = crossOrigin;
        }

        // Promise-based image loading
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new ImageProcessError('SVG loading failed', 'SVG_LOAD_FAILED'));
          img.src = objectUrl;
        });

        return img;
      } finally {
        // Clean up Object URL (prevent memory leaks)
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
   * Extract dimension information from SVG string
   *
   * @param svgString SVG XML string
   * @returns Dimension information or null
   */
  static extractSVGDimensions(svgString: string): SVGDimensions | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) {
        return null;
      }

      // 1. Direct extraction from width/height attributes
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr && heightAttr) {
        const width = this.parseNumericValue(widthAttr);
        const height = this.parseNumericValue(heightAttr);

        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      // 2. Extract from viewBox
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const values = viewBox.trim().split(/\s+/).map(Number);
        if (values.length === 4 && values[2] > 0 && values[3] > 0) {
          return {
            width: values[2], // viewBox width
            height: values[3], // viewBox height
          };
        }
      }

      // 3. Extract from style attribute
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
