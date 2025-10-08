/**
 * SVG vector optimization algorithm
 * Preprocessing optimization system for improving SVG rendering quality
 */

import { productionLog } from './debug';

export interface SvgOptimizationOptions {
  /** Remove metadata (comments, unnecessary attributes) */
  removeMetadata: boolean;
  /** Simplify path data (reduce decimal places, clean whitespace) */
  simplifyPaths: boolean;
  /** Merge and optimize duplicate gradients */
  optimizeGradients: boolean;
  /** Merge similar elements */
  mergeElements: boolean;
  /** Remove unused definitions (defs) */
  removeUnusedDefs: boolean;
  /** Numerical precision (decimal places) */
  precision: number;
}

export interface OptimizationResult {
  /** Original SVG size (string length) */
  originalSize: number;
  /** Optimized SVG size */
  optimizedSize: number;
  /** Compression ratio (0-1) */
  compressionRatio: number;
  /** List of applied optimizations */
  optimizations: string[];
  /** Processing time (milliseconds) */
  processingTimeMs: number;
}

/**
 * SVG optimization engine
 * Preprocessing optimization for improving vector graphics rendering quality
 */
export class SvgOptimizer {
  /**
   * Default optimization options
   */
  static getDefaultOptions(): SvgOptimizationOptions {
    return {
      removeMetadata: true,
      simplifyPaths: true,
      optimizeGradients: true,
      mergeElements: false, // Default to false for safety
      removeUnusedDefs: true,
      precision: 3, // Keep 3 decimal places
    };
  }

  /**
   * Execute SVG optimization
   * @param svgString Original SVG string
   * @param options Optimization options
   * @returns Optimized SVG and result information
   */
  static optimize(
    svgString: string,
    options: SvgOptimizationOptions = this.getDefaultOptions()
  ): { optimizedSvg: string; result: OptimizationResult } {
    const startTime = performance.now();
    const originalSize = svgString.length;
    let optimizedSvg = svgString;
    const optimizations: string[] = [];

    try {
      // 1. Remove metadata
      if (options.removeMetadata) {
        optimizedSvg = this.removeMetadata(optimizedSvg);
        optimizations.push('metadata removal');
      }

      // 2. Simplify paths
      if (options.simplifyPaths) {
        optimizedSvg = this.simplifyPaths(optimizedSvg, options.precision);
        optimizations.push('path simplification');
      }

      // 3. Optimize gradients
      if (options.optimizeGradients) {
        optimizedSvg = this.optimizeGradients(optimizedSvg);
        optimizations.push('gradient optimization');
      }

      // 4. Remove unused definitions
      if (options.removeUnusedDefs) {
        optimizedSvg = this.removeUnusedDefs(optimizedSvg);
        optimizations.push('unused definitions removal');
      }

      // 5. Clean up whitespace
      optimizedSvg = this.cleanupWhitespace(optimizedSvg);
      optimizations.push('whitespace cleanup');

      const optimizedSize = optimizedSvg.length;
      const processingTimeMs = performance.now() - startTime;

      return {
        optimizedSvg,
        result: {
          originalSize,
          optimizedSize,
          compressionRatio: (originalSize - optimizedSize) / originalSize,
          optimizations,
          processingTimeMs,
        },
      };
    } catch (error) {
      // Return original on optimization failure
      productionLog.warn('Error occurred during SVG optimization:', error);
      const processingTimeMs = performance.now() - startTime;

      return {
        optimizedSvg: svgString,
        result: {
          originalSize,
          optimizedSize: originalSize,
          compressionRatio: 0,
          optimizations: ['optimization failed - returned original'],
          processingTimeMs,
        },
      };
    }
  }

  /**
   * Remove metadata (XML comments, unnecessary attributes)
   */
  private static removeMetadata(svgString: string): string {
    let cleaned = svgString;

    // Remove XML comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // Remove DOCTYPE declaration
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

    // Remove XML processing instructions
    cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, '');

