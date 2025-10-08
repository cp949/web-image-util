/**
 * Core image resizing logic
 * Core image resizing functions
 */

// Canvas pooling is handled in pipeline.ts

// Utility functions are handled in processor pipeline

/**
 * Convert Canvas to Blob
 *
 * @param canvas - Canvas element to convert
 * @param format - MIME type (e.g., 'image/jpeg', 'image/png')
 * @param quality - Quality (0.0 - 1.0, applies only to lossy compression formats)
 * @returns Promise that returns Blob object
 *
 * @example
 * ```typescript
 * const blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
 * ```
 */
export function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Convert Canvas to Data URL
 *
 * @param canvas - Canvas element to convert
 * @param format - MIME type (e.g., 'image/jpeg', 'image/png')
 * @param quality - Quality (0.0 - 1.0, applies only to lossy compression formats)
 * @returns Base64 encoded Data URL string
 *
 * @example
 * ```typescript
 * const dataUrl = canvasToDataUrl(canvas, 'image/png', 1.0);
 * imageElement.src = dataUrl;
 * ```
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement, format: string, quality: number): string {
  return canvas.toDataURL(format, quality);
}

// Browser Canvas API based resizing implementation
// toCenterCrop, toCenterInside, toFill, toFit etc. are no longer used
// Uses new processor.ts pipeline system
