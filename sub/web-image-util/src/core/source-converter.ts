/**
 * Source converter - Convert various image sources to HTMLImageElement
 */

import type { ImageSource, ProcessorOptions } from '../types';
import { ImageProcessError } from '../types';
import { normalizeSvgBasics } from '../utils/svg-compatibility';
import { extractSvgDimensions } from '../utils/svg-dimensions';
import { debugLog, productionLog } from '../utils/debug';
import type { QualityLevel } from './svg-complexity-analyzer';
import { analyzeSvgComplexity } from './svg-complexity-analyzer';

/**
 * Image source type
 *
 * @description Types of supported image sources
 */
export type SourceType =
  | 'element'
  | 'canvas'
  | 'blob'
  | 'arrayBuffer'
  | 'uint8Array'
  | 'svg'
  | 'dataurl'
  | 'url'
  | 'bloburl'
  | 'path';

/**
 * Remove UTF-8 BOM
 * @param s Input string
 * @returns String with BOM removed
 */
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

/**
 * Remove XML preamble and noise
 * Skip XML declaration, comments, DOCTYPE, whitespace and return actual content
 * @param head Beginning part of string to analyze
 * @returns Cleaned string
 */
function stripXmlPreambleAndNoise(head: string): string {
  let s = head.trimStart();

  // Remove XML declaration: <?xml ...?>
  if (s.startsWith('<?xml')) {
    const end = s.indexOf('?>');
    if (end >= 0) s = s.slice(end + 2).trimStart();
  }

  // Remove comments (handle multiple consecutive ones)
  // Repeatedly remove <!-- ... -->
  while (true) {
    const m = s.match(/^<!--[\s\S]*?-->\s*/);
    if (!m) break;
    s = s.slice(m[0].length);
  }

  // Remove DOCTYPE
  const doctype = s.match(/^<!DOCTYPE[^>]*>\s*/i);
  if (doctype) s = s.slice(doctype[0].length);

  return s.trimStart();
}

/**
 * Accurate inline SVG detection
 * Remove BOM → Remove preamble → Check for <svg tag
 * @param str String to check
 * @returns Whether it's SVG
 */
function isInlineSvg(str: string): boolean {
  if (!str) return false;
  const stripped = stripXmlPreambleAndNoise(stripBom(str));
  return /^<svg[\s>]/i.test(stripped);
}

/**
 * Check if Data URL is SVG
 * @param input String to check
 * @returns Whether it's SVG Data URL
 */
function isDataUrlSvg(input: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(input);
}

/**
 * Sniff if Blob is SVG by reading the beginning as text
 * @param blob Blob to check
 * @param bytes Number of bytes to read (default: 4096)
 * @returns Whether it's SVG
 */
async function sniffSvgFromBlob(blob: Blob, bytes = 4096): Promise<boolean> {
  try {
    const slice = await blob.slice(0, bytes).text();
    return isInlineSvg(slice);
  } catch {
    return false;
  }
}

/**
 * Detect image source type
 *
 * @description Analyzes the input image source type to determine the appropriate conversion method.
 * @param source Image source to analyze
 * @returns Detected source type
 */
export function detectSourceType(source: ImageSource): SourceType {
  if (source instanceof HTMLImageElement) {
    return 'element';
  }

  // Detect HTMLCanvasElement
  if (
    source instanceof HTMLCanvasElement ||
    (source &&
      typeof source === 'object' &&
      'getContext' in source &&
      'toDataURL' in source &&
      typeof (source as any).getContext === 'function')
  ) {
    return 'canvas';
  }

  // Detect Blob - use both instanceof and duck typing
  if (
    source instanceof Blob ||
    (source &&
      typeof source === 'object' &&
      'type' in source &&
      'size' in source &&
      ('slice' in source || 'arrayBuffer' in source))
  ) {
    // Detect SVG file
    if (source.type === 'image/svg+xml' || (source as File).name?.endsWith('.svg')) {
      return 'svg';
    }
    return 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'arrayBuffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8Array';
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();

    // Detect Data URL SVG (priority - check before general Data URL)
    if (isDataUrlSvg(trimmed)) {
      return 'svg';
    }

    // Detect inline SVG XML (accurate check)
    if (isInlineSvg(trimmed)) {
      return 'svg';
    }

    // Detect other Data URLs
    if (trimmed.startsWith('data:')) {
      return 'dataurl';
    }

    // Detect HTTP/HTTPS URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Content-Type based determination performed at actual loading time
      // Here we only use file extension as hint
      try {
        const url = new URL(trimmed);
        if (url.pathname.toLowerCase().endsWith('.svg')) {
          return 'svg';
        }
      } catch {
        // Fallback to string-based check when URL parsing fails
        if (trimmed.toLowerCase().endsWith('.svg')) {
          return 'svg';
        }
      }
      return 'url';
    }

    // Detect Blob URL (URL created by createObjectURL)
    if (trimmed.startsWith('blob:')) {
      return 'bloburl';
    }

    // File path - check SVG extension
    if (trimmed.toLowerCase().endsWith('.svg')) {
      return 'svg';
    }

    // Treat the rest as file paths
    return 'path';
  }

  throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
}