    // Remove unnecessary namespace attributes (excluding default svg, xlink)
    const unnecessaryNamespaces = [
      /xmlns:dc="[^"]*"/g,
      /xmlns:cc="[^"]*"/g,
      /xmlns:rdf="[^"]*"/g,
      /xmlns:svg="[^"]*"/g,
      /xmlns:sodipodi="[^"]*"/g,
      /xmlns:inkscape="[^"]*"/g,
    ];

    unnecessaryNamespaces.forEach((regex) => {
      cleaned = cleaned.replace(regex, '');
    });

    // Remove metadata elements
    const metadataElements = [
      /<metadata[\s\S]*?<\/metadata>/gi,
      /<title[\s\S]*?<\/title>/gi,
      /<desc[\s\S]*?<\/desc>/gi,
      /<sodipodi:[^>]*>/gi,
      /<inkscape:[^>]*>/gi,
    ];

    metadataElements.forEach((regex) => {
      cleaned = cleaned.replace(regex, '');
    });

    // Remove unnecessary attributes
    const unnecessaryAttrs = [
      /xml:space="[^"]*"/g,
      /data-[^=]*="[^"]*"/g,
      /id="[^"]*"/g, // Remove ID attributes if unnecessary for rendering
      /style=""/g, // Empty style attributes
      /transform=""/g, // Empty transform attributes
    ];

    unnecessaryAttrs.forEach((regex) => {
      cleaned = cleaned.replace(regex, '');
    });

    return cleaned;
  }

  /**
   * Simplify path data
   */
  private static simplifyPaths(svgString: string, precision: number): string {
    return svgString.replace(/d="([^"]+)"/g, (match, pathData) => {
      // Simplify path data
      let simplified = pathData;

      // Limit decimal places
      const precisionRegex = new RegExp(`(\\d+\\.\\d{${precision + 1},})`, 'g');
      simplified = simplified.replace(precisionRegex, (numMatch: string) => {
        return parseFloat(numMatch).toFixed(precision);
      });

      // Remove unnecessary trailing zeros (1.000 → 1)
      simplified = simplified.replace(/\.0+\b/g, '');

      // Convert consecutive spaces to single space
      simplified = simplified.replace(/\s+/g, ' ');

      // Add commas between numbers (change spaces to commas)
      simplified = simplified.replace(/(\d)\s+(\d)/g, '$1,$2');

      // Remove spaces after commands (more robust pattern)
      simplified = simplified.replace(/([MmLlHhVvCcSsQqTtAaZz])\s+/g, '$1');

      // Remove spaces before commands too
      simplified = simplified.replace(/\s+([MmLlHhVvCcSsQqTtAaZz])/g, '$1');

      // Clean spaces around commas
      simplified = simplified.replace(/\s*,\s*/g, ',');

      // Trim start and end spaces
      simplified = simplified.trim();

      return `d="${simplified}"`;
    });
  }

  /**
   * Gradient optimization (duplicate removal and merging)
   */
  private static optimizeGradients(svgString: string): string {
    try {
      // Check DOMParser availability in Node.js environment
      if (typeof DOMParser === 'undefined') {
        productionLog.warn('DOMParser is not available in this environment. Skipping gradient optimization.');
        return svgString;
      }

      // Parse SVG using DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');

      // Check for parsing errors
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        return svgString; // Return original on parsing failure
      }

      const gradients = doc.querySelectorAll('linearGradient, radialGradient');
      const gradientMap = new Map<string, Element>();
      const replacementMap = new Map<string, string>();

      // Detect and map duplicate gradients
      gradients.forEach((gradient) => {
        const hash = this.hashGradient(gradient);
        const currentId = gradient.getAttribute('id');

        if (!currentId) return;

        if (!gradientMap.has(hash)) {
          gradientMap.set(hash, gradient);
        } else {
          // Found duplicate gradient
          const originalGradient = gradientMap.get(hash)!;
          const originalId = originalGradient.getAttribute('id');

          if (originalId) {
            replacementMap.set(currentId, originalId);
            gradient.remove(); // Remove duplicate
          }
        }
      });

      // Update references
      replacementMap.forEach((newId, oldId) => {
        const elements = doc.querySelectorAll(`[fill="url(#${oldId})"], [stroke="url(#${oldId})"]`);
        elements.forEach((element) => {
          if (element.getAttribute('fill') === `url(#${oldId})`) {
            element.setAttribute('fill', `url(#${newId})`);
          }
          if (element.getAttribute('stroke') === `url(#${oldId})`) {
            element.setAttribute('stroke', `url(#${newId})`);
          }
        });
      });

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      productionLog.warn('Gradient optimization failed:', error);
      return svgString; // Return original on failure
    }
  }

  /**
   * Generate gradient hash (for duplicate detection)
   */
  private static hashGradient(gradient: Element): string {
    const type = gradient.tagName;
    const stops = Array.from(gradient.querySelectorAll('stop'))
      .map((stop) => {
        const offset = stop.getAttribute('offset') || '0';
        const color = stop.getAttribute('stop-color') || '#000000';
        const opacity = stop.getAttribute('stop-opacity') || '1';
        return `${offset}:${color}:${opacity}`;
      })
      .join(',');

    // Gradient properties (direction, size, etc.)
    const attrs = ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']
      .map((attr) => gradient.getAttribute(attr) || '')
      .filter((val) => val !== '')
      .join(',');

    return `${type}:${attrs}:${stops}`;
  }

  /**
   * Remove unused definitions (defs)
   */
  private static removeUnusedDefs(svgString: string): string {
    try {
      // Check DOMParser availability in Node.js environment
      if (typeof DOMParser === 'undefined') {
        productionLog.warn('DOMParser is not available in this environment. Skipping unused definitions removal.');
        return svgString;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');

      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        return svgString;
      }

      const defs = doc.querySelector('defs');
      if (!defs) {
        return svgString;
      }

      // Collect all element IDs within defs
      const definedIds = new Set<string>();
      defs.querySelectorAll('[id]').forEach((element) => {
        const id = element.getAttribute('id');
        if (id) definedIds.add(id);
      });

      // Find used IDs
      const usedIds = new Set<string>();
      const svgContent = doc.documentElement;

      definedIds.forEach((id) => {
        const references = svgContent.querySelectorAll(
          `[fill="url(#${id})"], [stroke="url(#${id})"], [filter="url(#${id})"], ` +
            `[clip-path="url(#${id})"], [mask="url(#${id})"], [marker-start="url(#${id})"], ` +
            `[marker-mid="url(#${id})"], [marker-end="url(#${id})"], [href="#${id}"]`
        );

        if (references.length > 0) {
          usedIds.add(id);
        }
      });

      // Remove unused definitions
      definedIds.forEach((id) => {
        if (!usedIds.has(id)) {
          const unusedElement = defs.querySelector(`[id="${id}"]`);
          if (unusedElement) {
            unusedElement.remove();
          }
        }
      });

      // Remove defs itself if it's empty
      if (defs.children.length === 0) {
        defs.remove();
      }

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      productionLog.warn('Unused definitions removal failed:', error);
      return svgString;
    }
  }

  /**
   * Clean up whitespace
   */
  private static cleanupWhitespace(svgString: string): string {
    return (
      svgString
        // Remove unnecessary spaces between tags
        .replace(/>\s+</g, '><')
        // Merge consecutive spaces into one (excluding inside attribute values)
        .replace(/(\s)\s+/g, '$1')
        // Clean spaces around attributes (around equal signs)
        .replace(/\s*=\s*/g, '=')
        // Clean spaces between attributes
        .replace(/"\s+([a-zA-Z-])/g, '" $1')
        // Remove leading and trailing spaces
        .trim()
    );
  }
}
