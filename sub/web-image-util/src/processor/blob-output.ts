/**
 * Canvas → Blob 변환 헬퍼다.
 *
 * @description canvas.toBlob 래퍼로, 요청 포맷 미지원 시 fallback 포맷으로 재시도한다.
 * 메타데이터 래핑(BlobResultImpl 생성)은 호출 측 클래스에 남긴다.
 */

import type { OutputFormat, OutputOptions } from '../types';
import { ImageProcessError } from '../types';
import { formatToMimeType, mimeTypeToOutputFormat } from '../utils/format-utils';

/**
 * Canvas를 Blob으로 변환한다.
 *
 * - 요청 포맷으로 변환 실패(blob === null) 시 fallbackFormat으로 재시도한다.
 * - 재시도도 실패하면 ImageProcessError('Failed to create Blob from Canvas', 'OUTPUT_FAILED')를 reject한다.
 * - 브라우저가 실제 반환한 MIME 타입으로 포맷을 결정한다.
 *
 * @param canvas 변환 대상 Canvas 엘리먼트
 * @param options 정규화된 출력 옵션 (Required<OutputOptions>)
 */
export function canvasToBlobOutput(
  canvas: HTMLCanvasElement,
  options: Required<OutputOptions>
): Promise<{ blob: Blob; format: OutputFormat }> {
  const mimeType = formatToMimeType(options.format);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // 브라우저가 요청 포맷 대신 다른 MIME으로 Blob을 반환할 수 있으므로 실제 type 기준으로 포맷을 결정한다.
          const actualFormat = mimeTypeToOutputFormat(blob.type) ?? options.format;
          resolve({ blob, format: actualFormat });
        } else {
          // 요청 포맷 미지원 시 fallback 포맷으로 재시도한다.
          const fallbackMimeType = formatToMimeType(options.fallbackFormat);
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                const actualFallbackFormat = mimeTypeToOutputFormat(fallbackBlob.type) ?? options.fallbackFormat;
                resolve({ blob: fallbackBlob, format: actualFallbackFormat });
              } else {
                reject(new ImageProcessError('Failed to create Blob from Canvas', 'OUTPUT_FAILED'));
              }
            },
            fallbackMimeType,
            options.quality
          );
        }
      },
      mimeType,
      options.quality
    );
  });
}
