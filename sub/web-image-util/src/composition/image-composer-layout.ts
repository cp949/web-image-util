import type { Rectangle } from './position-types';

export type ImageFitMode = 'contain' | 'cover' | 'fill';

export interface ImageLikeSize {
  width: number;
  height: number;
}

export interface GridMetrics {
  maxImages: number;
  cellWidth: number;
  cellHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface GridMetricOptions {
  rows: number;
  cols: number;
  spacing: number;
}

export interface FittedSize extends Rectangle {}

export function calculateFitSize(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
  fit: ImageFitMode
): FittedSize {
  let width = imageWidth;
  let height = imageHeight;
  let x = 0;
  let y = 0;

  switch (fit) {
    case 'contain': {
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

    case 'fill':
      width = containerWidth;
      height = containerHeight;
      break;
  }

  return { x, y, width, height };
}

export function calculateGridMetrics(images: ImageLikeSize[], options: GridMetricOptions): GridMetrics {
  const { rows, cols, spacing } = options;
  const cellWidth = Math.max(...images.map((img) => img.width));
  const cellHeight = Math.max(...images.map((img) => img.height));

  return {
    maxImages: Math.min(images.length, rows * cols),
    cellWidth,
    cellHeight,
    canvasWidth: cols * cellWidth + (cols + 1) * spacing,
    canvasHeight: rows * cellHeight + (rows + 1) * spacing,
  };
}

export function rectanglesOverlap(rect: Rectangle, areas: Rectangle[]): boolean {
  return areas.some(
    (area) =>
      rect.x < area.x + area.width &&
      rect.x + rect.width > area.x &&
      rect.y < area.y + area.height &&
      rect.y + rect.height > area.y
  );
}
