import { withManagedCanvas } from './canvas-utils';
import { createImageError } from './error-helpers';

/**
 * Tile processing options
 */
export interface TiledProcessingOptions {
  tileSize?: number;
  overlapSize?: number;
  quality?: 'fast' | 'high';
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
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Input validation
    this.validateInputs(img, targetWidth, targetHeight, opts);

    // Calculate scale
    const scaleX = targetWidth / img.width;
    const scaleY = targetHeight / img.height;

    // Generate tile plan
    const tiles = this.generateTilePlan(
      img.width,
      img.height,
      targetWidth,
      targetHeight,
      opts.tileSize,
      opts.overlapSize
    );

    return await withManagedCanvas(targetWidth, targetHeight, async (resultCanvas, resultCtx) => {
      // High-quality rendering settings
      if (opts.quality === 'high') {
        resultCtx.imageSmoothingEnabled = true;
        resultCtx.imageSmoothingQuality = 'high';
      }

      // Process tiles
      await this.processTiles(img, tiles, scaleX, scaleY, resultCtx, opts);

      return resultCanvas;
    });
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
    const chunks = this.chunkArray(tiles, opts.maxConcurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (tile) => {
        try {
          await this.processSingleTile(img, tile, resultCtx, opts.quality);
          completedTiles++;
          opts.onProgress?.(completedTiles, totalTiles);
        } catch (error) {
          throw createImageError('RESIZE_FAILED', error as Error, {
            debug: { stage: 'tile processing', x: tile.sourceX, y: tile.sourceY },
          });
        }
      });

      await Promise.all(chunkPromises);

      // Simple memory cleanup after chunk processing
      if (opts.enableMemoryMonitoring && typeof global !== 'undefined' && global.gc) {
        global.gc();
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
    quality: 'fast' | 'high'
  ): Promise<void> {
    await withManagedCanvas(tile.width, tile.height, (tileCanvas, tileCtx) => {
      // Tile Canvas setup
      if (quality === 'high') {
        tileCtx.imageSmoothingEnabled = true;
        tileCtx.imageSmoothingQuality = 'high';
      } else {
        tileCtx.imageSmoothingEnabled = false;
      }

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

      return tileCanvas;
    });
  }

  /**
   * Apply custom processing per tile
   *
   * @param img - Source image
   * @param processor - Function to process each tile
   * @param options - Processing options
   * @returns Processed Canvas
   */
  static async processInTiles<T>(
    img: HTMLImageElement,
    processor: (tileCanvas: HTMLCanvasElement, tileInfo: TileInfo) => Promise<HTMLCanvasElement> | HTMLCanvasElement,
    options: TiledProcessingOptions = {}
  ): Promise<HTMLCanvasElement> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const { width: imgWidth, height: imgHeight } = img;

    // Generate tile information
    const tiles = this.generateSimpleTilePlan(imgWidth, imgHeight, opts.tileSize, opts.overlapSize);

