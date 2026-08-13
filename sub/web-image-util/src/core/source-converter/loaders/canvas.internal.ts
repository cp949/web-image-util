/**
 * HTMLCanvasElement → HTMLImageElement 변환 경로다.
 */

import { decodeImageFromUrl } from '../../../utils/image-decode.internal';

/**
 * Convert HTMLCanvasElement to HTMLImageElement
 */
export async function convertCanvasToElement(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const dataURL = canvas.toDataURL();
  return decodeImageFromUrl(dataURL, {
    errorCode: 'SOURCE_LOAD_FAILED',
    message: 'Failed to load Canvas image',
  });
}
