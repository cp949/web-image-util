/**
 * 렌더링 파이프라인 - 이미지 처리 연산들을 순차적으로 실행
 */

import type { BlurOptions, ProcessResult, ResizeOptions } from '../types';
import { ImageProcessError } from '../types';

/**
 * 파이프라인 연산 인터페이스
 */
export interface Operation {
  type: 'resize' | 'blur' | 'rotate' | 'filter' | 'trim';
  options: ResizeOptions | BlurOptions | any;
}

/**
 * Canvas 컨텍스트 정보
 */
interface CanvasContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * 렌더링 파이프라인 클래스
 */
export class RenderPipeline {
  private operations: Operation[] = [];
  private startTime: number = 0;

  /**
   * 연산을 파이프라인에 추가
   */
  addOperation(operation: Operation): void {
    this.operations.push(operation);
  }

  /**
   * 파이프라인의 모든 연산 실행
   */
  async execute(sourceImage: HTMLImageElement): Promise<{
    canvas: HTMLCanvasElement;
    result: ProcessResult;
  }> {
    this.startTime = performance.now();

    try {
      let currentContext = this.createInitialCanvas(sourceImage);

      // 소스 이미지를 첫 번째 캔버스에 그리기
      currentContext.ctx.drawImage(sourceImage, 0, 0, currentContext.width, currentContext.height);

      // 각 연산을 순차적으로 실행
      for (const operation of this.operations) {
        currentContext = await this.executeOperation(currentContext, operation);
      }

      const processingTime = performance.now() - this.startTime;

      const result: ProcessResult = {
        width: currentContext.width,
        height: currentContext.height,
        processingTime,
        originalSize: {
          width: sourceImage.naturalWidth || sourceImage.width,
          height: sourceImage.naturalHeight || sourceImage.height,
        },
      };

      return {
        canvas: currentContext.canvas,
        result,
      };
    } catch (error) {
      throw new ImageProcessError('파이프라인 실행 중 오류가 발생했습니다', 'CANVAS_CREATION_FAILED', error as Error);
    }
  }

  /**
   * 초기 캔버스 생성
   */
  private createInitialCanvas(sourceImage: HTMLImageElement): CanvasContext {
    const width = sourceImage.naturalWidth || sourceImage.width;
    const height = sourceImage.naturalHeight || sourceImage.height;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new ImageProcessError('Canvas 2D 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
    }

    canvas.width = width;
    canvas.height = height;

    return { canvas, ctx, width, height };
  }

  /**
   * 개별 연산 실행
   */
  private async executeOperation(context: CanvasContext, operation: Operation): Promise<CanvasContext> {
    switch (operation.type) {
      case 'resize':
        return this.executeResize(context, operation.options as ResizeOptions);
      case 'blur':
        return this.executeBlur(context, operation.options as BlurOptions);
      case 'trim':
        return this.executeTrim(context);
      default:
        throw new ImageProcessError(`지원하지 않는 연산입니다: ${operation.type}`, 'FEATURE_NOT_SUPPORTED');
    }
  }

  /**
   * 리사이징 연산 실행
   */
  private executeResize(context: CanvasContext, options: ResizeOptions): CanvasContext {
    const { width: targetWidth, height: targetHeight, fit = 'cover' } = options;

    // 타겟 크기가 지정되지 않으면 원본 크기 사용
    if (!targetWidth && !targetHeight) {
      return context;
    }

    const originalWidth = context.width;
    const originalHeight = context.height;

    // 크기 계산
    const dimensions = this.calculateResizeDimensions(
      originalWidth,
      originalHeight,
      targetWidth,
      targetHeight,
      fit,
      options
    );

    // 새 캔버스 생성
    const newCanvas = document.createElement('canvas');
    const newCtx = newCanvas.getContext('2d');

    if (!newCtx) {
      throw new ImageProcessError('리사이징용 캔버스 생성에 실패했습니다', 'CANVAS_CREATION_FAILED');
    }

    newCanvas.width = dimensions.canvasWidth;
    newCanvas.height = dimensions.canvasHeight;

    // 배경색 설정
    if (options.background && fit === 'letterbox') {
      this.fillBackground(newCtx, dimensions.canvasWidth, dimensions.canvasHeight, options.background);
    }

    // 이미지 그리기
    newCtx.drawImage(
      context.canvas,
      dimensions.sourceX,
      dimensions.sourceY,
      dimensions.sourceWidth,
      dimensions.sourceHeight,
      dimensions.destX,
      dimensions.destY,
      dimensions.destWidth,
      dimensions.destHeight
    );

    return {
      canvas: newCanvas,
      ctx: newCtx,
      width: dimensions.canvasWidth,
      height: dimensions.canvasHeight,
    };
  }

