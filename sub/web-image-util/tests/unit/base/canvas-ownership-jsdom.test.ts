/**
 * Canvas 소유권 회귀 테스트.
 *
 * withManagedCanvas 콜백에서 임대(pool acquire) canvas를 그대로 반환하면
 * finally의 release가 clearRect를 실행해 호출자는 빈 canvas를 받는다.
 * 이 파일은 "반환된 canvas는 호출자 소유이며 픽셀이 보존된다"는 계약을
 * 공개 seam(smartResize)과 대표 내부 경로(composeGrid)에서 고정한다.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { ImageComposer } from '../../../src/composition/image-composer';
import { getCanvasPixelData } from '../../utils/canvas-helper';
import { createTestImageDataUrl } from '../../utils/image-helper';

/**
 * jsdom은 blob URL 이미지 로드를 지원하지 않으므로 data URL로 로드한다.
 */
function createLoadedImage(width: number, height: number, color: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('테스트 이미지 로드 실패'));
    img.src = createTestImageDataUrl(width, height, color);
  });
}

describe('Canvas 소유권 (pool use-after-release 회귀)', () => {
  beforeEach(() => {
    CanvasPool.getInstance().clear();
  });

  it('smartResize 결과 canvas는 그려진 픽셀을 보존한다', async () => {
    const source = await createLoadedImage(64, 64, 'red');

    const result = await HighResolutionManager.smartResize(source, 32, 32);

    expect(result.canvas.width).toBe(32);
    expect(result.canvas.height).toBe(32);
    const pixel = getCanvasPixelData(result.canvas, 16, 16);
    expect(pixel.a).toBeGreaterThan(0);
    expect(pixel.r).toBeGreaterThan(200);
  });

  it('smartResize를 연속 호출해도 이전 결과 canvas를 재사용하지 않는다', async () => {
    const redSource = await createLoadedImage(64, 64, 'red');
    const blueSource = await createLoadedImage(64, 64, 'blue');

    const first = await HighResolutionManager.smartResize(redSource, 32, 32);
    const second = await HighResolutionManager.smartResize(blueSource, 32, 32);

    expect(second.canvas).not.toBe(first.canvas);
    // 두 번째 호출 이후에도 첫 결과의 픽셀이 유지되어야 한다
    const pixel = getCanvasPixelData(first.canvas, 16, 16);
    expect(pixel.r).toBeGreaterThan(200);
    expect(pixel.b).toBeLessThan(100);
  });

  it('composeGrid 결과 canvas는 배경과 이미지 픽셀을 보존한다', async () => {
    const images = [await createLoadedImage(32, 32, 'red'), await createLoadedImage(32, 32, 'blue')];

    const canvas = await ImageComposer.composeGrid(images, {
      rows: 1,
      cols: 2,
      spacing: 4,
      backgroundColor: '#ffffff',
    });

    // spacing 영역은 배경색(흰색, 불투명)이어야 한다
    const background = getCanvasPixelData(canvas, 1, 1);
    expect(background.a).toBe(255);
    expect(background.r).toBe(255);
  });
});
