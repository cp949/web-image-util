import { describe, expect, it } from 'vitest';
import { TiledProcessor } from '../../../src/base/tiled-processor';
import { createDrawableImage } from './tiled-processor.helpers';

describe('TiledProcessor.resizeInTiles', () => {
  it('대상 크기의 캔버스를 반환한다', async () => {
    const img = createDrawableImage(16, 16);
    const result = await TiledProcessor.resizeInTiles(img, 32, 24, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
    });
    expect(result.width).toBe(32);
    expect(result.height).toBe(24);
  });

  it('소스와 같은 크기로도 동작한다', async () => {
    const img = createDrawableImage(8, 8);
    const result = await TiledProcessor.resizeInTiles(img, 8, 8, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
    });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('onProgress 콜백이 호출된다', async () => {
    const img = createDrawableImage(16, 16);
    const progressCalls: [number, number][] = [];

    await TiledProcessor.resizeInTiles(img, 16, 16, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
      onProgress: (completed, total) => progressCalls.push([completed, total]),
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    // 마지막 콜백에서 completed === total이어야 한다
    const last = progressCalls[progressCalls.length - 1];
    expect(last[0]).toBe(last[1]);
  });

  it('16×16 이미지를 tileSize=8로 처리하면 4번의 진행 콜백이 발생한다', async () => {
    const img = createDrawableImage(16, 16);
    let callCount = 0;

    await TiledProcessor.resizeInTiles(img, 16, 16, {
      tileSize: 8,
      overlapSize: 0,
      maxConcurrency: 1,
      enableMemoryMonitoring: false,
      onProgress: () => callCount++,
    });

    expect(callCount).toBe(4);
  });

  it('quality=fast 옵션도 올바른 크기의 캔버스를 반환한다', async () => {
    const img = createDrawableImage(8, 8);
    const result = await TiledProcessor.resizeInTiles(img, 16, 16, {
      tileSize: 8,
      overlapSize: 0,
      quality: 'fast',
      enableMemoryMonitoring: false,
    });
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });
});