/**
 * Extract and validate SVG string from Data URL
 * @param dataUrl SVG Data URL
 * @returns Parsed and validated SVG string
 */
function parseSvgFromDataUrl(dataUrl: string): string {
  // Format: data:image/svg+xml;base64,<base64-data>
  // Format: data:image/svg+xml;charset=utf-8,<url-encoded-data>
  // Format: data:image/svg+xml,<svg-content>

  const [header, content] = dataUrl.split(',');
  if (!content) {
    throw new ImageProcessError('Invalid SVG Data URL format', 'INVALID_SOURCE');
  }

  let svgContent: string;

  // Base64 encoded case
  if (header.includes('base64')) {
    try {
      svgContent = atob(content);
    } catch (error) {
      throw new ImageProcessError('Failed to decode Base64 SVG', 'SOURCE_LOAD_FAILED', error as Error);
    }
  } else {
    // URL encoded case
    try {
      svgContent = decodeURIComponent(content);
    } catch (error) {
      // Use original content when decoding fails
      svgContent = content;
    }
  }

  // Validate that decoded content is actually SVG
  if (!isInlineSvg(svgContent)) {
    throw new ImageProcessError('Data URL content is not valid SVG', 'INVALID_SOURCE');
  }

  return svgContent;
}

/**
 * Convert string source to HTMLImageElement
 */
