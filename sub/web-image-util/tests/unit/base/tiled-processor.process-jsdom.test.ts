import { describe, expect, it, vi } from 'vitest';
import { TiledProcessor, type TileInfo } from '../../../src/base/tiled-processor';
import { createDrawableImage } from './tiled-processor.helpers';

describe('TiledProcessor.processInTiles', () => {
  it('소스 이미지 크기의 캔버스를 반환한다', async () => {
    const img = createDrawableImage(16, 16);
    const result = await TiledProcessor.processInTiles(
      img,
      (tileCanvas) => tileCanvas, // no-op: 타일을 그대로 반환
      { tileSize: 8, overlapSize: 0, enableMemoryMonitoring: false }
    );
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });

  it('onProgress 콜백이 타일 수만큼 호출된다', async () => {
    const img = createDrawableImage(16, 16);
    const progressCalls: [number, number][] = [];

    await TiledProcessor.processInTiles(img, (tileCanvas) => tileCanvas, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
      onProgress: (completed, total) => progressCalls.push([completed, total]),
    });

    // 16×16, tileSize=8, overlapSize=0 → 4 타일
    expect(progressCalls).toHaveLength(4);
    expect(progressCalls[progressCalls.length - 1]).toEqual([4, 4]);
  });

  it('비동기 프로세서도 지원한다', async () => {
    const img = createDrawableImage(8, 8);
    const result = await TiledProcessor.processInTiles(
      img,
      async (tileCanvas) => {
        await Promise.resolve();
        return tileCanvas;
      },
      { tileSize: 8, overlapSize: 0, enableMemoryMonitoring: false }
    );
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('processor가 타일 수만큼 (HTMLCanvasElement, TileInfo) 인자로 호출된다', async () => {
    // 16×16, tileSize=8, overlapSize=0 → 4 타일
    const img = createDrawableImage(16, 16);
    const mockProcessor = vi.fn((tileCanvas: HTMLCanvasElement, _tileInfo: TileInfo) => tileCanvas);

    await TiledProcessor.processInTiles(img, mockProcessor, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
    });

    // 호출 횟수가 타일 수와 일치해야 한다
    expect(mockProcessor).toHaveBeenCalledTimes(4);

    // 각 호출의 첫 번째 인자가 HTMLCanvasElement이어야 한다
    for (const [tileCanvas] of mockProcessor.mock.calls) {
      expect(tileCanvas).toBeInstanceOf(HTMLCanvasElement);
    }

    // 두 번째 인자(TileInfo)의 좌표가 기대 타일 좌표와 일치해야 한다
    const tileInfos = mockProcessor.mock.calls.map((call) => call[1] as TileInfo);
    expect(tileInfos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceX: 0, sourceY: 0, sourceWidth: 8, sourceHeight: 8 }),
        expect.objectContaining({ sourceX: 8, sourceY: 0, sourceWidth: 8, sourceHeight: 8 }),
        expect.objectContaining({ sourceX: 0, sourceY: 8, sourceWidth: 8, sourceHeight: 8 }),
        expect.objectContaining({ sourceX: 8, sourceY: 8, sourceWidth: 8, sourceHeight: 8 }),
      ])
    );
  });
});
