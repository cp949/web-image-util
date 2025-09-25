import { withManagedCanvas } from './canvas-utils';
import { createImageError } from './error-helpers';

/**
 * 타일 처리 옵션
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
 * 타일 정보 인터페이스
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
 * 타일 기반 초대용량 이미지 처리기
 * 매우 큰 이미지를 작은 타일로 분할하여 메모리 효율적으로 처리합니다.
 */
export class TiledProcessor {
  private static readonly DEFAULT_OPTIONS: Required<Omit<TiledProcessingOptions, 'onProgress'>> = {
    tileSize: 1024,
    overlapSize: 32,
    quality: 'high',
    maxConcurrency: 2, // 타일 처리는 메모리 집약적이므로 낮은 동시성
    enableMemoryMonitoring: true,
  };

  /**
   * 타일 기반으로 이미지 리사이징
   *
   * @param img - 소스 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param options - 처리 옵션
   * @returns 리사이징된 Canvas
   */
  static async resizeInTiles(
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    options: TiledProcessingOptions = {}
  ): Promise<HTMLCanvasElement> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // 입력 검증
    this.validateInputs(img, targetWidth, targetHeight, opts);

    // 스케일 계산
    const scaleX = targetWidth / img.width;
    const scaleY = targetHeight / img.height;

    // 타일 계획 생성
    const tiles = this.generateTilePlan(
      img.width,
      img.height,
      targetWidth,
      targetHeight,
      opts.tileSize,
      opts.overlapSize
    );

