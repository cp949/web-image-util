/**
 * 지연 렌더링 파이프라인 - 모든 연산을 계산으로만 처리하고 최종에 한 번만 렌더링
 *
 * 핵심 철학: "계산은 미리, 렌더링은 한 번"
 * - 모든 resize, blur 등 연산을 메모리에 누적
 * - toBlob(), toCanvas() 호출 시에만 실제 렌더링 수행
 * - 중간 Canvas 생성 없이 최종 결과만 생성
 */

import type { BlurOptions, ResultMetadata } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import { ImageProcessError } from '../types';
import { analyzeAllOperations, renderAllOperationsOnce, debugLayout } from './single-renderer';

/**
 * 지연 실행용 연산 정의
 */
export type LazyOperation =
  | { type: 'resize'; config: ResizeConfig }
  | { type: 'blur'; options: BlurOptions }
  | { type: 'filter'; options: any };

/**
 * 최종 레이아웃 정보 - 모든 연산 분석 결과
 */
export interface FinalLayout {
  width: number;
  height: number;
  position: { x: number; y: number };
  imageSize: { width: number; height: number };
  background: string;
  filters: string[];
}

/**
 * 지연 렌더링 파이프라인
 *
 * 기존 파이프라인과 달리 각 연산마다 즉시 Canvas에 그리지 않고,
 * 모든 계산을 완료한 후 최종에 한 번만 렌더링
 */
export class LazyRenderPipeline {
  private operations: LazyOperation[] = [];
  private sourceImage: HTMLImageElement;
  private resizeCalled = false;

  constructor(sourceImage: HTMLImageElement) {
    this.sourceImage = sourceImage;
  }

  /**
   * 리사이징 연산 추가 (계산만, 렌더링 안함)
   * 한 번만 호출 가능하도록 제약
   */
  addResize(config: ResizeConfig): this {
    if (this.resizeCalled) {
      throw new ImageProcessError(
        'resize()는 한 번만 호출할 수 있습니다. 여러 resize를 원한다면 새로운 processImage()를 사용하세요.',
        'MULTIPLE_RESIZE_NOT_ALLOWED'
      );
    }
    this.resizeCalled = true;
    this.operations.push({ type: 'resize', config });
    return this;
  }

  /**
   * 블러 연산 추가 (계산만, 렌더링 안함)
   * 여러 번 호출 가능
   */
  addBlur(options: BlurOptions): this {
    this.operations.push({ type: 'blur', options });
    return this;
  }

  /**
   * 필터 연산 추가 (계산만, 렌더링 안함)
   */
  addFilter(options: any): this {
    this.operations.push({ type: 'filter', options });
    return this;
  }

  /**
   * 모든 연산을 분석하여 최종 레이아웃 계산
   * single-renderer의 analyzeAllOperations 사용
   */
  private calculateFinalLayout(): FinalLayout {
    return analyzeAllOperations(this.sourceImage, this.operations);
  }

  /**
   * 🚀 핵심: 모든 계산 결과를 바탕으로 단 한 번만 렌더링
   * single-renderer의 renderAllOperationsOnce 사용
   */
  private renderOnce(): HTMLCanvasElement {
    return renderAllOperationsOnce(this.sourceImage, this.operations);
  }

  /**
   * Blob 형태로 최종 결과 출력
   * 이 시점에서 실제 렌더링 수행
   */
  async toBlob(format: string = 'image/png', quality?: number): Promise<{ blob: Blob; metadata: ResultMetadata }> {
    const startTime = performance.now();
    const canvas = this.renderOnce();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new ImageProcessError('Blob 생성 실패', 'BLOB_CONVERSION_ERROR'));
            return;
          }

          const metadata: ResultMetadata = {
            width: canvas.width,
            height: canvas.height,
            format: format as any,
            size: blob.size,
            processingTime: performance.now() - startTime,
            operations: this.operations.length,
          };

          // 디버깅 정보 출력
          const layout = this.calculateFinalLayout();
          debugLayout(layout, this.operations.length);

          resolve({ blob, metadata });
        },
        format,
        quality
      );
    });
  }

  /**
   * Canvas 형태로 최종 결과 출력
   * 이 시점에서 실제 렌더링 수행
   */
  toCanvas(): { canvas: HTMLCanvasElement; metadata: ResultMetadata } {
    const startTime = performance.now();
    const canvas = this.renderOnce();

    const metadata: ResultMetadata = {
      width: canvas.width,
      height: canvas.height,
      format: 'canvas' as any,
      size: canvas.width * canvas.height * 4, // RGBA 추정
      processingTime: performance.now() - startTime,
      operations: this.operations.length,
    };

    // 디버깅 정보 출력
    const layout = this.calculateFinalLayout();
    debugLayout(layout, this.operations.length);

    return { canvas, metadata };
  }

  /**
   * 연산 개수 반환 (디버깅용)
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * 연산 목록 반환 (디버깅용)
   */
  getOperations(): LazyOperation[] {
    return [...this.operations];
  }
}
