/**
 * Canvas 출력(toCanvas/toCanvasDetailed) 결과 조립 헬퍼다.
 *
 * @description 처리 결과 Canvas와 메타데이터를 CanvasResultImpl로 감싼다.
 * 여기서 생성한 Canvas는 사용자 소유이므로 CanvasPool로 반환하지 않는다.
 */

import type { ResultCanvas } from '../types';
import { ImageProcessError } from '../types';
import { CanvasResultImpl } from '../types/result-implementations.internal';

/** executeProcessing()이 돌려주는 처리 결과 형태다. */
export interface ProcessingOutcome {
  canvas: HTMLCanvasElement;
  result: {
    width: number;
    height: number;
    processingTime: number;
    originalSize: { width: number; height: number };
    operations: unknown;
  };
}

/**
 * 처리 결과를 ResultCanvas로 조립한다.
 *
 * @param execute 처리 실행 콜백(executeProcessing 위임)
 * @param errorMessage 실패 시 ImageProcessError 메시지
 */
export async function renderToCanvasResult(
  execute: () => Promise<ProcessingOutcome>,
  errorMessage: string
): Promise<ResultCanvas> {
  try {
    const { canvas, result } = await execute();
    return new CanvasResultImpl(
      canvas,
      result.width,
      result.height,
      result.processingTime,
      result.originalSize,
      undefined // Canvas에는 포맷 정보가 없다.
    );
  } catch (error) {
    throw new ImageProcessError(errorMessage, 'OUTPUT_FAILED', { cause: error });
  }
}
