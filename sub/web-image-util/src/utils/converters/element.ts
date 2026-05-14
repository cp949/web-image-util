/**
 * HTMLImageElement 보장 변환 함수.
 *
 * @description 다양한 입력을 단일 HTMLImageElement로 정규화한다.
 */

import { convertToImageElement } from '../../core/source-converter';
import type { ImageSource, ResultElement } from '../../types';
import { ImageProcessError } from '../../types';
import { ElementResultImpl } from '../../types/result-implementations';

/**
 * 입력을 HTMLImageElement로 보장한다.
 *
 * @description 이미 HTMLImageElement이면 로딩 완료를 기다린 뒤 원본을 그대로 반환한다.
 * 그 외 입력(Blob/File/URL/Data URL/SVG XML/ArrayBuffer/Uint8Array/HTMLCanvasElement 등)은
 * 적절한 디코딩 경로를 거쳐 단일 HTMLImageElement로 정규화한다.
 *
 * @param source 이미지 입력
 * @returns 로드 완료된 HTMLImageElement
 *
 * @example
 * ```typescript
 * import { ensureImageElement } from '@cp949/web-image-util/utils';
 *
 * const element = await ensureImageElement(blob);
 * const element2 = await ensureImageElement('https://example.com/image.jpg');
 * const element3 = await ensureImageElement('<svg>...</svg>');
 * ```
 */
export async function ensureImageElement(source: ImageSource): Promise<HTMLImageElement> {
  return convertToImageElement(source);
}

/**
 * 입력을 상세 메타데이터가 있는 HTMLImageElement 결과로 보장한다.
 *
 * @description ensureImageElement와 동일한 정규화를 수행하되, 결과 width/height와
 * 처리 시간을 포함한 ResultElement를 반환한다. 후속 변환(toBlob/toCanvas/toDataURL 등)에서
 * 이미 알고 있는 크기 정보를 재사용해 비용을 줄인다.
 *
 * @param source 이미지 입력
 * @returns HTMLImageElement 결과 객체
 *
 * @example
 * ```typescript
 * import { ensureImageElementDetailed } from '@cp949/web-image-util/utils';
 *
 * const result = await ensureImageElementDetailed(blob);
 * // result.element, result.width, result.height, result.processingTime
 * const blob = await result.toBlob({ format: 'webp', quality: 0.9 });
 * ```
 */
export async function ensureImageElementDetailed(source: ImageSource): Promise<ResultElement> {
  const startTime = Date.now();

  try {
    const element = await convertToImageElement(source);
    return new ElementResultImpl(element, element.width, element.height, Date.now() - startTime);
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring HTMLImageElement output', 'CONVERSION_FAILED', {
      cause: error,
    });
  }
}
