/**
 * DOM 출력(toElement) 변환 헬퍼다.
 *
 * @description Blob → HTMLImageElement 변환 로직을 분리한다.
 * ObjectURL 생성·해제 및 img 로딩 처리를 캡슐화한다.
 */

import { ImageProcessError } from '../types';
import { createImageElement } from '../utils/image-element.internal';

/**
 * Blob을 로드된 HTMLImageElement로 변환한다.
 *
 * ObjectURL 생성 실패 시 OUTPUT_FAILED, 이미지 로딩 실패 시 IMAGE_LOAD_FAILED를 던진다.
 * Promise 결정 후 ObjectURL을 정리한다.
 */
export function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(blob);
    } catch (error) {
      reject(new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error }));
      return;
    }
    const img = createImageElement();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };
    img.onload = () => {
      try {
        cleanup();
        resolve(img);
      } catch (error) {
        reject(new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error }));
      }
    };
    img.onerror = () => {
      try {
        cleanup();
        reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
      } catch (error) {
        reject(new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error }));
      }
    };
    img.src = objectUrl;
  });
}
