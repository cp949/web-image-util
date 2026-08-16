/**
 * AutoHighResProcessor.smartResize 표준 경로의 Canvas 안전 치수 전략을 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionDetector } from '../../../src/base/high-res-detector.internal';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { TiledProcessor } from '../../../src/base/tiled-processor.internal';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';
import { createDrawableImage, createMockImage } from './auto-high-res.helpers';

describe('AutoHighResProcessor.smartResize 표준 경로의 Canvas 안전 치수 가드', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저픽셀 + 소스 안전 치수 초과 이미지를 안전한 크기로 tiled 처리한다', async () => {
    const highResSpy = vi.spyOn(HighResolutionManager, 'smartResize');
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(document.createElement('canvas'));

    const maxDim = HighResolutionDetector.getMaxSafeDimension();
    const sourceWidth = maxDim + 1;
    // scaleRatio를 게이트 경계 4 이하로 두면서 최종 Canvas는 안전 치수 이내로 제한한다.
    const targetWidth = Math.ceil(sourceWidth / HighResolutionDetector.DEFAULT_HIGH_RES_SCALE_RATIO_THRESHOLD);
    const img = createMockImage(sourceWidth, 1);
    const result = await AutoHighResProcessor.smartResize(img, targetWidth, 1);

    expect(targetWidth).toBeLessThanOrEqual(maxDim);
    expect(highResSpy).not.toHaveBeenCalled();
    expect(tiledSpy).toHaveBeenCalledWith(img, targetWidth, 1, expect.any(Object));
    expect(result.optimizations.tileProcessing).toBe(true);
  });

  it('소스 가로/세로가 모두 안전 치수 이내면 direct를 쓴다(회귀)', async () => {
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles');
    const img = createDrawableImage(1000, 1000);
    const result = await AutoHighResProcessor.smartResize(img, 400, 300);

    expect(tiledSpy).not.toHaveBeenCalled();
    expect(result.canvas.width).toBe(400);
    expect(result.canvas.height).toBe(300);
  });
});
