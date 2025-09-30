/**
 * 렌더링 파이프라인 - 이미지 처리 연산들을 순차적으로 실행
 */

import { CanvasPool } from '../base/canvas-pool';
import type { BlurOptions, OutputFormat, ResultMetadata, SmartResizeOptions } from '../types';
import { ImageProcessError } from '../types';
import { SmartProcessor } from './smart-processor';
import type { ResizeConfig } from '../types/resize-config';
import { executeCoverResize } from './resize-engines/cover';
import { executeContainResize } from './resize-engines/contain';
import { executeFillResize } from './resize-engines/fill';
import { executeMaxFitResize } from './resize-engines/max-fit';
import { executeMinFitResize } from './resize-engines/min-fit';

/**
 * 리사이즈 연산
 */
export interface ResizeOperation {
  type: 'resize';
  config: ResizeConfig;
}


/**
 * 파이프라인 연산 인터페이스
 */
export type Operation =
  | ResizeOperation
  | { type: 'blur'; options: BlurOptions }
  | { type: 'smart-resize'; options: SmartResizeOptions }
  | { type: 'rotate'; options: any }
  | { type: 'filter'; options: any }
  | { type: 'trim'; options?: any };

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
  private canvasPool = CanvasPool.getInstance();
  private temporaryCanvases: HTMLCanvasElement[] = [];
  private outputFormat?: OutputFormat;

  /**
   * 연산을 파이프라인에 추가
   */
  addOperation(operation: Operation): void {
    this.operations.push(operation);
  }

  /**
   * 출력 포맷 설정
   */
  setOutputFormat(format: OutputFormat): void {
    this.outputFormat = format;
  }

  /**
   * 현재 파이프라인에 등록된 모든 연산 반환
   */
  getOperations(): Operation[] {
    return [...this.operations]; // 복사본 반환으로 외부 수정 방지
  }

  /**
   * fit 모드별 최종 크기 계산 (패딩 포함)
   *
   * @param originalWidth 원본 너비
   * @param originalHeight 원본 높이
   * @param resizeConfig resize 설정
   * @returns 최종 크기 (패딩 포함된 Canvas 크기)
   */
  private calculateFinalSize(
    originalWidth: number,
    originalHeight: number,
    resizeConfig: any
  ): { width: number; height: number } {
    const { width: targetWidth, height: targetHeight, fit, padding } = resizeConfig;

    // 1단계: 패딩 제외한 이미지 크기 계산
    let imageWidth: number;
    let imageHeight: number;

    switch (fit) {
      case 'maxFit': {
        // 최대 크기 제한 (축소만, 확대 안함)
        let scale = 1;
        if (targetWidth) scale = Math.min(scale, targetWidth / originalWidth);
        if (targetHeight) scale = Math.min(scale, targetHeight / originalHeight);
        scale = Math.min(scale, 1); // 확대 방지

        imageWidth = Math.round(originalWidth * scale);
        imageHeight = Math.round(originalHeight * scale);
        break;
      }

      case 'minFit': {
        // 최소 크기 보장 (확대만, 축소 안함)
        let scale = 1;
        if (targetWidth) scale = Math.max(scale, targetWidth / originalWidth);
        if (targetHeight) scale = Math.max(scale, targetHeight / originalHeight);
        scale = Math.max(scale, 1); // 축소 방지

        imageWidth = Math.round(originalWidth * scale);
        imageHeight = Math.round(originalHeight * scale);
        break;
      }

      case 'cover': {
        // 전체 영역을 채움 (잘림 가능)
        if (targetWidth && targetHeight) {
          imageWidth = targetWidth;
          imageHeight = targetHeight;
        } else {
          imageWidth = originalWidth;
          imageHeight = originalHeight;
        }
        break;
      }

      case 'contain': {
        // 전체 이미지가 들어가도록 맞춤 (여백 가능)
        if (targetWidth && targetHeight) {
          const scaleX = targetWidth / originalWidth;
          const scaleY = targetHeight / originalHeight;
          const scale = Math.min(scaleX, scaleY);

          imageWidth = Math.round(originalWidth * scale);
          imageHeight = Math.round(originalHeight * scale);
        } else {
          imageWidth = originalWidth;
          imageHeight = originalHeight;
        }
        break;
      }

      case 'fill': {
        // 정확히 맞춤 (비율 변경됨)
        if (targetWidth && targetHeight) {
          imageWidth = targetWidth;
          imageHeight = targetHeight;
        } else {
          imageWidth = originalWidth;
          imageHeight = originalHeight;
        }
        break;
      }

      default: {
        // 기본 처리: cover 모드와 동일
        if (targetWidth && targetHeight) {
          imageWidth = targetWidth;
          imageHeight = targetHeight;
        } else if (targetWidth) {
          const aspectRatio = originalHeight / originalWidth;
          imageWidth = targetWidth;
          imageHeight = Math.round(targetWidth * aspectRatio);
        } else if (targetHeight) {
          const aspectRatio = originalWidth / originalHeight;
          imageWidth = Math.round(targetHeight * aspectRatio);
          imageHeight = targetHeight;
        } else {
          imageWidth = originalWidth;
          imageHeight = originalHeight;
        }
        break;
      }
    }

    // 🎯 Pipeline에서는 패딩 제외한 이미지 크기로 Canvas 생성
    // 패딩은 resize 엔진에서 처리하여 이미지 배치 좌표까지 함께 계산
    return {
      width: imageWidth,
      height: imageHeight
    };
  }

  /**
   * 패딩 값 정규화 함수
   * number 또는 객체를 {top, right, bottom, left} 형태로 변환
   */
  private normalizePadding(padding?: number | { top?: number; right?: number; bottom?: number; left?: number }): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } {
    if (typeof padding === 'number') {
      // 숫자 하나면 4방향 동일
      return { top: padding, right: padding, bottom: padding, left: padding };
    } else if (padding && typeof padding === 'object') {
      // 객체면 필요한 방향만 선택적으로 지정
      return {
        top: padding.top || 0,
        right: padding.right || 0,
        bottom: padding.bottom || 0,
        left: padding.left || 0,
      };
    } else {
      // 패딩이 없으면 모두 0
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
  }

  /**
   * 파이프라인의 모든 연산 실행
   */
  async execute(sourceImage: HTMLImageElement): Promise<{
    canvas: HTMLCanvasElement;
    result: ResultMetadata;
  }> {
    this.startTime = performance.now();

    try {
      let currentContext = this.createInitialCanvas(sourceImage);

      // 소스 이미지를 첫 번째 캔버스에 그리기 (fit 모드 고려)
      this.drawImageWithFit(currentContext, sourceImage);

      // 각 연산을 순차적으로 실행
      for (const operation of this.operations) {
        currentContext = await this.executeOperation(currentContext, operation);
      }

      const processingTime = performance.now() - this.startTime;

      const result: ResultMetadata = {
        width: currentContext.width,
        height: currentContext.height,
        processingTime,
        originalSize: {
          width: sourceImage.naturalWidth || sourceImage.width,
          height: sourceImage.naturalHeight || sourceImage.height,
        },
        format: this.outputFormat,
      };

      // 임시 Canvas들을 Pool로 반환 (최종 결과 Canvas는 제외)
      this.releaseTemporaryCanvases(currentContext.canvas);

      return {
        canvas: currentContext.canvas,
        result,
      };
    } catch (error) {
      // 에러 발생 시에도 임시 Canvas들 정리
      this.releaseTemporaryCanvases();
      throw new ImageProcessError('파이프라인 실행 중 오류가 발생했습니다', 'CANVAS_CREATION_FAILED', error as Error);
    }
  }

  /**
   * 초기 캔버스 생성 (Canvas Pool 사용)
   *
   * SVG 품질 최적화: 첫 번째 resize 연산이 있으면 해당 목표 크기로 Canvas를 생성하여
   * SVG를 고품질로 렌더링합니다.
   */
  private createInitialCanvas(sourceImage: HTMLImageElement): CanvasContext {
    let width = sourceImage.naturalWidth || sourceImage.width;
    let height = sourceImage.naturalHeight || sourceImage.height;

    // 🎯 SVG 품질 최적화: resize 연산이 있으면 최종 크기를 미리 계산하여 Canvas 생성
    const firstOp = this.operations[0];
    if (firstOp?.type === 'resize') {
      const resizeConfig = firstOp.config;
      const targetWidth = resizeConfig.width;
      const targetHeight = resizeConfig.height;

      // 📐 fit 모드별 최종 크기 계산
      const finalSize = this.calculateFinalSize(width, height, resizeConfig);

      console.log('🎯 SVG 최적화: 최종 크기로 Canvas 생성', {
        originalSize: `${width}x${height}`,
        targetSize: `${targetWidth || 'auto'}x${targetHeight || 'auto'}`,
        finalSize: `${finalSize.width}x${finalSize.height}`,
        fit: resizeConfig.fit,
      });

      width = finalSize.width;
      height = finalSize.height;
    }

    const canvas = this.canvasPool.acquire(width, height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // Pool에서 가져온 Canvas 반환
      this.canvasPool.release(canvas);
      throw new ImageProcessError('Canvas 2D 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
    }

    // 🚀 고품질 렌더링 설정 추가 - SVG 화질 개선
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 임시 Canvas로 추적
    this.temporaryCanvases.push(canvas);

    return { canvas, ctx, width, height };
  }

  /**
   * 개별 연산 실행
   */
  private async executeOperation(context: CanvasContext, operation: Operation): Promise<CanvasContext> {
    switch (operation.type) {
      case 'resize':
        return this.executeResizeWithConfig(context, operation.config);
      case 'smart-resize':
        return await this.executeSmartResize(context, operation.options);
      case 'blur':
        return this.executeBlur(context, operation.options);
      case 'trim':
        return this.executeTrim(context);
      default:
        throw new ImageProcessError(`지원하지 않는 연산입니다: ${(operation as any).type}`, 'FEATURE_NOT_SUPPORTED');
    }
  }


  /**
   * 스마트 리사이징 연산 실행
   */
  private async executeSmartResize(context: CanvasContext, options: SmartResizeOptions): Promise<CanvasContext> {
    const { width: targetWidth, height: targetHeight } = options;

    // 타겟 크기가 지정되지 않으면 원본 크기 사용
    if (!targetWidth && !targetHeight) {
      return context;
    }

    try {
      // 현재 캔버스를 HTMLImageElement로 변환
      const tempImg = await this.canvasToImage(context.canvas);

      // SmartProcessor로 처리
      const processedCanvas = await SmartProcessor.process(
        tempImg,
        targetWidth || context.width,
        targetHeight || context.height,
        options
      );

      // 새로운 컨텍스트로 반환
      const newCtx = processedCanvas.getContext('2d');
      if (!newCtx) {
        throw new ImageProcessError(
          'SmartProcessor 결과 캔버스의 컨텍스트를 가져올 수 없습니다',
          'CANVAS_CREATION_FAILED'
        );
      }

      // 임시 Canvas로 추적
      this.temporaryCanvases.push(processedCanvas);

      return {
        canvas: processedCanvas,
        ctx: newCtx,
        width: processedCanvas.width,
        height: processedCanvas.height,
      };
    } catch (error) {
      throw new ImageProcessError('스마트 리사이징 중 오류가 발생했습니다', 'SMART_RESIZE_FAILED', error as Error);
    }
  }

  /**
   * Canvas를 HTMLImageElement로 변환 (SmartProcessor 사용을 위해)
   */
  private async canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Canvas를 Image로 변환하는데 실패했습니다'));
      img.src = canvas.toDataURL();
    });
  }

  /**
   * 블러 연산 실행
   */
  private executeBlur(context: CanvasContext, options: BlurOptions): CanvasContext {
    const { radius = 2 } = options;

    try {
      // CSS filter를 사용한 블러 (빠르지만 품질이 조금 떨어질 수 있음)
      context.ctx.filter = `blur(${radius}px)`;

      // 임시 캔버스에 블러 적용된 이미지 그리기 (Canvas Pool 사용)
      const tempCanvas = this.canvasPool.acquire(context.width, context.height);
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        this.canvasPool.release(tempCanvas);
        throw new ImageProcessError('블러용 임시 캔버스 생성에 실패했습니다', 'CANVAS_CREATION_FAILED');
      }

      // 🚀 블러 처리 시에도 고품질 설정 유지
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      tempCtx.filter = `blur(${radius}px)`;

      tempCtx.drawImage(context.canvas, 0, 0);

      // 원본 캔버스에 블러된 이미지 다시 그리기
      context.ctx.filter = 'none';
      context.ctx.clearRect(0, 0, context.width, context.height);
      context.ctx.drawImage(tempCanvas, 0, 0);

      // 임시 Canvas 즉시 반환
      this.canvasPool.release(tempCanvas);

      return context;
    } catch (error) {
      throw new ImageProcessError('블러 적용 중 오류가 발생했습니다', 'BLUR_FAILED', error as Error);
    }
  }

  /**
   * ResizeConfig 기반 리사이징 실행 (v2.0+)
   * fit 모드별 분기 처리 - 각 엔진으로 위임
   */
  private executeResizeWithConfig(context: CanvasContext, config: ResizeConfig): CanvasContext {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 executeResizeWithConfig:', {
        fit: config.fit,
        size: `${config.width || '?'}x${config.height || '?'}`,
        config,
      });
    }

    let resizedCanvas: HTMLCanvasElement;

    // fit 모드별 엔진으로 위임
    console.log('🚦 Pipeline fit 모드 분기:', config.fit);

    switch (config.fit) {
      case 'cover':
        console.log('✅ Cover 엔진 호출');
        resizedCanvas = executeCoverResize(context.canvas, config);
        break;
      case 'contain':
        console.log('✅ Contain 엔진 호출');
        resizedCanvas = executeContainResize(context.canvas, config);
        break;
      case 'fill':
        console.log('✅ Fill 엔진 호출');
        resizedCanvas = executeFillResize(context.canvas, config);
        break;
      case 'maxFit':
        console.log('✅ MaxFit 엔진 호출');
        resizedCanvas = executeMaxFitResize(context.canvas, config);
        break;
      case 'minFit':
        console.log('✅ MinFit 엔진 호출');
        resizedCanvas = executeMinFitResize(context.canvas, config);
        break;
      default: {
        // Exhaustiveness check: TypeScript가 모든 케이스를 처리했는지 확인
        const _exhaustiveCheck: never = config;
        throw new ImageProcessError(
          `지원하지 않는 fit 모드입니다: ${(_exhaustiveCheck as any).fit}`,
          'FEATURE_NOT_SUPPORTED'
        );
      }
    }

    // 새로운 컨텍스트로 반환
    const newCtx = resizedCanvas.getContext('2d');
    if (!newCtx) {
      throw new ImageProcessError('리사이징 결과 캔버스의 컨텍스트를 가져올 수 없습니다', 'CANVAS_CREATION_FAILED');
    }

    // 기존 Canvas가 변경되지 않은 경우 그대로 반환
    if (resizedCanvas === context.canvas) {
      return context;
    }

    // 임시 Canvas로 추적
    this.temporaryCanvases.push(resizedCanvas);

    return {
      canvas: resizedCanvas,
      ctx: newCtx,
      width: resizedCanvas.width,
      height: resizedCanvas.height,
    };
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

    // 새 캔버스 생성 (Canvas Pool 사용)
    const newCanvas = this.canvasPool.acquire(trimmedWidth, trimmedHeight);
    const newCtx = newCanvas.getContext('2d');

    if (!newCtx) {
      this.canvasPool.release(newCanvas);
      throw new ImageProcessError('Trim용 캔버스 생성에 실패했습니다', 'CANVAS_CREATION_FAILED');
    }

    // 🚀 트림 처리 시에도 고품질 설정 유지
    newCtx.imageSmoothingEnabled = true;
    newCtx.imageSmoothingQuality = 'high';

    // 임시 Canvas로 추적
    this.temporaryCanvases.push(newCanvas);

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
   * 임시 Canvas들을 Pool로 반환
   * @param excludeCanvas - 반환에서 제외할 Canvas (최종 결과 Canvas)
   */
  private releaseTemporaryCanvases(excludeCanvas?: HTMLCanvasElement): void {
    this.temporaryCanvases.forEach((canvas) => {
      if (canvas !== excludeCanvas) {
        this.canvasPool.release(canvas);
      }
    });

    // 제외된 Canvas를 제외하고 임시 Canvas 목록 초기화
    if (excludeCanvas) {
      this.temporaryCanvases = [excludeCanvas];
    } else {
      this.temporaryCanvases = [];
    }
  }

  /**
   * fit 모드를 고려하여 소스 이미지를 Canvas에 그리기
   * SVG 화질 유지하면서 fit 모드별 다른 결과 생성
   */
  private drawImageWithFit(context: CanvasContext, sourceImage: HTMLImageElement): void {
    const { ctx, width: canvasWidth, height: canvasHeight } = context;
    const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
    const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

    // 첫 번째 resize 연산에서 fit 정보 가져오기 (새로운 ResizeConfig 형태만 지원)
    const firstOp = this.operations[0];
    const fit = (firstOp?.type === 'resize' && firstOp.config.fit) || 'cover';

    console.log('🎨 drawImageWithFit:', {
      sourceSize: `${sourceWidth}x${sourceHeight}`,
      canvasSize: `${canvasWidth}x${canvasHeight}`,
      fitMode: fit,
    });

    // fit 모드별 drawImage 파라미터 계산
    const drawParams = this.calculateFitDrawParams(sourceWidth, sourceHeight, canvasWidth, canvasHeight, fit);

    console.log('🖼️ drawImage 파라미터:', drawParams);

    // 계산된 파라미터로 이미지 그리기
    ctx.drawImage(
      sourceImage,
      drawParams.sx,
      drawParams.sy,
      drawParams.sWidth,
      drawParams.sHeight,
      drawParams.dx,
      drawParams.dy,
      drawParams.dWidth,
      drawParams.dHeight
    );
  }

  /**
   * CSS object-fit과 동일한 방식으로 drawImage 파라미터 계산
   */
  private calculateFitDrawParams(
    sourceWidth: number,
    sourceHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    fit: string
  ) {
    switch (fit) {
      case 'fill':
        // 비율 무시하고 Canvas 크기에 맞춤
        return {
          sx: 0,
          sy: 0,
          sWidth: sourceWidth,
          sHeight: sourceHeight,
          dx: 0,
          dy: 0,
          dWidth: canvasWidth,
          dHeight: canvasHeight,
        };

      case 'contain': {
        // 이미지 전체가 Canvas에 들어가도록 스케일링 (여백 생성)
        const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;
        const dx = (canvasWidth - scaledWidth) / 2;
        const dy = (canvasHeight - scaledHeight) / 2;

        return {
          sx: 0,
          sy: 0,
          sWidth: sourceWidth,
          sHeight: sourceHeight,
          dx,
          dy,
          dWidth: scaledWidth,
          dHeight: scaledHeight,
        };
      }

      case 'cover':
      default: {
        // Canvas를 가득 채우되 비율 유지 (일부 잘림)
        const scale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;
        const dx = (canvasWidth - scaledWidth) / 2;
        const dy = (canvasHeight - scaledHeight) / 2;

        return {
          sx: 0,
          sy: 0,
          sWidth: sourceWidth,
          sHeight: sourceHeight,
          dx,
          dy,
          dWidth: scaledWidth,
          dHeight: scaledHeight,
        };
      }
    }
  }

  /**
   * 파이프라인 초기화
   */
  reset(): void {
    // 모든 임시 Canvas들을 Pool로 반환
    this.releaseTemporaryCanvases();

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
