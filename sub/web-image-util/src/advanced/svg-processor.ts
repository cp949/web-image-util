/**
 * SVG 전용 고급 프로세서
 * 품질별 스케일링과 다운샘플링을 통한 최적 렌더링 시스템
 */

import { setupHighQualityCanvas } from '../base/canvas-utils';
import { extractSvgDimensions, setSvgDimensions } from '../utils/svg-dimensions';
import type { QualityLevel } from '../core/svg-complexity-analyzer';
import { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';

/** SVG 처리 옵션 */
export interface SvgProcessingOptions {
  /** 품질 레벨 또는 자동 선택 */
  quality: QualityLevel | 'auto';
  /** 출력 이미지 포맷 */
  format: 'jpeg' | 'png' | 'webp';
  /** 목표 너비 (픽셀) */
  targetWidth: number;
  /** 목표 높이 (픽셀) */
  targetHeight: number;
  /** 리사이징 fit 모드 */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  /** JPEG 품질 (0.1 ~ 1.0) */
  jpegQuality?: number;
  /** 투명도 보존 여부 */
  preserveTransparency?: boolean;
  /** 배경색 (투명도 미보존 시) */
  backgroundColor?: string;
}

/** SVG 처리 결과 */
export interface SvgProcessingResult {
  /** 생성된 이미지 Blob */
  blob: Blob;
  /** 실제 적용된 품질 레벨 */
  actualQuality: QualityLevel;
  /** 처리 시간 (밀리초) */
  processingTimeMs: number;
  /** 추정 메모리 사용량 (MB) */
  memorySizeMB: number;
  /** 적용된 스케일링 팩터 */
  scaleFactor: number;
}

/**
 * SVG 전용 고급 프로세서 클래스
 * 복잡도 기반 자동 품질 선택 및 고해상도 렌더링 지원
 */
export class SVGProcessor {
  /** 품질 레벨별 스케일링 팩터 맵 */
  private static readonly QUALITY_SCALE_MAP = {
    low: 1,     // 1x - 원본 해상도
    medium: 2,  // 2x - 고해상도
    high: 3,    // 3x - 높은 품질
    ultra: 4    // 4x - 최고 품질
  } as const;

  /**
   * SVG를 지정된 품질로 처리하여 이미지로 변환
   *
   * @param svgString SVG XML 문자열
   * @param options 처리 옵션
   * @returns 처리 결과 (이미지 Blob 포함)
   */
  static async processWithQuality(
    svgString: string,
    options: SvgProcessingOptions
  ): Promise<SvgProcessingResult> {
    const startTime = performance.now();

    try {
      // Node.js 환경 체크 - 실제 브라우저 API 존재 여부 확인
      if (typeof process !== 'undefined' && process.versions?.node) {
        throw new Error('SVGProcessor는 브라우저 환경에서만 사용할 수 있습니다. Node.js 환경에서는 기본 SourceConverter를 사용해주세요.');
      }

      // 1. 품질 레벨 결정 (auto인 경우 자동 분석)
      const actualQuality = this.determineActualQuality(svgString, options.quality);
      const scaleFactor = this.QUALITY_SCALE_MAP[actualQuality];

      // 2. 고해상도 렌더링 수행
      const blob = await this.renderSvgToBlob(svgString, {
        ...options,
        quality: actualQuality,
        scaleFactor
      });

      // 3. 성능 메트릭 수집
      const processingTime = performance.now() - startTime;
      const memorySize = this.estimateMemoryUsage(
        options.targetWidth * scaleFactor,
        options.targetHeight * scaleFactor
      );

      return {
        blob,
        actualQuality,
        processingTimeMs: processingTime,
        memorySizeMB: memorySize,
        scaleFactor
      };

    } catch (error) {
      throw new Error(`SVG 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * 요청된 품질 또는 자동 분석을 통해 실제 품질 레벨 결정
   */
  private static determineActualQuality(
    svgString: string,
    requestedQuality: QualityLevel | 'auto'
  ): QualityLevel {
    if (requestedQuality !== 'auto') {
      return requestedQuality;
    }

    // 자동 품질 결정 - 복잡도 분석 기반
    const analysis = analyzeSvgComplexity(svgString);
    return analysis.recommendedQuality;
  }

  /**
   * SVG를 고해상도로 렌더링하여 Blob으로 변환
   */
  private static async renderSvgToBlob(
    svgString: string,
    options: SvgProcessingOptions & { scaleFactor: number }
  ): Promise<Blob> {
    // 1. 원본 SVG 크기 추출 (fit 계산용)
    const originalDimensions = extractSvgDimensions(svgString);
    const originalWidth = originalDimensions.width || 300;
    const originalHeight = originalDimensions.height || 200;

    // 2. 렌더링 크기 계산 (고해상도)
    const renderWidth = options.targetWidth * options.scaleFactor;
    const renderHeight = options.targetHeight * options.scaleFactor;

    // 3. SVG 크기 설정 (정확한 렌더링을 위해)
    const enhancedSvg = setSvgDimensions(svgString, renderWidth, renderHeight);

    // 4. 고품질 Canvas 생성
    const { canvas, context } = setupHighQualityCanvas(
      options.targetWidth,
      options.targetHeight,
      {
        scale: options.scaleFactor,
        imageSmoothingQuality: 'high'
      }
    );

    // 5. 배경색 설정 (투명도 처리)
    if (!options.preserveTransparency) {
      // 투명도를 보존하지 않는 경우 배경색 설정 (기본: 흰색)
      context.fillStyle = options.backgroundColor || '#ffffff';
      context.fillRect(0, 0, options.targetWidth, options.targetHeight);
    } else {
      // 투명도를 보존하는 경우 Canvas를 투명하게 초기화
      context.clearRect(0, 0, options.targetWidth, options.targetHeight);
    }

    // 6. SVG 이미지 로드 및 그리기
    console.log('🔍 SVG 로딩 시작:', {
      enhancedSvgLength: enhancedSvg.length,
      enhancedSvgPrefix: enhancedSvg.substring(0, 100) + '...'
    });

    const img = await this.loadSvgAsImage(enhancedSvg);

    console.log('✅ SVG 이미지 로드 완료:', {
      originalSize: `${originalWidth}x${originalHeight}`,
      imgSize: `${img.width}x${img.height}`,
      naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
      ratio: `${(img.width/originalWidth).toFixed(2)}x${(img.height/originalHeight).toFixed(2)}`,
      targetSize: `${options.targetWidth}x${options.targetHeight}`,
      fitMode: options.fit || 'cover'
    });

    // fit 모드에 따른 그리기 좌표 계산 (원본 크기 사용!)
    const rawDrawParams = this.calculateDrawParams(
      originalWidth,
      originalHeight,
      options.targetWidth,
      options.targetHeight,
      options.fit || 'cover'
    );

    // 실제 이미지 크기에 맞게 소스 좌표만 스케일링 (dest는 그대로)
    const scaleX = img.width / originalWidth;
    const scaleY = img.height / originalHeight;

    const drawParams = {
      sourceX: rawDrawParams.sourceX * scaleX,
      sourceY: rawDrawParams.sourceY * scaleY,
      sourceWidth: rawDrawParams.sourceWidth * scaleX,
      sourceHeight: rawDrawParams.sourceHeight * scaleY,
      destX: rawDrawParams.destX,
      destY: rawDrawParams.destY,
      destWidth: rawDrawParams.destWidth,
      destHeight: rawDrawParams.destHeight,
    };

    console.log('🔧 좌표 스케일링:', {
      originalSize: `${originalWidth}x${originalHeight}`,
      actualImgSize: `${img.width}x${img.height}`,
      scaleFactors: `x${scaleX.toFixed(2)} y${scaleY.toFixed(2)}`,
      beforeScale: `src(${rawDrawParams.sourceX},${rawDrawParams.sourceY},${rawDrawParams.sourceWidth},${rawDrawParams.sourceHeight})`,
      afterScale: `src(${drawParams.sourceX},${drawParams.sourceY},${drawParams.sourceWidth},${drawParams.sourceHeight})`
    });

    // 🔍 DEBUG: SVG fit 모드 적용 디버깅
    console.log(`🎨 ${options.fit?.toUpperCase() || 'COVER'} drawParams:`,
      `ORIGINAL(${originalWidth}x${originalHeight})`,
      `src(${drawParams.sourceX},${drawParams.sourceY},${drawParams.sourceWidth},${drawParams.sourceHeight})`,
      `→ dest(${drawParams.destX},${drawParams.destY},${drawParams.destWidth},${drawParams.destHeight})`
    );

    if (options.fit === 'cover' || options.fit === 'contain') {
      console.log(`🔍 ${options.fit?.toUpperCase()} 검증:`, {
        originalSize: `${originalWidth}x${originalHeight}`,
        targetSize: `${options.targetWidth}x${options.targetHeight}`,
        isCover: options.fit === 'cover',
        isContain: options.fit === 'contain',
        shouldCrop: options.fit === 'cover' ? 'YES (sourceX/Y ≠ 0)' : 'NO (sourceX/Y = 0)',
        shouldPad: options.fit === 'contain' ? 'YES (destX/Y ≠ 0)' : 'NO (destX/Y = 0)',
        actualSourceCrop: `${drawParams.sourceX !== 0 || drawParams.sourceY !== 0 ? 'CROPPED' : 'FULL_SOURCE'}`,
        actualDestPad: `${drawParams.destX !== 0 || drawParams.destY !== 0 ? 'PADDED' : 'FULL_DEST'}`
      });
    }

    console.log('🎨 drawImage 호출:', {
      imgReady: img.complete,
      imgWidth: img.width,
      imgHeight: img.height,
      sourceRegion: `${drawParams.sourceX},${drawParams.sourceY},${drawParams.sourceWidth},${drawParams.sourceHeight}`,
      destRegion: `${drawParams.destX},${drawParams.destY},${drawParams.destWidth},${drawParams.destHeight}`
    });

    context.drawImage(
      img,
      drawParams.sourceX,
      drawParams.sourceY,
      drawParams.sourceWidth,
      drawParams.sourceHeight,
      drawParams.destX,
      drawParams.destY,
      drawParams.destWidth,
      drawParams.destHeight
    );

    console.log('✅ drawImage 완료');

    // 6. 지정된 포맷으로 Blob 생성
    return this.canvasToBlob(canvas, options);
  }

  /**
   * fit 모드에 따른 drawImage 파라미터 계산
   */
  private static calculateDrawParams(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number,
    fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  ): {
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    destX: number;
    destY: number;
    destWidth: number;
    destHeight: number;
  } {
    switch (fit) {
      case 'fill':
        return {
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: 0,
          destY: 0,
          destWidth: targetWidth,
          destHeight: targetHeight,
        };

      case 'contain': {
        const scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
        const scaledWidth = Math.round(originalWidth * scale);
        const scaledHeight = Math.round(originalHeight * scale);

        const result = {
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: Math.round((targetWidth - scaledWidth) / 2),
          destY: Math.round((targetHeight - scaledHeight) / 2),
          destWidth: scaledWidth,
          destHeight: scaledHeight,
        };

        console.log('🟢 CONTAIN 계산:', {
          original: `${originalWidth}x${originalHeight}`,
          target: `${targetWidth}x${targetHeight}`,
          scale: scale.toFixed(3),
          scaledSize: `${scaledWidth}x${scaledHeight}`,
          padding: `x:${result.destX} y:${result.destY}`,
          result
        });

        return result;
      }

      case 'cover': {
        const scale = Math.max(targetWidth / originalWidth, targetHeight / originalHeight);
        const scaledWidth = Math.round(originalWidth * scale);
        const scaledHeight = Math.round(originalHeight * scale);

        // 크롭할 소스 영역 계산
        const sourceWidth = targetWidth / scale;
        const sourceHeight = targetHeight / scale;
        const sourceX = Math.round((originalWidth - sourceWidth) / 2);
        const sourceY = Math.round((originalHeight - sourceHeight) / 2);

        const result = {
          sourceX: Math.max(0, sourceX),
          sourceY: Math.max(0, sourceY),
          sourceWidth: Math.min(sourceWidth, originalWidth),
          sourceHeight: Math.min(sourceHeight, originalHeight),
          destX: 0,
          destY: 0,
          destWidth: targetWidth,
          destHeight: targetHeight,
        };

        console.log('🔴 COVER 계산:', {
          scale: scale.toFixed(3),
          sourceRegion: `${result.sourceWidth.toFixed(1)}x${result.sourceHeight.toFixed(1)}`,
          cropOffset: `x:${result.sourceX} y:${result.sourceY}`,
          result
        });

        return result;
      }

      case 'inside': {
        const scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight, 1);
        const scaledWidth = Math.round(originalWidth * scale);
        const scaledHeight = Math.round(originalHeight * scale);

        return {
          sourceX: 0,
          sourceY: 0,
          sourceWidth: originalWidth,
          sourceHeight: originalHeight,
          destX: Math.round((targetWidth - scaledWidth) / 2),
          destY: Math.round((targetHeight - scaledHeight) / 2),
          destWidth: scaledWidth,
          destHeight: scaledHeight,
        };
      }

      case 'outside': {
        const scale = Math.max(targetWidth / originalWidth, targetHeight / originalHeight, 1);
        const scaledWidth = Math.round(originalWidth * scale);
        const scaledHeight = Math.round(originalHeight * scale);

        // 크롭할 소스 영역 계산
        const sourceWidth = targetWidth / scale;
        const sourceHeight = targetHeight / scale;
        const sourceX = Math.round((originalWidth - sourceWidth) / 2);
        const sourceY = Math.round((originalHeight - sourceHeight) / 2);

        return {
          sourceX: Math.max(0, sourceX),
          sourceY: Math.max(0, sourceY),
          sourceWidth: Math.min(sourceWidth, originalWidth),
          sourceHeight: Math.min(sourceHeight, originalHeight),
          destX: 0,
          destY: 0,
          destWidth: targetWidth,
          destHeight: targetHeight,
        };
      }

      default:
        // 기본값은 cover
        return this.calculateDrawParams(originalWidth, originalHeight, targetWidth, targetHeight, 'cover');
    }
  }

  /**
   * SVG 문자열을 HTMLImageElement로 로드
   */
  private static async loadSvgAsImage(svgString: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('SVG 이미지 로드 실패'));

      // Base64 인코딩으로 안전하게 변환
      try {
        const base64 = btoa(unescape(encodeURIComponent(svgString)));
        img.src = `data:image/svg+xml;base64,${base64}`;
      } catch (error) {
        reject(new Error('SVG Base64 인코딩 실패'));
      }
    });
  }

  /**
   * Canvas를 지정된 포맷의 Blob으로 변환
   */
  private static async canvasToBlob(
    canvas: HTMLCanvasElement,
    options: SvgProcessingOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = this.getMimeType(options.format);
      const quality = options.format === 'jpeg' ? options.jpegQuality : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas Blob 생성 실패'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * 포맷 문자열을 MIME 타입으로 변환
   */
  private static getMimeType(format: 'jpeg' | 'png' | 'webp'): string {
    switch (format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  /**
   * 렌더링에 사용될 메모리 크기 추정 (MB 단위)
   */
  private static estimateMemoryUsage(width: number, height: number): number {
    // 4 bytes per pixel (RGBA)
    const pixelCount = width * height;
    const bytesPerPixel = 4;
    const totalBytes = pixelCount * bytesPerPixel;

    // Canvas 임시 메모리 오버헤드 포함 (약 1.5배)
    const overheadFactor = 1.5;

    return (totalBytes * overheadFactor) / (1024 * 1024); // MB 변환
  }

  /**
   * 지원되는 최대 스케일링 팩터 계산
   * 메모리 제한을 고려하여 안전한 범위 내에서 처리
   */
  static getMaxSafeScaleFactor(width: number, height: number): number {
    const maxMemoryMB = 500; // 500MB 제한
    const pixelCount = width * height;
    const bytesPerPixel = 4;

    // 안전한 스케일링 팩터 계산
    const maxScale = Math.sqrt((maxMemoryMB * 1024 * 1024) / (pixelCount * bytesPerPixel));

    // 1~4 범위로 제한
    return Math.max(1, Math.min(4, Math.floor(maxScale)));
  }

  /**
   * SVG 처리 옵션 검증
   */
  static validateOptions(options: SvgProcessingOptions): void {
    if (options.targetWidth <= 0 || options.targetHeight <= 0) {
      throw new Error('목표 크기는 0보다 커야 합니다');
    }

    if (options.jpegQuality !== undefined &&
        (options.jpegQuality < 0.1 || options.jpegQuality > 1.0)) {
      throw new Error('JPEG 품질은 0.1~1.0 범위여야 합니다');
    }

    const maxSafeScale = this.getMaxSafeScaleFactor(options.targetWidth, options.targetHeight);
    const requestedScale = options.quality === 'auto' ? 4 : this.QUALITY_SCALE_MAP[options.quality as QualityLevel];

    if (requestedScale > maxSafeScale) {
      throw new Error(`요청된 품질이 메모리 제한을 초과합니다 (최대 ${maxSafeScale}x)`);
    }
  }
}