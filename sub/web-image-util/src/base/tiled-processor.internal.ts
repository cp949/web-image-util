import { requestMemoryRelief } from '../utils/browser-capabilities/index';
import { leaseCanvas } from './canvas-lease.internal';
import { applySmoothing, createOwnedCanvas, type SmoothingQuality } from './canvas-utils.internal';
import { createImageError } from './error-helpers';

/**
 * Tile processing options
 */
export interface TiledProcessingOptions {
  tileSize?: number;
  overlapSize?: number;
  quality?: SmoothingQuality;
  maxConcurrency?: number;
  onProgress?: (completed: number, total: number) => void;
  enableMemoryMonitoring?: boolean;
}

/**
 * Tile information interface
 */
export interface TileInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Tile-based ultra-large image processor
 * Processes very large images memory-efficiently by dividing them into small tiles.
 */
export class TiledProcessor {
  private static readonly DEFAULT_OPTIONS: Required<Omit<TiledProcessingOptions, 'onProgress'>> = {
    tileSize: 1024,
    overlapSize: 32,
    quality: 'high',
    maxConcurrency: 2, // Low concurrency since tile processing is memory intensive
    enableMemoryMonitoring: true,
  };

  /**
   * Tile-based image resizing
   *
   * @param img - Source image
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param options - Processing options
   * @returns Resized Canvas
   */
  static async resizeInTiles(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: TiledProcessingOptions = {}
  ): Promise<HTMLCanvasElement> {
    const opts = { ...TiledProcessor.DEFAULT_OPTIONS, ...options };

    // Input validation
    TiledProcessor.validateInputs(img, targetWidth, targetHeight, opts);

    // Calculate scale
    const scaleX = targetWidth / img.width;
    const scaleY = targetHeight / img.height;

    // Generate tile plan
    const tiles = TiledProcessor.generateTilePlan(
      img.width,
      img.height,
      targetWidth,
      targetHeight,
      opts.tileSize,
      opts.overlapSize
    );

    // 결과 canvas는 호출자 소유 — pool을 거치지 않는다 (타일 중간 canvas만 pool 사용)
    const { canvas: resultCanvas, ctx: resultCtx } = createOwnedCanvas(targetWidth, targetHeight);
    applySmoothing(resultCtx, opts.quality);

    await TiledProcessor.processTiles(img, tiles, scaleX, scaleY, resultCtx, opts);

    return resultCanvas;
  }

  /**
   * Generate tile plan
   * @private
   */
  private static generateTilePlan(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    tileSize: number,
    overlapSize: number
  ): TileInfo[] {
    const tiles: TileInfo[] = [];
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;

    // Divide source image into tiles
    for (let sourceY = 0; sourceY < sourceHeight; sourceY += tileSize - overlapSize) {
      for (let sourceX = 0; sourceX < sourceWidth; sourceX += tileSize - overlapSize) {
        const sourceTileWidth = Math.min(tileSize, sourceWidth - sourceX);
        const sourceTileHeight = Math.min(tileSize, sourceHeight - sourceY);

        // Calculate target coordinates
        const targetX = Math.floor(sourceX * scaleX);
        const targetY = Math.floor(sourceY * scaleY);
        const targetTileWidth = Math.ceil(sourceTileWidth * scaleX);
        const targetTileHeight = Math.ceil(sourceTileHeight * scaleY);

        tiles.push({
          x: targetX,
          y: targetY,
          width: targetTileWidth,
          height: targetTileHeight,
          sourceX,
          sourceY,
          sourceWidth: sourceTileWidth,
          sourceHeight: sourceTileHeight,
        });
      }
    }

    return tiles;
  }

  /**
   * Process tiles
   * @private
   */
  private static async processTiles(
    img: HTMLImageElement,
    tiles: TileInfo[],
    scaleX: number,
    scaleY: number,
    resultCtx: CanvasRenderingContext2D,
    opts: Required<Omit<TiledProcessingOptions, 'onProgress'>> & {
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<void> {
    const totalTiles = tiles.length;
    let completedTiles = 0;

    // Divide tiles into chunks for parallel processing
    const chunks = TiledProcessor.chunkArray(tiles, opts.maxConcurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (tile) => {
        try {
          await TiledProcessor.processSingleTile(img, tile, resultCtx, opts.quality);
          completedTiles++;
          opts.onProgress?.(completedTiles, totalTiles);
        } catch (error) {
          throw createImageError('RESIZE_FAILED', {
            cause: error,
            context: { debug: { stage: 'tile processing', x: tile.sourceX, y: tile.sourceY } },
          });
        }
      });

      await Promise.all(chunkPromises);

      // Simple memory cleanup after chunk processing
      if (opts.enableMemoryMonitoring) {
        requestMemoryRelief();
      }
    }
  }

  /**
   * Process single tile
   * @private
   */
  private static async processSingleTile(
    img: HTMLImageElement,
    tile: TileInfo,
    resultCtx: CanvasRenderingContext2D,
    quality: SmoothingQuality
  ): Promise<void> {
    // 타일 canvas는 pool 임대 — 결과 canvas에 합성한 뒤 즉시 pool로 돌아간다
    await leaseCanvas(tile.width, tile.height).consume((tileCanvas) => {
      const tileCtx = tileCanvas.getContext('2d');
      if (!tileCtx) {
        throw createImageError('CANVAS_CREATION_FAILED', {
          cause: new Error('Failed to create CanvasRenderingContext2D'),
        });
      }

      // 타일 canvas 스무딩 설정
      applySmoothing(tileCtx, quality);

      // Draw corresponding part of source image to tile Canvas with scaling
      tileCtx.drawImage(
        img,
        tile.sourceX,
        tile.sourceY,
        tile.sourceWidth,
        tile.sourceHeight,
        0,
        0,
        tile.width,
        tile.height
      );

      // Composite processed tile to result Canvas
      resultCtx.drawImage(tileCanvas, tile.x, tile.y);
      // 임대 canvas는 콜백 밖으로 내보내지 않는다 — 여기서 소비 완료
    });
  }

  /**
   * Divide array into chunks
   * @private
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Input validation
   * @private
   */
  private static validateInputs(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    opts: Required<Omit<TiledProcessingOptions, 'onProgress'>>
  ): void {
    if (!img || img.width <= 0 || img.height <= 0) {
      throw createImageError('INVALID_SOURCE', { cause: new Error('Invalid source image') });
    }

    if (targetWidth <= 0 || targetHeight <= 0) {
      throw createImageError('RESIZE_FAILED', {
        cause: new Error('Invalid target dimensions'),
        context: { dimensions: { width: targetWidth, height: targetHeight } },
      });
    }

    if (opts.tileSize <= 0) {
      throw createImageError('RESIZE_FAILED', {
        cause: new Error('Invalid tile size'),
        context: { debug: { tileSize: opts.tileSize } },
      });
    }

    if (opts.overlapSize < 0 || opts.overlapSize >= opts.tileSize) {
      throw createImageError('RESIZE_FAILED', {
        cause: new Error('Invalid overlap size'),
        context: { debug: { overlapSize: opts.overlapSize } },
      });
    }

    if (opts.maxConcurrency <= 0) {
      throw createImageError('RESIZE_FAILED', {
        cause: new Error('Invalid max concurrency'),
        context: { debug: { maxConcurrency: opts.maxConcurrency } },
      });
    }
  }
}
