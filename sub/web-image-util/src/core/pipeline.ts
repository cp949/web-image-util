/**
 * 렌더링 파이프라인 - 이미지 처리 연산들을 순차적으로 실행
 */

import { CanvasPool } from '../base/canvas-pool';
import type { BlurOptions, OutputFormat, ResultMetadata, SmartResizeOptions } from '../types';
import { ImageProcessError } from '../types';
import { SmartProcessor } from './smart-processor';
import type { ResizeConfig } from '../types/resize-config';
import { ResizeCalculator } from './resize-calculator';
import { OnehotRenderer } from './onehot-renderer';

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

  // 🎯 새로운 통합 시스템 (Phase 2 완료)
  private calculator = new ResizeCalculator();
  private renderer = new OnehotRenderer();

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

  // 🗑️ Phase 3: 제거된 메서드들
  // - calculateFinalSize() → ResizeCalculator.calculateFinalLayout()로 대체
  // - normalizePadding() → ResizeCalculator에 이미 구현됨
  // - calculateFitDrawParams() → OnehotRenderer가 처리
  // - drawImageWithFit() → OnehotRenderer.render()로 대체

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

      // 🎯 Phase 3: 소스 이미지를 Canvas에 단순 복사
      // fit 모드 처리는 executeResizeWithConfig()에서 수행
      currentContext.ctx.drawImage(sourceImage, 0, 0);

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
   * 🎯 Phase 3: 단순화된 초기 Canvas 생성
   * - 원본 크기로 Canvas 생성
   * - SVG 최적화는 OnehotRenderer가 자동 처리
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

    // 고품질 렌더링 설정
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
   * ResizeConfig 기반 리사이징 실행 (통합 시스템)
   *
   * 🎯 Phase 3: 단일 drawImage 기반 렌더링으로 단순화
   * - ResizeCalculator: 레이아웃 계산
   * - OnehotRenderer: 단일 drawImage로 렌더링
   * - 기존 5개 엔진 제거, 복잡한 분기 로직 제거
   */
  private executeResizeWithConfig(context: CanvasContext, config: ResizeConfig): CanvasContext {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 executeResizeWithConfig (통합 시스템):', {
        fit: config.fit,
        size: `${config.width || '?'}x${config.height || '?'}`,
        config,
      });
    }

    // 1. 레이아웃 계산 (ResizeCalculator)
    const layout = this.calculator.calculateFinalLayout(
      context.canvas.width,
      context.canvas.height,
      config
    );

    if (process.env.NODE_ENV === 'development') {
      console.log('📐 레이아웃 계산 완료:', layout);
    }

    // 2. 단일 drawImage로 렌더링 (OnehotRenderer)
    const resizedCanvas = this.renderer.render(context.canvas, layout, config, {
      background: config.background,
      quality: 'high',
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ 렌더링 완료:', {
        size: `${resizedCanvas.width}x${resizedCanvas.height}`,
      });
    }

    // 3. 새로운 컨텍스트로 반환
    const newCtx = resizedCanvas.getContext('2d');
    if (!newCtx) {
      throw new ImageProcessError('리사이징 결과 캔버스의 컨텍스트를 가져올 수 없습니다', 'CANVAS_CREATION_FAILED');
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

  // 🗑️ Phase 3: 제거된 메서드들
  // - drawImageWithFit() → OnehotRenderer.render()로 대체
  // - calculateFitDrawParams() → OnehotRenderer가 내부적으로 처리

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
