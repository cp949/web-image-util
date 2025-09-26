import { withManagedCanvas } from '../base/canvas-utils';
import type { Size, Rectangle } from './position-types';

/**
 * 레이어 정보
 */
export interface Layer {
  image: HTMLImageElement;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity?: number;
  blendMode?: GlobalCompositeOperation;
  rotation?: number;
  visible?: boolean;
}

/**
 * 합성 옵션
 */
export interface CompositionOptions {
  backgroundColor?: string;
  width: number;
  height: number;
}

/**
 * 그리드 레이아웃 옵션
 */
export interface GridLayoutOptions {
  rows: number;
  cols: number;
  spacing?: number;
  backgroundColor?: string;
  fit?: 'letterbox' | 'cover' | 'stretch';
}

/**
 * 이미지 합성 클래스
 */
export class ImageComposer {
  /**
   * 레이어 기반 합성
   */
  static async composeLayers(layers: Layer[], options: CompositionOptions): Promise<HTMLCanvasElement> {
    const { width, height, backgroundColor } = options;

    return withManagedCanvas(width, height, (canvas, ctx) => {
      // 배경색 설정
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      // 레이어별 그리기
      for (const layer of layers) {
        if (layer.visible === false) continue;

        ctx.save();

        // 투명도 및 블렌딩 모드 설정
        ctx.globalAlpha = layer.opacity || 1;
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';

        // 회전 설정
        if (layer.rotation) {
          const centerX = layer.x + (layer.width || layer.image.width) / 2;
          const centerY = layer.y + (layer.height || layer.image.height) / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        // 이미지 그리기
        ctx.drawImage(
          layer.image,
          layer.x,
          layer.y,
          layer.width || layer.image.width,
          layer.height || layer.image.height
        );

        ctx.restore();
      }

      return canvas;
    });
  }

  /**
   * 그리드 레이아웃 합성
   */
  static async composeGrid(images: HTMLImageElement[], options: GridLayoutOptions): Promise<HTMLCanvasElement> {
    const { rows, cols, spacing = 10, backgroundColor = '#ffffff', fit = 'letterbox' } = options;

    if (images.length === 0) throw new Error('이미지가 제공되지 않았습니다');
    if (images.length > rows * cols) {
      console.warn(`이미지가 너무 많습니다 (${images.length}개). 그리드 크기: ${rows}x${cols}`);
    }

    // 그리드 크기 계산
    const maxImages = Math.min(images.length, rows * cols);
    const cellWidth = Math.max(...images.map((img) => img.width));
    const cellHeight = Math.max(...images.map((img) => img.height));

    const canvasWidth = cols * cellWidth + (cols + 1) * spacing;
    const canvasHeight = rows * cellHeight + (rows + 1) * spacing;

    return withManagedCanvas(canvasWidth, canvasHeight, (canvas, ctx) => {
      // 배경 설정
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 이미지 배치
      for (let i = 0; i < maxImages; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const image = images[i];

        const cellX = spacing + col * (cellWidth + spacing);
        const cellY = spacing + row * (cellHeight + spacing);

        // 이미지 크기 조정 계산
        const { x, y, width, height } = this.calculateFitSize(image.width, image.height, cellWidth, cellHeight, fit);

        ctx.drawImage(image, cellX + x, cellY + y, width, height);
      }

      return canvas;
    });
  }

  /**
   * 콜라주 스타일 합성
   */
  static async composeCollage(
    images: HTMLImageElement[],
    canvasSize: Size,
    options: {
      backgroundColor?: string;
      randomRotation?: boolean;
      maxRotation?: number;
      overlap?: boolean;
    } = {}
  ): Promise<HTMLCanvasElement> {
    const { backgroundColor = '#ffffff', randomRotation = true, maxRotation = 15, overlap = true } = options;

    return withManagedCanvas(canvasSize.width, canvasSize.height, (canvas, ctx) => {
      // 배경 설정
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // 이미지들을 랜덤하게 배치
      const usedAreas: Rectangle[] = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];

        // 크기 조정 (캔버스의 15-30% 크기)
        const minScale = 0.15;
        const maxScale = 0.3;
        const scale = minScale + Math.random() * (maxScale - minScale);

        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;

        // 위치 결정
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;

        do {
          x = Math.random() * (canvasSize.width - scaledWidth);
          y = Math.random() * (canvasSize.height - scaledHeight);
          attempts++;
        } while (
          !overlap &&
          attempts < maxAttempts &&
          this.isOverlapping({ x, y, width: scaledWidth, height: scaledHeight }, usedAreas)
        );

        // 영역 기록
        usedAreas.push({ x, y, width: scaledWidth, height: scaledHeight });

        ctx.save();

        // 회전
        if (randomRotation) {
          const rotation = (Math.random() - 0.5) * 2 * maxRotation;
          const centerX = x + scaledWidth / 2;
          const centerY = y + scaledHeight / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        // 그림자 효과
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // 이미지 그리기
        ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

        ctx.restore();
      }

      return canvas;
    });
  }

  /**
   * 이미지 크기 맞춤 계산
   */
  private static calculateFitSize(
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
    fit: 'letterbox' | 'cover' | 'stretch'
  ): { x: number; y: number; width: number; height: number } {
    let width = imageWidth;
    let height = imageHeight;
    let x = 0;
    let y = 0;

    switch (fit) {
      case 'letterbox': {
        const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
        width = imageWidth * scale;
        height = imageHeight * scale;
        x = (containerWidth - width) / 2;
        y = (containerHeight - height) / 2;
        break;
      }

      case 'cover': {
        const scale = Math.max(containerWidth / imageWidth, containerHeight / imageHeight);
        width = imageWidth * scale;
        height = imageHeight * scale;
        x = (containerWidth - width) / 2;
        y = (containerHeight - height) / 2;
        break;
      }

      case 'stretch':
        width = containerWidth;
        height = containerHeight;
        break;
    }

    return { x, y, width, height };
  }

  /**
   * 영역 겹침 검사
   */
  private static isOverlapping(rect: Rectangle, areas: Rectangle[]): boolean {
    return areas.some(
      (area) =>
        rect.x < area.x + area.width &&
        rect.x + rect.width > area.x &&
        rect.y < area.y + area.height &&
        rect.y + rect.height > area.y
    );
  }
}
