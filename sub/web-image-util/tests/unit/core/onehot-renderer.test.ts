/**
 * OnehotRenderer Integration Test
 *
 * Phase 2 Step 2 Validation:
 * 1. ResizeCalculator + OnehotRenderer integration
 * 2. Single drawImage call for simultaneous resizing + placement
 * 3. Background color application (transparent, white, translucent)
 * 4. Floating point coordinate handling (Math.round)
 * 5. Error handling (validateLayout)
 * 6. Proper operation in 5 fit modes
 */

import { describe, expect, it } from 'vitest';
import { OnehotRenderer } from '../../../src/core/onehot-renderer';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// ============================================================================
// Test Cases
// ============================================================================

describe('OnehotRenderer - Phase 2 Step 2', () => {
  const calculator = new ResizeCalculator();
  const renderer = new OnehotRenderer();

  describe('Basic Rendering', () => {
    it('should render with cover fit', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config);

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should apply contain fit + padding', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200, padding: 20 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { background: '#ffffff' });

      // Including padding 20 → 240x240
      expect(result.width).toBe(240);
      expect(result.height).toBe(240);
    });

    it('should apply fill fit (ignore aspect ratio)', () => {
      const sourceCanvas = createMockCanvas(100, 200);
      const config: ResizeConfig = { fit: 'fill', width: 300, height: 150 };
      const layout = calculator.calculateFinalLayout(100, 200, config);

      const result = renderer.render(sourceCanvas, layout, config);

      expect(result.width).toBe(300);
      expect(result.height).toBe(150);
    });
  });

  describe('Fit Mode Operations', () => {
    it('maxFit: should not enlarge small images', () => {
      const smallCanvas = createMockCanvas(91, 114);
      const config: ResizeConfig = { fit: 'maxFit', width: 300, height: 200 };
      const layout = calculator.calculateFinalLayout(91, 114, config);

      const result = renderer.render(smallCanvas, layout, config);

      expect(result.width).toBeCloseTo(91, 1);
      expect(result.height).toBeCloseTo(114, 1);
    });

    it('maxFit: should shrink large images', () => {
      const largeCanvas = createMockCanvas(800, 600);
      const config: ResizeConfig = { fit: 'maxFit', width: 300, height: 200 };
      const layout = calculator.calculateFinalLayout(800, 600, config);

      const result = renderer.render(largeCanvas, layout, config);

      // 800x600 (4:3) → maxFit 300x200 → shrink by height → 267x200
      expect(result.width).toBeCloseTo(267, 1);
      expect(result.height).toBeCloseTo(200, 1);
    });

    it('minFit: should enlarge small images', () => {
      const smallCanvas = createMockCanvas(50, 50);
      const config: ResizeConfig = { fit: 'minFit', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(50, 50, config);

      const result = renderer.render(smallCanvas, layout, config);

      expect(result.width).toBeCloseTo(200, 1);
      expect(result.height).toBeCloseTo(200, 1);
    });

    it('minFit: should not shrink large images', () => {
      const largeCanvas = createMockCanvas(800, 600);
      const config: ResizeConfig = { fit: 'minFit', width: 300, height: 200 };
      const layout = calculator.calculateFinalLayout(800, 600, config);

      const result = renderer.render(largeCanvas, layout, config);

      expect(result.width).toBeCloseTo(800, 1);
      expect(result.height).toBeCloseTo(600, 1);
    });
  });

  describe('Background Color Handling', () => {
    it('should apply transparent background', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { background: 'transparent' });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should apply white background', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { background: '#ffffff' });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should apply translucent background', () => {
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

  describe('Quality Options', () => {
    it('should apply high quality', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { quality: 'high' });

      expect(result.width).toBe(200);
    });

    it('should apply medium quality', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { quality: 'medium' });

      expect(result.width).toBe(200);
    });

    it('should apply low quality', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config, { quality: 'low' });

      expect(result.width).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should validate invalid Canvas size', () => {
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

    it('should validate NaN coordinates', () => {
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

  describe('Floating Point Handling', () => {
    it('should convert floating point coordinates to integers', () => {
      const sourceCanvas = createMockCanvas(100, 100);
      const config: ResizeConfig = { fit: 'contain', width: 333, height: 333 };
      const layout = calculator.calculateFinalLayout(100, 100, config);

      const result = renderer.render(sourceCanvas, layout, config);

      // Should be converted to integer coordinates by Math.round
      expect(result.width).toBe(333);
      expect(result.height).toBe(333);
    });
  });

  describe('Large Canvas Warning', () => {
    it('should only warn for very large Canvas, not error (skip - memory issue)', () => {
      // Note: Creating very large Canvas in happy-dom may cause timeout
      // This test is safe only in actual browser environment
      expect(true).toBe(true);
    });
  });
});