  /**
   * 블러 연산 실행
   */
  private executeBlur(context: CanvasContext, options: BlurOptions): CanvasContext {
    const { radius = 2 } = options;

    try {
      // CSS filter를 사용한 블러 (빠르지만 품질이 조금 떨어질 수 있음)
      context.ctx.filter = `blur(${radius}px)`;

      // 임시 캔버스에 블러 적용된 이미지 그리기
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        throw new ImageProcessError('블러용 임시 캔버스 생성에 실패했습니다', 'CANVAS_CREATION_FAILED');
      }

      tempCanvas.width = context.width;
      tempCanvas.height = context.height;
      tempCtx.filter = `blur(${radius}px)`;

      tempCtx.drawImage(context.canvas, 0, 0);

      // 원본 캔버스에 블러된 이미지 다시 그리기
      context.ctx.filter = 'none';
      context.ctx.clearRect(0, 0, context.width, context.height);
      context.ctx.drawImage(tempCanvas, 0, 0);

      return context;
    } catch (error) {
      throw new ImageProcessError('블러 적용 중 오류가 발생했습니다', 'BLUR_FAILED', error as Error);
    }
  }

  /**
   * 리사이징 치수 계산 (Sharp의 로직 참고)
   */
  private calculateResizeDimensions(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number | undefined,
    targetHeight: number | undefined,
    fit: string,
    options: ResizeOptions
  ) {
    // 타겟 크기 결정
    let finalTargetWidth =
      targetWidth || Math.round((originalWidth * (targetHeight || originalHeight)) / originalHeight);
    let finalTargetHeight =
      targetHeight || Math.round((originalHeight * (targetWidth || originalWidth)) / originalWidth);

    // 확대/축소 방지 옵션 적용
    if (options.withoutEnlargement) {
      if (finalTargetWidth > originalWidth || finalTargetHeight > originalHeight) {
        const scale = Math.min(originalWidth / finalTargetWidth, originalHeight / finalTargetHeight);
        finalTargetWidth = Math.round(finalTargetWidth * scale);
        finalTargetHeight = Math.round(finalTargetHeight * scale);
      }
    }

    if (options.withoutReduction) {
      if (finalTargetWidth < originalWidth || finalTargetHeight < originalHeight) {
        const scale = Math.max(originalWidth / finalTargetWidth, originalHeight / finalTargetHeight);
        finalTargetWidth = Math.round(finalTargetWidth * scale);
        finalTargetHeight = Math.round(finalTargetHeight * scale);
      }
    }

    switch (fit) {
      case 'stretch':
        return {
          canvasWidth: finalTargetWidth,
          canvasHeight: finalTargetHeight,
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: 0,
          destY: 0,
          destWidth: finalTargetWidth,
          destHeight: finalTargetHeight,
        };

      case 'letterbox': {
        const padScale = Math.min(finalTargetWidth / originalWidth, finalTargetHeight / originalHeight);
        const padWidth = Math.round(originalWidth * padScale);
        const padHeight = Math.round(originalHeight * padScale);

        return {
          canvasWidth: finalTargetWidth,
          canvasHeight: finalTargetHeight,
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: Math.round((finalTargetWidth - padWidth) / 2),
          destY: Math.round((finalTargetHeight - padHeight) / 2),
          destWidth: padWidth,
          destHeight: padHeight,
        };
      }

      case 'cover':
      default: {
        const coverScale = Math.max(finalTargetWidth / originalWidth, finalTargetHeight / originalHeight);
        const coverWidth = Math.round(originalWidth * coverScale);
        const coverHeight = Math.round(originalHeight * coverScale);

        return {
          canvasWidth: finalTargetWidth,
          canvasHeight: finalTargetHeight,
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: Math.round((finalTargetWidth - coverWidth) / 2),
          destY: Math.round((finalTargetHeight - coverHeight) / 2),
          destWidth: coverWidth,
          destHeight: coverHeight,
        };
      }
    }
  }

  /**
   * 배경색 채우기
   */
  private fillBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: any): void {
    if (typeof background === 'string') {
      ctx.fillStyle = background;
    } else if (typeof background === 'object' && background.r !== undefined) {
      const { r, g, b, alpha = 1 } = background;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // 기본: 투명
    }

    ctx.fillRect(0, 0, width, height);
  }

  /**
   * 트림 연산 실행 - 투명 영역 제거하여 실제 콘텐츠 크기로 캔버스 크기 조정
   */
  private executeTrim(context: CanvasContext): CanvasContext {
    const { canvas, ctx } = context;

    // ImageData 가져오기
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    // 실제 콘텐츠 경계 찾기
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) {
          // 투명하지 않은 픽셀
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // 콘텐츠가 없으면 원본 그대로 반환
    if (minX >= maxX || minY >= maxY) {
      return context;
    }

    // 실제 콘텐츠 크기 계산
    const trimmedWidth = maxX - minX + 1;
    const trimmedHeight = maxY - minY + 1;

    // 새 캔버스 생성
    const newCanvas = document.createElement('canvas');
    const newCtx = newCanvas.getContext('2d');

    if (!newCtx) {
      throw new ImageProcessError('Trim용 캔버스 생성에 실패했습니다', 'CANVAS_CREATION_FAILED');
    }

    newCanvas.width = trimmedWidth;
    newCanvas.height = trimmedHeight;

    // 트림된 이미지 복사
    newCtx.drawImage(
      canvas,
      minX,
      minY,
      trimmedWidth,
      trimmedHeight, // 소스 영역
      0,
      0,
      trimmedWidth,
      trimmedHeight // 대상 영역
    );

    return {
      canvas: newCanvas,
      ctx: newCtx,
      width: trimmedWidth,
      height: trimmedHeight,
    };
  }

  /**
   * 파이프라인 초기화
   */
  reset(): void {
    this.operations = [];
    this.startTime = 0;
  }
}

/**
 * 파이프라인 팩토리 함수
 */
export function createPipeline(): RenderPipeline {
  return new RenderPipeline();
}
