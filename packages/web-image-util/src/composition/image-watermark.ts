import type { Position, Point, Size } from './position-types';
import { PositionCalculator } from './position-types';

/**
 * 이미지 워터마크 옵션
 */
export interface ImageWatermarkOptions {
  watermarkImage: HTMLImageElement;
  position: Position;
  customPosition?: Point;
  scale?: number; // 0-1, 원본 대비 크기
  opacity?: number; // 0-1
  rotation?: number; // degrees
  margin?: Point;
  blendMode?: GlobalCompositeOperation;
}

/**
 * 이미지 워터마크 클래스
 */
export class ImageWatermark {
  /**
   * 이미지 워터마크 추가
   */
  static addToCanvas(canvas: HTMLCanvasElement, options: ImageWatermarkOptions): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 컨텍스트를 가져올 수 없습니다');

    const {
      watermarkImage,
      position,
      customPosition,
      scale = 1,
      opacity = 1,
      rotation = 0,
      margin = { x: 10, y: 10 },
      blendMode = 'source-over',
    } = options;

    // 워터마크 크기 계산
    const watermarkSize: Size = {
      width: watermarkImage.width * scale,
      height: watermarkImage.height * scale,
    };

    // 위치 계산
    const containerSize: Size = { width: canvas.width, height: canvas.height };
    const watermarkPosition = PositionCalculator.calculatePosition(
      position,
      customPosition || null,
      containerSize,
      watermarkSize,
      margin
    );

    ctx.save();

    // 블렌딩 모드 및 투명도 설정
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = opacity;

    // 회전 설정
    if (rotation !== 0) {
      const centerX = watermarkPosition.x + watermarkSize.width / 2;
      const centerY = watermarkPosition.y + watermarkSize.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // 이미지 그리기
    ctx.drawImage(watermarkImage, watermarkPosition.x, watermarkPosition.y, watermarkSize.width, watermarkSize.height);

    ctx.restore();
    return canvas;
  }

  /**
   * 적응형 크기 조정 (컨테이너 크기에 따라 자동 조정)
   */
  static addWithAdaptiveSize(
    canvas: HTMLCanvasElement,
    options: ImageWatermarkOptions & {
      maxWidthPercent?: number; // 컨테이너 너비의 최대 %
      maxHeightPercent?: number; // 컨테이너 높이의 최대 %
    }
  ): HTMLCanvasElement {
    const {
      watermarkImage,
      maxWidthPercent = 0.2, // 기본 20%
      maxHeightPercent = 0.2,
    } = options;

    const maxWidth = canvas.width * maxWidthPercent;
    const maxHeight = canvas.height * maxHeightPercent;

    // 비율을 유지하면서 최대 크기에 맞춤
    const widthScale = maxWidth / watermarkImage.width;
    const heightScale = maxHeight / watermarkImage.height;
    const adaptiveScale = Math.min(widthScale, heightScale);

    return this.addToCanvas(canvas, {
      ...options,
      scale: adaptiveScale,
    });
  }

  /**
   * 반복 패턴 이미지 워터마크
   */
  static addRepeatingPattern(
    canvas: HTMLCanvasElement,
    options: ImageWatermarkOptions & {
      spacing: { x: number; y: number };
      stagger?: boolean;
    }
  ): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 컨텍스트를 가져올 수 없습니다');

    const {
      watermarkImage,
      scale = 1,
      opacity = 1,
      rotation = 0,
      blendMode = 'source-over',
      spacing,
      stagger = false,
    } = options;

    const watermarkWidth = watermarkImage.width * scale;
    const watermarkHeight = watermarkImage.height * scale;

    ctx.save();
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = opacity;

    let yOffset = 0;
    for (let y = -watermarkHeight; y < canvas.height + watermarkHeight; y += spacing.y) {
      const xOffset = stagger && yOffset % 2 === 1 ? spacing.x / 2 : 0;

      for (let x = -watermarkWidth; x < canvas.width + watermarkWidth; x += spacing.x) {
        ctx.save();

        if (rotation !== 0) {
          const centerX = x + xOffset + watermarkWidth / 2;
          const centerY = y + watermarkHeight / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        ctx.drawImage(watermarkImage, x + xOffset, y, watermarkWidth, watermarkHeight);

        ctx.restore();
      }
      yOffset++;
    }

    ctx.restore();
    return canvas;
  }
}
