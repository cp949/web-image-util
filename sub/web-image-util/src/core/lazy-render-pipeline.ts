/**
 * 지연 렌더링 파이프라인 - 모든 연산을 계산으로만 처리하고 최종에 한 번만 렌더링
 *
 * 핵심 철학: "계산은 미리, 렌더링은 한 번"
 * - 모든 resize, blur 등 연산을 메모리에 누적
 * - toBlob(), toCanvas() 호출 시에만 실제 렌더링 수행
 * - 중간 Canvas 생성 없이 최종 결과만 생성
 */

import type { BlurOptions, ResultMetadata } from '../types';
import { ImageProcessError } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import type { ResizeOperation, ScaleOperation } from '../types/shortcut-types';
import { analyzeAllOperations, debugLayout, renderAllOperationsOnce } from './single-renderer';

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
 * 크기 정보 인터페이스
 */
export interface Size {
  width: number;
  height: number;
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
  private pendingResizeOperation?: ResizeOperation;

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
   * Lazy 리사이즈 연산 추가 (Shortcut API용 내부 메서드)
   *
   * @description 소스 크기가 필요한 연산을 pending 상태로 저장합니다.
   * 최종 출력 시점에 convertToResizeConfig를 통해 ResizeConfig로 변환됩니다.
   *
   * @param operation ResizeOperation (scale, toWidth, toHeight)
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void {
    this.pendingResizeOperation = operation;
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

    // 🎯 철학 구현: 최종 출력 시점에만 연산 수행
    if (this.pendingResizeOperation) {
      const resizeConfig = this.convertToResizeConfig(this.pendingResizeOperation);
      this.addResize(resizeConfig); // 기존 시스템 활용
      this.pendingResizeOperation = undefined; // 처리 완료 후 정리
    }

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

  /**
   * 소스 이미지 크기 조회
   * @private
   */
  private getSourceSize(): Size {
    return {
      width: this.sourceImage.naturalWidth,
      height: this.sourceImage.naturalHeight,
    };
  }

  /**
   * ResizeOperation을 ResizeConfig로 변환
   *
   * @description 이 시점에서만 소스 크기를 조회하여 최종 ResizeConfig를 생성합니다.
   * Discriminated Union 패턴을 사용하여 타입 안전성을 보장합니다.
   *
   * TypeScript 모범 사례 (Context7):
   * - switch 문으로 Discriminated Union 타입 narrowing
   * - 각 case 블록에서 타입이 자동으로 좁혀짐
   * - exhaustive checking으로 모든 케이스 처리 보장
   *
   * @param operation 변환할 ResizeOperation
   * @returns ResizeConfig
   * @private
   */
  private convertToResizeConfig(operation: ResizeOperation): ResizeConfig {
    const sourceSize = this.getSourceSize(); // 이 시점에서만 크기 조회!

    // TypeScript 모범 사례: switch 문으로 Discriminated Union 처리
    // 각 case에서 operation.type에 따라 타입이 자동으로 narrowing됨
    switch (operation.type) {
      case 'scale':
        // operation: { type: 'scale'; value: ScaleOperation }
        return this.handleScale(sourceSize, operation.value);

      case 'toWidth': {
        // operation: { type: 'toWidth'; width: number }
        const aspectRatio = sourceSize.height / sourceSize.width;
        return {
          fit: 'fill',
          width: operation.width,
          height: Math.round(operation.width * aspectRatio),
        };
      }

      case 'toHeight': {
        // operation: { type: 'toHeight'; height: number }
        const aspectRatio = sourceSize.width / sourceSize.height;
        return {
          fit: 'fill',
          width: Math.round(operation.height * aspectRatio),
          height: operation.height,
        };
      }

      // TypeScript exhaustive checking:
      // 모든 케이스를 처리했으므로 default는 도달 불가능
      // 새로운 타입 추가 시 컴파일 에러 발생으로 안전성 보장
    }
  }

  /**
   * ScaleOperation을 ResizeConfig로 변환
   *
   * @description ScaleOperation의 4가지 형태를 모두 처리합니다:
   * - number: 균등 배율
   * - { sx }: X축만 배율
   * - { sy }: Y축만 배율
   * - { sx, sy }: X/Y 축 개별 배율
   *
   * TypeScript 모범 사례:
   * - Discriminated Union 타입 narrowing을 위해 명시적 타입 가드 사용
   * - 타입 안전성을 위한 exhaustive checking 패턴 적용
   *
   * @param source 소스 이미지 크기
   * @param scale ScaleOperation
   * @returns ResizeConfig
   * @private
   */
  private handleScale(source: Size, scale: ScaleOperation): ResizeConfig {
    // 균등 배율인 경우 (타입: number)
    if (typeof scale === 'number') {
      return {
        fit: 'fill',
        width: Math.round(source.width * scale),
        height: Math.round(source.height * scale),
      };
    }

    // 객체 형태인 경우: { sx?, sy? }
    // TypeScript 모범 사례: 'in' 연산자로 타입 narrowing
    // sx와 sy의 존재 여부에 따라 적절한 기본값 적용
    const sx = 'sx' in scale ? scale.sx : 1;
    const sy = 'sy' in scale ? scale.sy : 1;

    return {
      fit: 'fill',
      width: Math.round(source.width * sx),
      height: Math.round(source.height * sy),
    };
  }
}