    return withManagedCanvas(imgWidth, imgHeight, async (resultCanvas, resultCtx) => {
      let processedTiles = 0;
      const totalTiles = tiles.length;

      // Process each tile
      for (const tile of tiles) {
        // Extract tile
        const extractedTile = await withManagedCanvas(tile.sourceWidth, tile.sourceHeight, (tileCanvas, tileCtx) => {
          tileCtx.drawImage(
            img,
            tile.sourceX,
            tile.sourceY,
            tile.sourceWidth,
            tile.sourceHeight,
            0,
            0,
            tile.sourceWidth,
            tile.sourceHeight
          );
          return tileCanvas;
        });

        // Apply custom processor
        const processedTile = await processor(extractedTile, tile);

        // Merge to result
        resultCtx.drawImage(processedTile, tile.sourceX, tile.sourceY);

        // Memory cleanup
        extractedTile.width = 0;
        extractedTile.height = 0;
        if (processedTile !== extractedTile) {
          processedTile.width = 0;
          processedTile.height = 0;
        }

        // Update progress
        processedTiles++;
        opts.onProgress?.(processedTiles, totalTiles);
      }

      return resultCanvas;
    });
  }

  /**
   * Generate simple tile plan (no resizing)
   * @private
   */
  private static generateSimpleTilePlan(
    width: number,
    height: number,
    tileSize: number,
    overlapSize: number
  ): TileInfo[] {
    const tiles: TileInfo[] = [];

    for (let y = 0; y < height; y += tileSize - overlapSize) {
      for (let x = 0; x < width; x += tileSize - overlapSize) {
        const tileWidth = Math.min(tileSize, width - x);
        const tileHeight = Math.min(tileSize, height - y);

        tiles.push({
          x,
          y,
          width: tileWidth,
          height: tileHeight,
          sourceX: x,
          sourceY: y,
          sourceWidth: tileWidth,
          sourceHeight: tileHeight,
        });
      }
    }

    return tiles;
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
      throw createImageError('INVALID_SOURCE', new Error('Invalid source image'));
    }

    if (targetWidth <= 0 || targetHeight <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid target dimensions'), {
        dimensions: { width: targetWidth, height: targetHeight },
      });
    }

    if (opts.tileSize <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid tile size'), { debug: { tileSize: opts.tileSize } });
    }

    if (opts.overlapSize < 0 || opts.overlapSize >= opts.tileSize) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid overlap size'), {
        debug: { overlapSize: opts.overlapSize },
      });
    }

    if (opts.maxConcurrency <= 0) {
      throw createImageError('RESIZE_FAILED', new Error('Invalid max concurrency'), {
        debug: { maxConcurrency: opts.maxConcurrency },
      });
    }
  }

  /**
   * Calculate estimated tile processing time
   *
   * @param img - Source image
   * @param targetWidth - Target width
   * @param targetHeight - Target height
   * @param tileSize - Tile size
   * @returns Estimated processing time information
   */
  static estimateProcessingTime(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    tileSize: number = 1024
  ): {
    estimatedSeconds: number;
    tileCount: number;
    memoryUsageMB: number;
  } {
    const tiles = this.generateTilePlan(img.width, img.height, targetWidth, targetHeight, tileSize, 0);

    // Average processing time per tile (empirical value)
    const timePerTile = 0.1; // seconds
    const estimatedSeconds = tiles.length * timePerTile;

    // Memory usage per tile
    const maxTilePixels = tileSize * tileSize;
    const memoryPerTileMB = (maxTilePixels * 4) / (1024 * 1024); // RGBA 4 bytes

    return {
      estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
      tileCount: tiles.length,
      memoryUsageMB: Math.round(memoryPerTileMB * 100) / 100,
    };
  }

  /**
   * Recommend optimal tile size
   *
   * @param img - Source image
   * @param maxMemoryMB - Maximum memory usage (MB)
   * @returns Recommended tile size
   */
  static recommendTileSize(img: HTMLImageElement, maxMemoryMB: number = 64): number {
    const maxPixelsPerTile = (maxMemoryMB * 1024 * 1024) / 4; // RGBA 4 bytes
    const maxTileSize = Math.floor(Math.sqrt(maxPixelsPerTile));

    // Limit to practical range
    const minSize = 256;
    const maxSize = 2048;

    const recommendedSize = Math.max(minSize, Math.min(maxSize, maxTileSize));

    // Adjust to nearest power of 2 for processing efficiency
    const powerOfTwo = Math.pow(2, Math.round(Math.log2(recommendedSize)));

    return Math.max(minSize, Math.min(maxSize, powerOfTwo));
  }

  /**
   * Assess suitability for tile-based processing
   *
   * @param img - Image to assess
   * @param tileSize - Tile size to use
   * @returns Suitability assessment result
   */
  static assessTiledProcessingSuitability(
    img: HTMLImageElement,
    tileSize: number = 1024
  ): {
    suitable: boolean;
    reasons: string[];
    estimatedTiles: number;
    estimatedMemoryMB: number;
  } {
    const reasons: string[] = [];
    const tiles = this.generateSimpleTilePlan(img.width, img.height, tileSize, 0);
    const estimatedMemoryMB = (tileSize * tileSize * 4) / (1024 * 1024);

    let suitable = true;

    // Image size check
    const megaPixels = (img.width * img.height) / (1024 * 1024);
    if (megaPixels < 4) {
      suitable = false;
      reasons.push('Image is too small for efficient tile processing.');
    }

    // Tile count check
    if (tiles.length < 4) {
      suitable = false;
      reasons.push('Too few tiles may result in high overhead.');
    }

    // Memory efficiency check
    if (estimatedMemoryMB > 128) {
      reasons.push('High memory usage is expected.');
    }

    if (suitable) {
      reasons.push('Suitable for tile-based processing.');
    }

    return {
      suitable,
      reasons,
      estimatedTiles: tiles.length,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
    };
  }
}
