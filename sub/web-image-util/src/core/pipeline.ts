/**
 * 렌더링 파이프라인 - 이미지 처리 연산들을 순차적으로 실행
 */

import { CanvasPool } from '../base/canvas-pool';
import type { BlurOptions, ResizeOptions, ResultMetadata, SmartResizeOptions, OutputFormat } from '../types';
import { ImageProcessError } from '../types';
import { SmartProcessor } from './smart-processor';

/**
 * 파이프라인 연산 인터페이스
 */
export interface Operation {
  type: 'resize' | 'blur' | 'rotate' | 'filter' | 'trim' | 'smart-resize';
  options: ResizeOptions | BlurOptions | SmartResizeOptions | any;
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
   * 파이프라인의 모든 연산 실행
   */
  async execute(sourceImage: HTMLImageElement): Promise<{
    canvas: HTMLCanvasElement;
    result: ResultMetadata;
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
   */
  private createInitialCanvas(sourceImage: HTMLImageElement): CanvasContext {
    const width = sourceImage.naturalWidth || sourceImage.width;
    const height = sourceImage.naturalHeight || sourceImage.height;

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
        return this.executeResize(context, operation.options as ResizeOptions);
      case 'smart-resize':
        return await this.executeSmartResize(context, operation.options as SmartResizeOptions);
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

    // 새 캔버스 생성 (Canvas Pool 사용)
    const newCanvas = this.canvasPool.acquire(dimensions.canvasWidth, dimensions.canvasHeight);
    const newCtx = newCanvas.getContext('2d');

    if (!newCtx) {
      this.canvasPool.release(newCanvas);
      throw new ImageProcessError('리사이징용 캔버스 생성에 실패했습니다', 'CANVAS_CREATION_FAILED');
    }

    // 🚀 확대 시 고품질 설정 강화 - SVG 벡터 품질 유지
    const scaleX = dimensions.destWidth / dimensions.sourceWidth;
    const scaleY = dimensions.destHeight / dimensions.sourceHeight;
    const isScalingUp = scaleX > 1 || scaleY > 1;

    if (isScalingUp) {
      newCtx.imageSmoothingEnabled = true;
      newCtx.imageSmoothingQuality = 'high';
    } else {
      // 축소 시에도 고품질 유지
      newCtx.imageSmoothingEnabled = true;
      newCtx.imageSmoothingQuality = 'high';
    }

    // 임시 Canvas로 추적
    this.temporaryCanvases.push(newCanvas);

    // 배경색 설정
    if (options.background && fit === 'contain') {
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
   * 리사이징 치수 계산 (CSS object-fit 알고리즘 기반)
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

    // 🔍 DEBUG: Fit mode 계산 디버깅
    console.log('🧪 calculateResizeDimensions DEBUG:', {
      originalSize: `${originalWidth}x${originalHeight}`,
      targetSize: `${finalTargetWidth}x${finalTargetHeight}`,
      fitMode: fit,
      timestamp: Date.now()
    });

    switch (fit) {
      case 'fill':
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

      case 'contain': {
        const padScale = Math.min(finalTargetWidth / originalWidth, finalTargetHeight / originalHeight);
        const padWidth = Math.round(originalWidth * padScale);
        const padHeight = Math.round(originalHeight * padScale);

        // 🟩 DEBUG: CONTAIN 모드 상세 계산
        const result = {
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

        console.log('🟩 CONTAIN result:', {
          scale: padScale.toFixed(3) + ' (Math.min)',
          imageSize: `${padWidth}x${padHeight}`,
          canvasSize: `${result.canvasWidth}x${result.canvasHeight}`,
          position: `${result.destX},${result.destY}`,
          padding: `${finalTargetWidth - padWidth}x${finalTargetHeight - padHeight}`,
          scaleCalculation: `Math.min(${finalTargetWidth}/${originalWidth}, ${finalTargetHeight}/${originalHeight})`
        });

        return result;
      }

      case 'inside': {
        // 최대 크기 제한: 비율 유지하며 축소만 (확대 안함)
        const insideScale = Math.min(finalTargetWidth / originalWidth, finalTargetHeight / originalHeight);
        const insideWidth = Math.round(originalWidth * insideScale);
        const insideHeight = Math.round(originalHeight * insideScale);

        return {
          canvasWidth: insideWidth, // 실제 이미지 크기로 Canvas 생성
          canvasHeight: insideHeight,
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: 0,
          destY: 0,
          destWidth: insideWidth,
          destHeight: insideHeight,
        };
      }

      case 'outside': {
        // 최소 크기 보장: 비율 유지하며 확대만 (축소 안함)
        const outsideScale = Math.max(finalTargetWidth / originalWidth, finalTargetHeight / originalHeight);
        const outsideWidth = Math.round(originalWidth * outsideScale);
        const outsideHeight = Math.round(originalHeight * outsideScale);

        return {
          canvasWidth: outsideWidth, // 실제 이미지 크기로 Canvas 생성
          canvasHeight: outsideHeight,
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: 0,
          destY: 0,
          destWidth: outsideWidth,
          destHeight: outsideHeight,
        };
      }

      case 'cover':
      default: {
        const coverScale = Math.max(finalTargetWidth / originalWidth, finalTargetHeight / originalHeight);
        const coverWidth = Math.round(originalWidth * coverScale);
        const coverHeight = Math.round(originalHeight * coverScale);

        // 🔴 DEBUG: COVER 모드 상세 계산
        const result = {
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

        console.log('🔴 COVER result:', {
          scale: coverScale.toFixed(3) + ' (Math.max)',
          imageSize: `${coverWidth}x${coverHeight}`,
          canvasSize: `${result.canvasWidth}x${result.canvasHeight}`,
          position: `${result.destX},${result.destY}`,
          overflow: `${coverWidth - finalTargetWidth}x${coverHeight - finalTargetHeight}`,
          scaleCalculation: `Math.max(${finalTargetWidth}/${originalWidth}, ${finalTargetHeight}/${originalHeight})`
        });

        return result;
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
