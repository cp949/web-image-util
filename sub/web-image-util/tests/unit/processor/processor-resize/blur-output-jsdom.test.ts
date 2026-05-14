/**
 * processImage().blur() 호출부터 출력 메서드(toBlob/toCanvas)까지의 행동을 검증한다.
 *
 * 검증 범위:
 * - blur → resize → toBlob 순서의 출력 도달 및 치수 일관성
 * - resize → blur → toCanvas 순서의 출력 도달 및 치수 일관성
 * - blur 다중 누적 후 addBlur 호출 횟수·인자 일관성
 * - 기본 radius(2) 및 경계값 radius가 파이프라인에 그대로 전달됨
 *
 * jsdom 신뢰 경계: 픽셀 단위 blur 효과 검증은 브라우저 환경에서만 의미 있으므로 본 파일에서 다루지 않는다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyRenderPipeline } from '../../../../src/core/lazy-render-pipeline';
import { processImage } from '../../../../src/processor';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('blur() 출력 행동 검증', () => {
  let addBlurSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // call-through를 유지하여 기존 "출력 도달" 단정도 그대로 작동하게 한다.
    addBlurSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addBlur');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('blur → resize → toBlob 순서', () => {
    it('blur 후 resize 체이닝이 toBlob까지 정상 도달하고 addBlur가 올바른 인자로 호출된다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).blur(2).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
      expect(addBlurSpy).toHaveBeenCalledOnce();
      expect(addBlurSpy).toHaveBeenCalledWith({ radius: 2 });
    });

    it('출력 포맷은 png·jpeg·webp 중 하나다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).blur(2).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.format).toMatch(/^(png|jpeg|webp)$/);
    });
  });

  describe('resize → blur → toCanvas 순서', () => {
    it('resize 후 blur 체이닝이 toCanvas까지 정상 도달하고 addBlur가 올바른 인자로 호출된다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).blur(3).toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
      expect(addBlurSpy).toHaveBeenCalledOnce();
      expect(addBlurSpy).toHaveBeenCalledWith({ radius: 3 });
    });

    it('체이닝 중 예외 없이 toCanvas를 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'green');
      await expect(
        processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).blur(3).toCanvas()
      ).resolves.not.toThrow();
    });
  });

  describe('blur 다중 누적', () => {
    it('blur를 두 번 호출하면 addBlur가 두 번, 각 인자 순서대로 호출된다', async () => {
      const canvas = createTestCanvas(400, 300, 'purple');
      const result = await processImage(canvas)
        .blur(2)
        .blur(3)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
      // 누적 횟수와 인자를 검증한다 — push→overwrite 회귀 및 flush 루프 삭제 회귀를 잡는다.
      expect(addBlurSpy).toHaveBeenCalledTimes(2);
      expect(addBlurSpy).toHaveBeenNthCalledWith(1, { radius: 2 });
      expect(addBlurSpy).toHaveBeenNthCalledWith(2, { radius: 3 });
    });

    it('blur 세 번 누적 시 addBlur가 세 번 순서대로 호출되고 resize 치수가 정확히 반영된다', async () => {
      const canvas = createTestCanvas(800, 600, 'orange');
      const result = await processImage(canvas)
        .blur(1)
        .blur(2)
        .blur(3)
        .resize({ fit: 'cover', width: 100, height: 100 })
        .toBlob();

      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(addBlurSpy).toHaveBeenCalledTimes(3);
      expect(addBlurSpy).toHaveBeenNthCalledWith(1, { radius: 1 });
      expect(addBlurSpy).toHaveBeenNthCalledWith(2, { radius: 2 });
      expect(addBlurSpy).toHaveBeenNthCalledWith(3, { radius: 3 });
    });
  });

  describe('기본 radius 및 경계값', () => {
    it('radius 인자 없이 호출하면 addBlur에 기본값 radius=2가 전달된다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).blur().resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      // processor.ts의 기본값 radius=2가 실제로 파이프라인에 전달됐는지 검증한다.
      expect(addBlurSpy).toHaveBeenCalledOnce();
      expect(addBlurSpy).toHaveBeenCalledWith({ radius: 2 });
    });

    it('radius=0.5(하한 경계)로 호출하면 해당 값이 파이프라인에 그대로 전달된다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).blur(0.5).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(addBlurSpy).toHaveBeenCalledWith({ radius: 0.5 });
    });

    it('radius=10(상한 경계)으로 호출하면 해당 값이 파이프라인에 그대로 전달된다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).blur(10).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(addBlurSpy).toHaveBeenCalledWith({ radius: 10 });
    });
  });
});
