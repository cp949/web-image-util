/**
 * trim-empty.ts
 * Utility for automatically removing empty space (background color or transparent) from Canvas
 */

/**
 * Interface representing trim boundary information
 */
export interface TrimBounds {
  /** Left boundary of content area (x coordinate) */
  left: number;
  /** Top boundary of content area (y coordinate) */
  top: number;
  /** Right boundary of content area (x coordinate) */
  right: number;
  /** Bottom boundary of content area (y coordinate) */
  bottom: number;
  /** Width of content area */
  width: number;
  /** Height of content area */
  height: number;
}

/**
 * Interface representing RGBA color values
 */
export interface RGBA {
  /** Red channel (0-255) */
  r: number;
  /** Green channel (0-255) */
  g: number;
  /** Blue channel (0-255) */
  b: number;
  /** Alpha channel (0-255) */
  a: number;
}

/**
 * Parse background color string to RGBA object.
 * Supported formats: hex (#RGB, #RRGGBB), rgb/rgba, named colors
 *
 * @param backgroundColor Background color string (CSS color, hex, etc.)
 * @returns RGBA color object (default: transparent black)
 */
export function parseBackgroundColor(backgroundColor?: string): RGBA {
  // Default: transparent black (alpha = 0)
  if (!backgroundColor) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const color = backgroundColor.trim().toLowerCase();

  // Hex format: #RGB, #RRGGBB, #RRGGBBAA
  if (color.startsWith('#')) {
    const hex = color.substring(1);

    // #RGB format (short format)
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 255 };
    }

    // #RRGGBB format
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return { r, g, b, a: 255 };
    }

    // #RRGGBBAA format
    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const a = parseInt(hex.substring(6, 8), 16);
      return { r, g, b, a };
    }
  }

  // rgba() or rgb() format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 255) : 255;
    return { r, g, b, a };
  }

  // Named colors: support only commonly used colors
  const namedColors: Record<string, RGBA> = {
    transparent: { r: 0, g: 0, b: 0, a: 0 },
    white: { r: 255, g: 255, b: 255, a: 255 },
    black: { r: 0, g: 0, b: 0, a: 255 },
    red: { r: 255, g: 0, b: 0, a: 255 },
    green: { r: 0, g: 128, b: 0, a: 255 },
    blue: { r: 0, g: 0, b: 255, a: 255 },
  };

  if (color in namedColors) {
    return namedColors[color];
  }

  // Fallback parsing using Canvas
  // Let the browser parse it automatically
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const imageData = ctx.getImageData(0, 0, 1, 1);
      return {
        r: imageData.data[0],
        g: imageData.data[1],
        b: imageData.data[2],
        a: imageData.data[3],
      };
    }
  }

  // Return default value on parsing failure
  return { r: 0, g: 0, b: 0, a: 0 };
}

/**
 * Determine if given pixel is background color.
 * Compare with applied tolerance.
 *
 * @param r Red channel value
 * @param g Green channel value
 * @param b Blue channel value
 * @param a Alpha channel value
 * @param bgColor Background color RGBA object
 * @param tolerance Allowed tolerance (default: 5)
 * @returns true if matches background color
 */
export function isBackgroundPixel(r: number, g: number, b: number, a: number, bgColor: RGBA, tolerance = 5): boolean {
  return (
    Math.abs(r - bgColor.r) <= tolerance &&
    Math.abs(g - bgColor.g) <= tolerance &&
    Math.abs(b - bgColor.b) <= tolerance &&
    Math.abs(a - bgColor.a) <= tolerance
  );
}

/**
 * Find boundaries of non-empty area in Canvas.
 * Scan pixel by pixel to find min/max coordinates of non-background pixels.
 *
 * @param canvas Canvas to analyze
 * @param backgroundColor Background color (including transparency)
 * @returns Boundary information of non-empty area
 */
export function findContentBounds(canvas: HTMLCanvasElement, backgroundColor?: string): TrimBounds {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot get canvas context');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const bgColor = parseBackgroundColor(backgroundColor);

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  // Scan pixel by pixel to find content area
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // If not background color or transparent pixel
      if (!isBackgroundPixel(r, g, b, a, bgColor)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Return entire area if no content found
  if (minX >= maxX || minY >= maxY) {
    return {
      left: 0,
      top: 0,
      right: canvas.width,
      bottom: canvas.height,
      width: canvas.width,
      height: canvas.height,
    };
  }

  return {
    left: minX,
    top: minY,
    right: maxX + 1,
    bottom: maxY + 1,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Crop canvas to specified area.
 *
 * @param canvas Original canvas
 * @param bounds Area to crop
 * @returns New cropped canvas
 */
export function cropCanvas(canvas: HTMLCanvasElement, bounds: TrimBounds): HTMLCanvasElement {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = bounds.width;
  newCanvas.height = bounds.height;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot create new canvas context');
  }

  // Copy specified area from original canvas to new canvas
  ctx.drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

  return newCanvas;
}

/**
 * Integrated trimEmpty functionality
 * Automatically remove empty space (background color or transparent) from Canvas.
 *
 * @param canvas Canvas to process
 * @param backgroundColor Background color (if not specified, trim based on transparent area)
 * @returns Trimmed canvas (return original if no space to trim)
 */
export function trimEmptySpace(canvas: HTMLCanvasElement, backgroundColor?: string): HTMLCanvasElement {
  const bounds = findContentBounds(canvas, backgroundColor);

  // Return original if no space to trim
  if (bounds.left === 0 && bounds.top === 0 && bounds.width === canvas.width && bounds.height === canvas.height) {
    return canvas;
  }

  return cropCanvas(canvas, bounds);
}
