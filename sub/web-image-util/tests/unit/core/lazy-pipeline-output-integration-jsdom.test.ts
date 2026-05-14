/**
 * LazyRenderPipeline 통합 분기 검증 (processImage 공개 표면 경유, jsdom-safe)
 *
 * 목적:
 * - resize/blur 누적 후 단일 렌더로 출력 메서드에 도달하는 경로의 회귀를 방지한다.
 * - Shortcut API(_addResizeOperation 경유)의 scale/toWidth 분기가 의도대로 동작함을 검증한다.
 *
 * 분리 기준:
 * - 검증 진입점은 processImage() 공개 표면으로만 한다. 내부 LazyRenderPipeline 직접 import는 사용하지 않는다.
 * - Canvas 입력은 source-converter가 그대로 통과시켜 출력 메서드까지 jsdom에서 동작한다.
 * - jsdom의 resources: 'usable' + canvas 패키지로 Image 로딩이 동작해 naturalWidth/naturalHeight가 올바르게 설정된다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../src/processor';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('LazyRenderPipeline 통합 분기 (processImage 공개 표면, jsdom-safe)', () => {
  describe('resize 단독 누적 → toBlob', () => {
    it('resize 후 toBlob이 지정된 치수로 정상 종료한다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 100 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
    });

    it('fill 모드로 resize 후 toBlob이 정확히 지정된 치수를 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');
      const result = await processImage(canvas).resize({ fit: 'fill', width: 320, height: 240 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
    });
  });

  describe('blur 단독 누적 → toCanvas', () => {
    it('blur만 호출 후 toCanvas가 HTMLCanvasElement를 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');
      const result = await processImage(canvas).blur(2).toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    });

    it('blur는 크기를 변경하지 않으므로 결과 치수가 원본과 동일하다', async () => {
      const canvas = createTestCanvas(400, 300, 'green');
      const result = await processImage(canvas).blur(2).toCanvas();

      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
    });

    it('연속 blur 호출 후 toCanvas가 정상 종료한다', async () => {
      const canvas = createTestCanvas(200, 200, 'purple');
      const result = await processImage(canvas).blur(1).blur(3).toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('resize + blur 혼합 누적 → toBlob', () => {
    it('blur 후 resize를 체이닝해 toBlob이 지정된 치수로 정상 종료한다', async () => {
      const canvas = createTestCanvas(400, 300, 'orange');
      // addBlur → addResize 순서로 operations에 누적된다
      const result = await processImage(canvas).blur(1).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);
    });

    it('resize 후 blur를 체이닝해 toBlob이 지정된 치수로 정상 종료한다', async () => {
      const canvas = createTestCanvas(400, 300, 'teal');
      // addResize → addBlur 순서로 operations에 누적된다
      const result = await processImage(canvas).resize({ fit: 'cover', width: 150, height: 150 }).blur(2).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);
    });

    it('resize + blur 혼합 후 toCanvas가 정상 종료한다', async () => {
      const canvas = createTestCanvas(400, 300, 'maroon');
      const result = await processImage(canvas)
        .blur(1)
        .resize({ fit: 'fill', width: 160, height: 120 })
        .blur(2)
        .toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(160);
      expect(result.height).toBe(120);
    });
  });

  describe('Shortcut scale 분기 → _addResizeOperation 경로', () => {
    it('shortcut.scale(0.5) 적용 시 원본의 절반 치수로 toCanvas가 정상 종료한다', async () => {
      // 400x300 → scale(0.5) → Math.round(400*0.5)=200, Math.round(300*0.5)=150
      const canvas = createTestCanvas(400, 300, 'navy');
      const result = await processImage(canvas).shortcut.scale(0.5).toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('shortcut.scale(0.5)로 toBlob이 정상 Blob을 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'crimson');
      const result = await processImage(canvas).shortcut.scale(0.5).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });
  });

  describe('Shortcut toWidth 분기 → convertToResizeConfig(toWidth) 경로', () => {
    it('shortcut.exactWidth(300) 적용 시 종횡비를 유지하며 width가 300으로 출력한다', async () => {
      // 400x300 → toWidth(300): aspectRatio = 300/400 = 0.75, height = Math.round(300*0.75) = 225
      const canvas = createTestCanvas(400, 300, 'coral');
      const result = await processImage(canvas).shortcut.exactWidth(300).toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(300);
      expect(result.height).toBe(225);
    });
  });
});
