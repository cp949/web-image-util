/**
 * SVG size information extraction and setting utilities
 * Size information processing for improved SVG rendering quality
 */

import { parseAndClassifySvg } from './svg-document.internal';

// Interface for holding SVG size information
export interface SvgDimensions {
  width: number;
  height: number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  hasExplicitSize: boolean; // whether width, height attributes are explicitly set
}

/**
 * Function to extract size information from SVG string
 * @param svgString - SVG string to analyze
 * @returns SVG size information
 * @throws Error - when SVG is invalid
 */
export function extractSvgDimensions(svgString: string): SvgDimensions {
  // 파싱과 parsererror 감지는 svg-document leaf가 담당한다.
  // 루트가 svg가 아니어도 문서 안의 첫 <svg> 요소에서 치수를 읽는 기존 동작을 유지한다.
  const parsed = parseAndClassifySvg(svgString);
  const svgElement = parsed.ok ? parsed.doc.querySelector('svg') : null;

  if (!svgElement) {
    throw new Error('Invalid SVG: No <svg> element found');
  }

  // Extract width, height attributes
  const width = extractNumericValue(svgElement.getAttribute('width'));
  const height = extractNumericValue(svgElement.getAttribute('height'));

  // Parse viewBox
  const viewBox = parseViewBox(svgElement.getAttribute('viewBox'));

  return {
    width: width || viewBox?.width || 100, // default 100
    height: height || viewBox?.height || 100,
    viewBox,
    hasExplicitSize: Boolean(width && height),
  };
}

/**
 * Helper function to extract numeric value from string
 * Removes units like px, pt, em and extracts only numbers
 * @param value - string value to parse
 * @returns extracted numeric value or undefined
 */
function extractNumericValue(value: string | null): number | undefined {
  if (!value) return undefined;

  // Remove units like px, pt, em and extract only numbers
  const numericMatch = value.match(/^(\d+(?:\.\d+)?)/);
  return numericMatch ? parseFloat(numericMatch[1]) : undefined;
}

/**
 * Helper function to parse viewBox string
 * @param viewBoxStr - viewBox attribute value
 * @returns parsed viewBox information or undefined
 */
function parseViewBox(viewBoxStr: string | null): SvgDimensions['viewBox'] {
  if (!viewBoxStr) return undefined;

  const values = viewBoxStr.split(/\s+/).map(Number);
  if (values.length !== 4 || values.some(Number.isNaN)) return undefined;

  return {
    x: values[0],
    y: values[1],
    width: values[2],
    height: values[3],
  };
}
