import { describe, expect, it } from 'vitest';
import { TiledProcessor } from '../../../src/base/tiled-processor.internal';
import { ImageProcessError } from '../../../src/types';
import { createMockImage } from './tiled-processor.helpers';

describe('TiledProcessor.resizeInTiles 유효성 검사', () => {
  it('width가 0인 이미지는 INVALID_SOURCE 에러를 던진다', async () => {
    const img = createMockImage(0, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('height가 0인 이미지는 INVALID_SOURCE 에러를 던진다', async () => {
    const img = createMockImage(100, 0);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('targetWidth가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 0, 100)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('targetHeight가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 0)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('tileSize가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { tileSize: 0 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('overlapSize가 음수이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { overlapSize: -1 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('overlapSize >= tileSize이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { tileSize: 8, overlapSize: 8 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('maxConcurrency가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { maxConcurrency: 0 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('유효성 검사 에러는 ImageProcessError 인스턴스이다', async () => {
    const img = createMockImage(0, 0);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100)).rejects.toBeInstanceOf(ImageProcessError);
  });
});
