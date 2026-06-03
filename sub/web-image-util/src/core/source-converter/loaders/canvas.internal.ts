/**
 * HTMLCanvasElement → HTMLImageElement 변환 경로다.
 */

import { ImageProcessError } from '../../../types';

/**
 * Convert HTMLCanvasElement to HTMLImageElement
 */
export async function convertCanvasToElement(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const dataURL = canvas.toDataURL();

    // Promise 결정 시 핸들러를 해제한다.
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new ImageProcessError('Failed to load Canvas image', 'SOURCE_LOAD_FAILED'));
    };

    img.src = dataURL;
  });
}