async function convertStringToElement(source: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'svg':
      // Handle SVG strings, Data URL SVG, HTTP URL SVG
      if (typeof source === 'string') {
        // Parse Data URL SVG
        if (isDataUrlSvg(source.trim())) {
          const svgContent = parseSvgFromDataUrl(source);
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // Load and process HTTP URL SVG
        else if (source.trim().startsWith('http://') || source.trim().startsWith('https://')) {
          // Load SVG content from URL
          const response = await fetch(source);
          if (!response.ok) {
            throw new ImageProcessError(`Failed to load SVG URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }
          const svgContent = await response.text();
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // Load and process SVG file path
        else if (source.trim().toLowerCase().endsWith('.svg')) {
          // Load SVG content from file path
          const response = await fetch(source);
          if (!response.ok) {
            throw new ImageProcessError(`Failed to load SVG file: ${response.status}`, 'SOURCE_LOAD_FAILED');
          }
          const svgContent = await response.text();
          return convertSvgToElement(svgContent, undefined, undefined, {
            quality: 'auto',
            crossOrigin: options?.crossOrigin,
          });
        }
        // Regular SVG string
        else {
          return convertSvgToElement(source, undefined, undefined, {
            quality: 'auto',
          });
        }
      } else {
        // Convert SVG Blob/File to string and process
        const svgText = await (source as Blob).text();
        return convertSvgToElement(svgText, undefined, undefined, {
          quality: 'auto',
          crossOrigin: options?.crossOrigin,
        });
      }
    case 'dataurl':
    case 'url':
    case 'path':
      return loadImageFromUrl(source, options?.crossOrigin, options);
    case 'bloburl':
      return loadBlobUrl(source, options);
    default:
      throw new ImageProcessError(`Cannot convert string source: ${sourceType}`, 'INVALID_SOURCE');
  }
}

// SVG normalization is handled in svg-compatibility module for browser compatibility

/**
 * Convert SVG string to Base64 Data URL
 * @param svgString SVG string
 * @returns Base64 encoded Data URL
 */
function createBase64DataUrl(svgString: string): string {
  try {
    // UTF-8 safe Base64 encoding
    const base64 = btoa(
      Array.from(new TextEncoder().encode(svgString))
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    // Fallback to URL encoding if Base64 encoding fails
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  }
}

/**
 * SVG high-quality rendering options
 */
interface SvgRenderingOptions {
  /** Quality level or automatic selection */
  quality?: QualityLevel | 'auto';
  /** CORS settings */
  crossOrigin?: string;
}

/**
 * Convert SVG string to HTMLImageElement
 *
 * @description
 * Converts SVG to HTMLImageElement while completely preserving vector quality.
 *
 * **Core Optimizations:**
 * - Keep SVG original intact (delay vector → raster conversion)
 * - Render directly to target size in Canvas (eliminate intermediate steps)
 * - Automatic quality level selection through complexity analysis
 * - Hybrid approach: Blob URL for large SVGs, Base64 for small SVGs
 *
 * @param svgString SVG string to convert
 * @param targetWidth Target width (pixels, optional)
 * @param targetHeight Target height (pixels, optional)
 * @param options Rendering options (quality level, CORS, etc.)
 * @returns HTMLImageElement (fully loaded state)
 */
async function convertSvgToElement(
  svgString: string,
  targetWidth?: number,
  targetHeight?: number,
  options?: SvgRenderingOptions
): Promise<HTMLImageElement> {
  // Bypass SVG processing in test environment (prevent timeout)
  if (typeof globalThis !== 'undefined' && (globalThis as any)._SVG_MOCK_MODE) {
    return new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      // Use simple 1x1 transparent pixel image
      img.src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    });
  }

  try {
    // 1. SVG normalization processing
    const normalizedSvg = normalizeSvgBasics(svgString);

    // 2. Extract SVG size information
    const dimensions = extractSvgDimensions(normalizedSvg);

    // 3. Determine target size
    const finalWidth = targetWidth || dimensions.width;
    const finalHeight = targetHeight || dimensions.height;

    // 4. Determine quality level (automatic or explicit)
    let qualityLevel: QualityLevel = 'medium';
    if (options?.quality === 'auto' || !options?.quality) {
      const complexityResult = analyzeSvgComplexity(normalizedSvg);
      qualityLevel = complexityResult.recommendedQuality;
    } else {
      qualityLevel = options.quality;
    }

    // 5. Final rendering size = target size (remove scaleFactor)
    // SVG is vector-based, ensuring sharpness at any rendering size
    // Eliminate unnecessary scaling up then down process to preserve quality
    const renderWidth = finalWidth;
    const renderHeight = finalHeight;

    debugLog.log('🔧 convertSvgToElement direct rendering:', {
      originalDimensions: `${dimensions.width}x${dimensions.height}`,
      targetDimensions: `${finalWidth}x${finalHeight}`,
      qualityLevel,
      renderDimensions: `${renderWidth}x${renderHeight}`,
      hasExplicitSize: dimensions.hasExplicitSize,
      viewBox: dimensions.viewBox,
      timestamp: Date.now(),
    });

    // 7. Maintain SVG original size (preserve vector quality)
    // Use normalizedSvg as-is without setSvgDimensions to preserve vector quality
    // by rendering directly to target size in Canvas.
    const enhancedSvg = normalizedSvg;

    // 8. Optimized Image creation (hybrid approach)
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      let objectUrl: string | null = null;

      // Success handler
      img.onload = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl); // Free memory
        }
        resolve(img);
      };

      // Error handler - includes recovery attempt
      img.onerror = (error) => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl); // Free memory even on error
        }
        reject(
          new ImageProcessError(
            `SVG load failed: quality level ${qualityLevel}, size ${renderWidth}x${renderHeight}, error: ${error}`,
            'SOURCE_LOAD_FAILED'
          )
        );
      };

      // Select hybrid approach based on SVG size
      const svgSize = new Blob([enhancedSvg]).size;
      const SIZE_THRESHOLD = 50 * 1024; // 50KB threshold

      if (svgSize > SIZE_THRESHOLD) {
        // Large SVG: Blob URL approach (memory efficient)
        try {
          const blob = new Blob([enhancedSvg], { type: 'image/svg+xml' });
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        } catch (blobError) {
          // Fallback to Base64 if Blob creation fails
          productionLog.warn('Failed to create Blob URL, fallback to Base64:', blobError);
          img.src = createBase64DataUrl(enhancedSvg);
        }
      } else {
        // Small SVG: Base64 approach (faster)
        img.src = createBase64DataUrl(enhancedSvg);
      }

      // 🚀 High-quality image decoding settings
      img.decoding = 'async';

      // Cross-origin settings (if needed)
      if (options?.crossOrigin) {
        img.crossOrigin = options.crossOrigin;
      }
    });
  } catch (error) {
    throw new ImageProcessError(
      `SVG processing failed: ${error instanceof Error ? error.message : error}`,
      'SOURCE_LOAD_FAILED'
    );
  }
}

/**
 * Load image from Blob URL and convert to HTMLImageElement
 * Apply SVG processing with Content-Type priority check and dual verification
 */
async function loadBlobUrl(blobUrl: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  try {
    // Check Content-Type and content from Blob URL
    const response = await fetch(blobUrl);

    if (!response.ok) {
      throw new ImageProcessError(`Failed to load Blob URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    const blob = await response.blob();

    // Phase 1: Content-Type based SVG detection
    const isSvgMime = contentType.includes('image/svg+xml');

    // Phase 2: Content sniffing for empty MIME or XML-family types
    const isEmptyMime = !contentType;
    const isXmlMime = contentType.includes('text/xml') || contentType.includes('application/xml');

    if (isSvgMime || isEmptyMime || isXmlMime) {
      const isSvgContent = await sniffSvgFromBlob(blob);

      // If SVG MIME type or SVG confirmed by content sniffing
      if (isSvgMime || isSvgContent) {
        const svgContent = await blob.text();
        return convertSvgToElement(svgContent, undefined, undefined, {
          quality: 'auto',
        });
      }
    }

    // Default Image loading for non-SVG cases
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new ImageProcessError(`Failed to load Blob URL image: ${blobUrl}`, 'SOURCE_LOAD_FAILED'));
      img.src = blobUrl;
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred while processing Blob URL', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * Load image from URL and convert to HTMLImageElement
 * Apply SVG processing with Content-Type priority check and dual verification
 */
async function loadImageFromUrl(
  url: string,
  crossOrigin?: string,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  try {
    // Priority check of Content-Type for HTTP/HTTPS URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        // Single GET request to check Content-Type and load content
        const response = await fetch(url, {
          method: 'GET',
          mode: crossOrigin ? 'cors' : 'same-origin',
        });

        if (!response.ok) {
          throw new ImageProcessError(`Failed to load URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() || '';

        // Phase 1: Content-Type based SVG detection
        const isSvgMime = contentType.includes('image/svg+xml');

        // Phase 2: Content sniffing for XML-family MIME types
        const isXmlMime = contentType.includes('text/xml') || contentType.includes('application/xml');

        if (isSvgMime || isXmlMime) {
          const responseText = await response.text();

          // If SVG MIME type or actual SVG content confirmed in XML MIME
          if (isSvgMime || (isXmlMime && isInlineSvg(responseText))) {
            return convertSvgToElement(responseText, undefined, undefined, {
              quality: 'auto',
              crossOrigin: options?.crossOrigin,
            });
          }
        }

        // Fallback to default Image loading for non-SVG cases
        // Response stream already consumed, so create new Image with URL
      } catch (fetchError) {
        // Fallback to default Image loading if fetch fails
        productionLog.warn('Failed to check Content-Type, fallback to default image loading:', fetchError);
      }
    }

    // Default Image loading approach
    return new Promise((resolve, reject) => {
      const img = new Image();

      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageProcessError(`Failed to load image: ${url}`, 'SOURCE_LOAD_FAILED'));

      img.src = url;
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred while loading URL image', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * Auto-detect MIME type from ArrayBuffer
 *
 * @param buffer ArrayBuffer data
 * @returns Detected MIME type
 */
function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG signature: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP signature: RIFF ... WEBP (check file header)
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // Check WEBP signature (bytes 8-11)
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  // GIF signature: GIF87a or GIF89a
  if (bytes.length >= 6) {
    const gifSignature = String.fromCharCode(...bytes.slice(0, 3));
    if (gifSignature === 'GIF') {
      const version = String.fromCharCode(...bytes.slice(3, 6));
      if (version === '87a' || version === '89a') {
        return 'image/gif';
      }
    }
  }

  // BMP signature: BM
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  // TIFF signature: II* (little-endian) or MM* (big-endian)
  if (bytes.length >= 4) {
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    ) {
      return 'image/tiff';
    }
  }

  // ICO signature: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // Return PNG as default
  return 'image/png';
}

/**
 * Convert HTMLCanvasElement to HTMLImageElement
 */
async function convertCanvasToElement(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const dataURL = canvas.toDataURL();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageProcessError('Failed to load Canvas image', 'SOURCE_LOAD_FAILED'));

    img.src = dataURL;
  });
}

/**
 * Convert Blob to HTMLImageElement (includes SVG high-quality processing)
 */
async function convertBlobToElement(blob: Blob, options?: ProcessorOptions): Promise<HTMLImageElement> {
  // High-quality processing for SVG Blob
  if (blob.type === 'image/svg+xml' || (blob as File).name?.endsWith('.svg')) {
    const svgText = await blob.text();
    return convertSvgToElement(svgText, undefined, undefined, {
      quality: 'auto',
    });
  }

  // Regular Blob processing
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageProcessError('Failed to load Blob image', 'SOURCE_LOAD_FAILED'));
    };

    img.src = objectUrl;
  });
}

/**
 * Convert all ImageSource types to HTMLImageElement (main function)
 *
 * @description
 * Converts various types of image sources to unified HTMLImageElement format.
 * This function plays a core role in normalizing all processor inputs.
 *
 * **Supported Types:**
 * - HTMLImageElement: Already loaded images are returned as-is
 * - HTMLCanvasElement: Convert to Data URL then load
 * - Blob/File: ObjectURL or SVG special processing
 * - ArrayBuffer/Uint8Array: Auto-detect MIME type then convert to Blob
 * - String: URL, Data URL, SVG XML, file path, etc.
 *
 * **SVG Special Processing:**
 * - SVG applies normalization, complexity analysis, high-quality rendering
 * - Use optimized conversion path to preserve vector quality
 *
 * @param source Image source to convert
 * @param options Conversion options (CORS settings, etc.)
 * @returns Fully loaded HTMLImageElement
 *
 * @throws {ImageProcessError} When source type is unsupported or conversion fails
 */
export async function convertToImageElement(
  source: ImageSource,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  try {
    if (source instanceof HTMLImageElement) {
      // Check if image is already loaded
      if (source.complete && source.naturalWidth > 0) {
        return source;
      }

      // Wait until loading is complete
      return new Promise((resolve, reject) => {
        if (source.complete && source.naturalWidth > 0) {
          resolve(source);
        } else {
          source.onload = () => resolve(source);
          source.onerror = () => reject(new ImageProcessError('Failed to load HTMLImageElement', 'SOURCE_LOAD_FAILED'));
        }
      });
    }

    // HTMLCanvasElement processing
    if (
      source instanceof HTMLCanvasElement ||
      (source && typeof source === 'object' && 'getContext' in source && 'toDataURL' in source)
    ) {
      return convertCanvasToElement(source as HTMLCanvasElement);
    }

    // Blob detection - use both instanceof and duck typing
    if (
      source instanceof Blob ||
      (source &&
        typeof source === 'object' &&
        'type' in source &&
        'size' in source &&
        ('slice' in source || 'arrayBuffer' in source))
    ) {
      return convertBlobToElement(source as Blob, options);
    }

    if (source instanceof ArrayBuffer) {
      const mimeType = detectMimeTypeFromBuffer(source);
      const blob = new Blob([source], { type: mimeType });
      return convertBlobToElement(blob, options);
    }

    if (source instanceof Uint8Array) {
      // Safely convert Uint8Array to ArrayBuffer
      const arrayBuffer =
        source.buffer instanceof ArrayBuffer
          ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
          : source.slice().buffer;
      const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return convertBlobToElement(blob, options);
    }

    if (typeof source === 'string') {
      return convertStringToElement(source, options);
    }

    throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError(
      'Unknown error occurred during source conversion',
      'SOURCE_LOAD_FAILED',
      error as Error
    );
  }
}

/**
 * Get size information of image source
 *
 * @description Extract actual size information from various image sources.
 * @param source Image source to get size information from
 * @returns Width and height information of the image
 */
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
