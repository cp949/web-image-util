/**
 * toCanvasDetailed()의 반환 형태, 메타데이터 일관성, Canvas 풀 미반환을 검증한다.
 *
 * - 반환 객체에 HTMLCanvasElement와 메타데이터가 함께 노출되는지 확인한다.
 * - Canvas가 CanvasPool에 반환되지 않아 사용자가 안전하게 보유 가능한지 검증한다.
 * - toCanvas()와의 반환 형태 동치를 잠근다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../../src/base/canvas-pool';
import { ImageProcessor, processImage } from '../../../../src/processor';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('toCanvasDetailed() 행동 검증', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('반환 형태와 메타데이터', () => {
    it('HTMLCanvasElement와 처리 치수를 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      // toCanvasDetailed은 TypedImageProcessor 인터페이스 외부 메서드이므로 구체 클래스로 호출한다
      const result = await new ImageProcessor(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('processingTime은 0 이상의 숫자다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await new ImageProcessor(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('originalSize는 입력 Canvas의 원본 치수를 담는다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await new ImageProcessor(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      expect(result.originalSize).toEqual({ width: 400, height: 300 });
    });

    it('format은 undefined이다 — Canvas는 포맷 정보를 갖지 않는다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await new ImageProcessor(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      expect(result.format).toBeUndefined();
    });
  });

  describe('Canvas 풀 미반환', () => {
    it('반환된 canvas는 CanvasPool에 release되지 않는다', async () => {
      const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release');
      const canvas = createTestCanvas(400, 300, 'blue');

      const result = await new ImageProcessor(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      expect(releaseSpy).not.toHaveBeenCalledWith(result.canvas);
    });

    it('toBlob()은 처리에 사용한 canvas를 CanvasPool에 반환한다 — toCanvasDetailed()와의 차이를 잠근다', async () => {
      const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release');
      const canvas = createTestCanvas(400, 300, 'green');

      await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(releaseSpy).toHaveBeenCalled();
    });
  });

  describe('toCanvas()와의 반환 형태 동치', () => {
    it('toCanvas()와 동일한 데이터 속성 키를 갖는다', async () => {
      const canvas1 = createTestCanvas(400, 300, 'red');
      const canvas2 = createTestCanvas(400, 300, 'red');

      const canvasResult = await processImage(canvas1).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();
      const detailedResult = await new ImageProcessor(canvas2)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      // 메서드는 프로토타입에 있으므로 Object.keys로 인스턴스 데이터 속성만 비교한다
      const canvasKeys = Object.keys(canvasResult).sort();
      const detailedKeys = Object.keys(detailedResult).sort();
      expect(detailedKeys).toEqual(canvasKeys);
    });

    it('동일 입력에서 toCanvas()와 width/height/originalSize가 일치한다', async () => {
      const canvas1 = createTestCanvas(400, 300, 'red');
      const canvas2 = createTestCanvas(400, 300, 'red');

      const canvasResult = await processImage(canvas1).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();
      const detailedResult = await new ImageProcessor(canvas2)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toCanvasDetailed();

      expect(detailedResult.width).toBe(canvasResult.width);
      expect(detailedResult.height).toBe(canvasResult.height);
      expect(detailedResult.originalSize).toEqual(canvasResult.originalSize);
    });
  });
});
