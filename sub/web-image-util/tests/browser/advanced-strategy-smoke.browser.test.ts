/**
 * advanced 공개 API에서 실제 tiled/stepped leaf까지 관통한 결과가
 * 브라우저 Canvas에 렌더링되는지 픽셀로 확인한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoHighResProcessor } from '../../src/advanced-index';
import { ProcessingStrategy } from '../../src/base/high-res-detector.internal';
import { SteppedProcessor } from '../../src/base/stepped-processor.internal';
import { TiledProcessor } from '../../src/base/tiled-processor.internal';
import { createTestCanvas } from '../utils/canvas-helper';

const strategyCases = [
  {
    strategy: ProcessingStrategy.TILED,
    spyOnLeaf: () => vi.spyOn(TiledProcessor, 'resizeInTiles'),
  },
  {
    strategy: ProcessingStrategy.STEPPED,
    spyOnLeaf: () => vi.spyOn(SteppedProcessor, 'resizeWithSteps'),
  },
] as const;

describe('advanced 공개 API 브라우저 렌더링 스모크 테스트', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(strategyCases)('$strategy 전략은 실제 leaf 결과를 불투명한 Canvas로 렌더링한다', async ({
    strategy,
    spyOnLeaf,
  }) => {
    const leafSpy = spyOnLeaf();
    const img = createTestCanvas(32, 32, '#3399ff') as unknown as HTMLImageElement;

    const result = await AutoHighResProcessor.smartResize(img, 4, 4, {
      forceStrategy: strategy,
    });

    expect(leafSpy).toHaveBeenCalledOnce();
    expect(result.canvas).toBe(await leafSpy.mock.results[0]?.value);

    const ctx = result.canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    const pixel = ctx?.getImageData(0, 0, 1, 1).data;
    expect(pixel?.[3]).toBeGreaterThan(0);
  });
});
