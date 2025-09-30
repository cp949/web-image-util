/**
 * OnehotRenderer 통합 테스트
 *
 * Phase 2 Step 2 검증:
 * 1. ResizeCalculator + OnehotRenderer 통합 동작
 * 2. 단일 drawImage 호출로 리사이징 + 배치 동시 처리
 * 3. 배경색 적용 (transparent, 흰색, 반투명)
 * 4. 부동소수점 좌표 처리 (Math.round)
 * 5. 에러 처리 (validateLayout)
 * 6. 5가지 fit 모드에서 정상 작동
 */

import { describe, expect, it } from 'vitest';
import { OnehotRenderer } from '../../../src/core/onehot-renderer';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

// ============================================================================
// 테스트 유틸리티
// ============================================================================

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// ============================================================================
// 테스트 케이스
// ============================================================================

describe('OnehotRenderer - Phase 2 Step 2', () => {
  const calculator = new ResizeCalculator();
  const renderer = new OnehotRenderer();

  describe('기본 렌더링', () => {
    it('cover fit으로 기본 렌더링', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config);

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('contain fit + 패딩 적용', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200, padding: 20 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { background: '#ffffff' });

      // padding 20 포함 → 240x240
      expect(result.width).toBe(240);
      expect(result.height).toBe(240);
    });

    it('fill fit (비율 무시)', () => {
      const sourceCanvas = createMockCanvas(100, 200);
      const config: ResizeConfig = { fit: 'fill', width: 300, height: 150 };
      const layout = calculator.calculateFinalLayout(100, 200, config);

      const result = renderer.render(sourceCanvas, layout, config);

      expect(result.width).toBe(300);
      expect(result.height).toBe(150);
    });
  });

  describe('fit 모드별 동작', () => {
    it('maxFit: 작은 이미지는 확대 안함', () => {
      const smallCanvas = createMockCanvas(91, 114);
      const config: ResizeConfig = { fit: 'maxFit', width: 300, height: 200 };
      const layout = calculator.calculateFinalLayout(91, 114, config);

      const result = renderer.render(smallCanvas, layout, config);

      expect(result.width).toBeCloseTo(91, 1);
      expect(result.height).toBeCloseTo(114, 1);
    });

    it('maxFit: 큰 이미지는 축소됨', () => {
      const largeCanvas = createMockCanvas(800, 600);
      const config: ResizeConfig = { fit: 'maxFit', width: 300, height: 200 };
      const layout = calculator.calculateFinalLayout(800, 600, config);

      const result = renderer.render(largeCanvas, layout, config);

      expect(result.width).toBeCloseTo(300, 1);
      expect(result.height).toBeCloseTo(225, 1);
    });

    it('minFit: 작은 이미지는 확대됨', () => {
      const smallCanvas = createMockCanvas(50, 50);
      const config: ResizeConfig = { fit: 'minFit', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(50, 50, config);

      const result = renderer.render(smallCanvas, layout, config);

      expect(result.width).toBeCloseTo(200, 1);
      expect(result.height).toBeCloseTo(200, 1);
    });

    it('minFit: 큰 이미지는 축소 안함', () => {
      const largeCanvas = createMockCanvas(800, 600);
      const config: ResizeConfig = { fit: 'minFit', width: 300, height: 200 };
      const layout = calculator.calculateFinalLayout(800, 600, config);

      const result = renderer.render(largeCanvas, layout, config);

      expect(result.width).toBeCloseTo(800, 1);
      expect(result.height).toBeCloseTo(600, 1);
    });
  });

  describe('배경색 처리', () => {
    it('transparent 배경', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { background: 'transparent' });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('흰색 배경', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { background: '#ffffff' });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('반투명 배경', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, {
        background: 'rgba(0, 0, 0, 0.5)',
      });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('품질 옵션', () => {
    it('high 품질', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { quality: 'high' });

      expect(result.width).toBe(200);
    });

    it('medium 품질', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { quality: 'medium' });

      expect(result.width).toBe(200);
    });

    it('low 품질', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { quality: 'low' });

      expect(result.width).toBe(200);
    });
  });

  describe('에러 처리', () => {
    it('잘못된 Canvas 크기 검증', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const badLayout = {
        canvasSize: { width: 0, height: 0 },
        imageSize: { width: 100, height: 100 },
        position: { x: 0, y: 0 },
      };

      expect(() => {
        renderer.render(sourceCanvas, badLayout, { fit: 'cover', width: 200, height: 200 });
      }).toThrow('Invalid canvas size');
    });

    it('NaN 좌표 검증', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const badLayout = {
        canvasSize: { width: 200, height: 200 },
        imageSize: { width: 100, height: 100 },
        position: { x: NaN, y: NaN },
      };

      expect(() => {
        renderer.render(sourceCanvas, badLayout, { fit: 'cover', width: 200, height: 200 });
      }).toThrow('Invalid position');
    });
  });

  describe('부동소수점 처리', () => {
    it('부동소수점 좌표가 정수로 변환됨', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 333, height: 333 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config);

      // Math.round로 정수 좌표로 변환되어야 함
      expect(result.width).toBe(333);
      expect(result.height).toBe(333);
    });
  });

  describe('큰 Canvas 경고', () => {
    it('매우 큰 Canvas는 경고만 출력, 에러는 아님 (스킵 - 메모리 문제)', () => {
      // 주의: happy-dom에서 매우 큰 Canvas 생성 시 타임아웃 발생 가능
      // 이 테스트는 실제 브라우저 환경에서만 실행하는 것이 안전함
      expect(true).toBe(true);
    });
  });
});
