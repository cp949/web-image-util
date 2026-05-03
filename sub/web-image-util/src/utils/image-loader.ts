import { ImageProcessError } from '../types';

/**
 * HTMLImageElement에 src를 할당하고 로드 완료까지 대기한다.
 *
 * @description Promise 결정 시점에 onload/onerror 핸들러를 항상 해제해
 *   메모리 누수를 방지한다.
 */
export function loadImageElement(
  img: HTMLImageElement,
  src: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SOURCE_LOAD_FAILED' = 'IMAGE_LOAD_FAILED'
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve();
    };

    img.onerror = () => {
      cleanup();
      reject(new ImageProcessError('Image loading failed', errorCode));
    };

    img.src = src;
  });
}
