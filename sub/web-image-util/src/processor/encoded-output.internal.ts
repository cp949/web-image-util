/**
 * 인코딩 출력(toDataURL/toFile) 변환 헬퍼다.
 *
 * @description ResultBlob → ResultDataURL/ResultFile 메타데이터 래핑을 담당한다.
 * Result* 생성(DataURLResultImpl/FileResultImpl 래핑)은 이 파일이 전담하며,
 * Blob/Data URL 원시 변환은 output-helpers.ts에 남긴다.
 */

import type { ResultBlob, ResultDataURL, ResultFile } from '../types';
import { ImageProcessError } from '../types';
import { DataURLResultImpl, FileResultImpl } from '../types/result-implementations.internal';
import { blobToDataURL } from './output-helpers.internal';

/**
 * ResultBlob을 ResultDataURL로 변환한다.
 */
export async function blobResultToDataURL(blobResult: ResultBlob): Promise<ResultDataURL> {
  try {
    const dataURL = await blobToDataURL(blobResult.blob);
    return new DataURLResultImpl(
      dataURL,
      blobResult.width,
      blobResult.height,
      blobResult.processingTime,
      blobResult.originalSize,
      blobResult.format
    );
  } catch (error) {
    throw new ImageProcessError('Error occurred during Data URL conversion', 'OUTPUT_FAILED', { cause: error });
  }
}

/**
 * ResultBlob을 ResultFile로 변환한다.
 */
export function blobResultToFile(blobResult: ResultBlob, resolvedFilename: string): ResultFile {
  try {
    const file = new File([blobResult.blob], resolvedFilename, {
      type: blobResult.blob.type,
      lastModified: Date.now(),
    });
    return new FileResultImpl(
      file,
      blobResult.width,
      blobResult.height,
      blobResult.processingTime,
      blobResult.originalSize,
      blobResult.format
    );
  } catch (error) {
    throw new ImageProcessError('Error occurred while creating File object', 'OUTPUT_FAILED', { cause: error });
  }
}