    return await withManagedCanvas(targetWidth, targetHeight, async (resultCanvas, resultCtx) => {
      // 고품질 렌더링 설정
      if (opts.quality === 'high') {
        resultCtx.imageSmoothingEnabled = true;
        resultCtx.imageSmoothingQuality = 'high';
      }

      // 타일별 처리
      await this.processTiles(img, tiles, scaleX, scaleY, resultCtx, opts);

      return resultCanvas;
    });
  }

  /**
   * 타일 계획 생성
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

    // 소스 이미지를 타일로 분할
    for (let sourceY = 0; sourceY < sourceHeight; sourceY += tileSize - overlapSize) {
      for (let sourceX = 0; sourceX < sourceWidth; sourceX += tileSize - overlapSize) {
        const sourceTileWidth = Math.min(tileSize, sourceWidth - sourceX);
        const sourceTileHeight = Math.min(tileSize, sourceHeight - sourceY);

        // 타겟 좌표 계산
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
   * 타일들을 처리
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

    // 타일을 청크로 나누어 병렬 처리
    const chunks = this.chunkArray(tiles, opts.maxConcurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (tile) => {
        try {
          await this.processSingleTile(img, tile, resultCtx, opts.quality);
          completedTiles++;
          opts.onProgress?.(completedTiles, totalTiles);
        } catch (error) {
          throw createImageError('RESIZE_FAILED', error as Error, {
            debug: { stage: '타일 처리', x: tile.sourceX, y: tile.sourceY },
          });
        }
      });

      await Promise.all(chunkPromises);

      // 청크 처리 후 간단한 메모리 정리
      if (opts.enableMemoryMonitoring && typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    }
  }

  /**
   * 단일 타일 처리
   * @private
   */
  private static async processSingleTile(
    img: HTMLImageElement,
    tile: TileInfo,
    resultCtx: CanvasRenderingContext2D,
    quality: 'fast' | 'high'
  ): Promise<void> {
    await withManagedCanvas(tile.width, tile.height, (tileCanvas, tileCtx) => {
      // 타일 Canvas 설정
      if (quality === 'high') {
        tileCtx.imageSmoothingEnabled = true;
        tileCtx.imageSmoothingQuality = 'high';
      } else {
        tileCtx.imageSmoothingEnabled = false;
      }

      // 소스 이미지의 해당 부분을 타일 Canvas에 스케일링하여 그리기
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

      // 처리된 타일을 결과 Canvas에 합성
      resultCtx.drawImage(tileCanvas, tile.x, tile.y);

      return tileCanvas;
    });
  }

  /**
   * 타일 단위로 커스텀 처리 적용
   *
   * @param img - 소스 이미지
   * @param tileSize - 타일 크기
   * @param processor - 각 타일을 처리할 함수
   * @param options - 처리 옵션
   * @returns 처리된 Canvas
   */
  static async processInTiles<T>(
    img: HTMLImageElement,
    processor: (tileCanvas: HTMLCanvasElement, tileInfo: TileInfo) => Promise<HTMLCanvasElement> | HTMLCanvasElement,
    options: TiledProcessingOptions = {}
  ): Promise<HTMLCanvasElement> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const { width: imgWidth, height: imgHeight } = img;

    // 타일 정보 생성
    const tiles = this.generateSimpleTilePlan(imgWidth, imgHeight, opts.tileSize, opts.overlapSize);

    return withManagedCanvas(imgWidth, imgHeight, async (resultCanvas, resultCtx) => {
      let processedTiles = 0;
      const totalTiles = tiles.length;

      // 타일별 처리
      for (const tile of tiles) {
        // 타일 추출
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

        // 커스텀 프로세서 적용
        const processedTile = await processor(extractedTile, tile);

        // 결과에 병합
        resultCtx.drawImage(processedTile, tile.sourceX, tile.sourceY);

        // 메모리 정리
        extractedTile.width = 0;
        extractedTile.height = 0;
        if (processedTile !== extractedTile) {
          processedTile.width = 0;
          processedTile.height = 0;
        }

        // 진행률 업데이트
        processedTiles++;
        opts.onProgress?.(processedTiles, totalTiles);
      }

      return resultCanvas;
    });
  }

  /**
   * 간단한 타일 계획 생성 (리사이징 없음)
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
   * 배열을 청크로 분할
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
   * 입력값 검증
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
   * 타일 처리 예상 시간 계산
   *
   * @param img - 소스 이미지
   * @param targetWidth - 목표 너비
   * @param targetHeight - 목표 높이
   * @param tileSize - 타일 크기
   * @returns 예상 처리 시간 정보
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

    // 타일당 평균 처리 시간 (경험적 값)
    const timePerTile = 0.1; // 초
    const estimatedSeconds = tiles.length * timePerTile;

    // 타일 하나당 메모리 사용량
    const maxTilePixels = tileSize * tileSize;
    const memoryPerTileMB = (maxTilePixels * 4) / (1024 * 1024); // RGBA 4바이트

    return {
      estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
      tileCount: tiles.length,
      memoryUsageMB: Math.round(memoryPerTileMB * 100) / 100,
    };
  }

  /**
   * 최적 타일 크기 추천
   *
   * @param img - 소스 이미지
   * @param maxMemoryMB - 최대 메모리 사용량 (MB)
   * @returns 권장 타일 크기
   */
  static recommendTileSize(img: HTMLImageElement, maxMemoryMB: number = 64): number {
    const maxPixelsPerTile = (maxMemoryMB * 1024 * 1024) / 4; // RGBA 4바이트
    const maxTileSize = Math.floor(Math.sqrt(maxPixelsPerTile));

    // 실용적인 범위로 제한
    const minSize = 256;
    const maxSize = 2048;

    const recommendedSize = Math.max(minSize, Math.min(maxSize, maxTileSize));

    // 2의 거듭제곱에 가까운 값으로 조정 (처리 효율성)
    const powerOfTwo = Math.pow(2, Math.round(Math.log2(recommendedSize)));

    return Math.max(minSize, Math.min(maxSize, powerOfTwo));
  }

  /**
   * 타일 기반 처리 적합성 검사
   *
   * @param img - 검사할 이미지
   * @param tileSize - 사용할 타일 크기
   * @returns 적합성 검사 결과
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

    // 이미지 크기 검사
    const megaPixels = (img.width * img.height) / (1024 * 1024);
    if (megaPixels < 4) {
      suitable = false;
      reasons.push('이미지가 너무 작아 타일 처리가 비효율적입니다.');
    }

    // 타일 수 검사
    if (tiles.length < 4) {
      suitable = false;
      reasons.push('타일 수가 너무 적어 오버헤드가 클 수 있습니다.');
    }

    // 메모리 효율성 검사
    if (estimatedMemoryMB > 128) {
      reasons.push('높은 메모리 사용량이 예상됩니다.');
    }

    if (suitable) {
      reasons.push('타일 기반 처리에 적합합니다.');
    }

    return {
      suitable,
      reasons,
      estimatedTiles: tiles.length,
      estimatedMemoryMB: Math.round(estimatedMemoryMB * 100) / 100,
    };
  }
}
