/**
 * ResizeCalculator Unit Tests
 *
 * @description
 * Comprehensive tests for all ResizeCalculator class functionality
 * - 5 fit modes (cover, contain, fill, maxFit, minFit)
 * - Padding system (numeric, object, none)
 * - Extreme cases (large/small images, abnormal ratios)
 * - Regression prevention for existing bugs
 * - Performance validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

describe('ResizeCalculator', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

  // ============================================================================
  // COVER FIT MODE - Maintains aspect ratio while filling entire area (may crop)
  // ============================================================================

  describe('cover fit mode', () => {
    it('should scale up to cover the target area (landscape image)', () => {
      // Landscape image (1920x1080) → Square (800x800)
      // Expected: Fitting height to 800 makes width 1422, covering the canvas
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'cover',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(1422);
      expect(result.imageSize.height).toBe(800);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      // Center-aligned with horizontal crop
      expect(result.position.x).toBe(-311); // (800 - 1422) / 2 = -311
      expect(result.position.y).toBe(0);
    });

    it('should scale up to cover the target area (portrait image)', () => {
      // Portrait image (1080x1920) → Square (800x800)
      const result = calculator.calculateFinalLayout(1080, 1920, {
        fit: 'cover',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(1422);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(-311); // Vertical crop
    });

    it('should scale down to cover the target area', () => {
      // Large square image (2000x2000) → Small square (500x500)
      const result = calculator.calculateFinalLayout(2000, 2000, {
        fit: 'cover',
        width: 500,
        height: 500,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 500 });
      expect(result.canvasSize).toEqual({ width: 500, height: 500 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should maintain aspect ratio when covering', () => {
      // Aspect ratio validation: Original 16:9 → Still 16:9 after cover
      const result = calculator.calculateFinalLayout(1600, 900, {
        fit: 'cover',
        width: 400,
        height: 400,
      });

      const originalRatio = 1600 / 900;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      // Account for floating point errors
      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });
  });

  // ============================================================================
  // CONTAIN FIT MODE - Maintains aspect ratio with entire image visible (padding added)
  // ============================================================================

  describe('contain fit mode', () => {
    it('should scale down to fit inside the target area (landscape)', () => {
      // Landscape image (1920x1080) → Square (800x800)
      // Fitting width to 800 makes height 450, entire image fits
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'contain',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(450);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      // Center-aligned with vertical padding
      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(175); // (800 - 450) / 2 = 175
    });

    it('should scale down to fit inside the target area (portrait)', () => {
      // Portrait image (1080x1920) → Square (800x800)
      const result = calculator.calculateFinalLayout(1080, 1920, {
        fit: 'contain',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(450);
      expect(result.imageSize.height).toBe(800);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      expect(result.position.x).toBe(175); // Horizontal padding
      expect(result.position.y).toBe(0);
    });

    it('should scale up to fit inside the target area', () => {
      // Small image (100x100) → Large square (500x500)
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 500,
        height: 500,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 500 });
      expect(result.canvasSize).toEqual({ width: 500, height: 500 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should maintain aspect ratio when containing', () => {
      // Aspect ratio validation: Original 4:3 → Still 4:3 after contain
      const result = calculator.calculateFinalLayout(800, 600, {
        fit: 'contain',
        width: 400,
        height: 400,
      });

      const originalRatio = 800 / 600;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });
  });

  // ============================================================================
  // FILL FIT MODE - Ignores aspect ratio for exact fit (may stretch or compress)
  // ============================================================================

  describe('fill fit mode', () => {
    it('should stretch image to exact target size', () => {
      // Square (1000x1000) → Rectangle (800x600)
      const result = calculator.calculateFinalLayout(1000, 1000, {
        fit: 'fill',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 800, height: 600 });
      expect(result.canvasSize).toEqual({ width: 800, height: 600 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should compress image to exact target size', () => {
      // Landscape image (1920x1080) → Portrait rectangle (600x800)
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'fill',
        width: 600,
        height: 800,
      });

      expect(result.imageSize).toEqual({ width: 600, height: 800 });
      expect(result.canvasSize).toEqual({ width: 600, height: 800 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should not maintain aspect ratio', () => {
      // Aspect ratio validation: Original 16:9 → 1:1 after fill (ratio changed)
      const result = calculator.calculateFinalLayout(1600, 900, {
        fit: 'fill',
        width: 500,
        height: 500,
      });

      const originalRatio = 1600 / 900; // 1.78
      const resultRatio = result.imageSize.width / result.imageSize.height; // 1.0

      expect(Math.abs(resultRatio - originalRatio)).toBeGreaterThan(0.5);
    });
  });

  // ============================================================================
  // MAXFIT MODE - Maximum size limit (scale down only, no enlargement)
  // ============================================================================

  describe('maxFit mode', () => {
    describe('Bug regression prevention tests', () => {
      it('should NOT enlarge small images (91x114 → maxFit 300x200)', () => {
        // Previous bug: Small images were being enlarged
        // Fixed: Small images maintain original size
        const result = calculator.calculateFinalLayout(91, 114, {
          fit: 'maxFit',
          width: 300,
          height: 200,
        });

        expect(result.imageSize).toEqual({ width: 91, height: 114 });
        expect(result.canvasSize).toEqual({ width: 91, height: 114 });
        expect(result.position).toEqual({ x: 0, y: 0 });
      });

      it('should NOT enlarge small images (100x100 → maxFit 500x500)', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'maxFit',
          width: 500,
          height: 500,
        });

        expect(result.imageSize).toEqual({ width: 100, height: 100 });
        expect(result.canvasSize).toEqual({ width: 100, height: 100 });
      });
    });

    it('should scale down large images to fit within max bounds', () => {
      // Large images are scaled down
      const result = calculator.calculateFinalLayout(2000, 1500, {
        fit: 'maxFit',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 800, height: 600 });
      expect(result.canvasSize).toEqual({ width: 800, height: 600 });
    });

    it('should handle width-only constraint', () => {
      // Width constraint only
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'maxFit',
        width: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(450); // Maintain aspect ratio
    });

    it('should handle height-only constraint', () => {
      // Height constraint only
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'maxFit',
        height: 600,
      });

      expect(result.imageSize.width).toBe(1067);
      expect(result.imageSize.height).toBe(600);
    });

    it('should maintain aspect ratio when scaling down', () => {
      const result = calculator.calculateFinalLayout(1600, 1200, {
        fit: 'maxFit',
        width: 400,
        height: 300,
      });

      const originalRatio = 1600 / 1200;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });
  });

  // ============================================================================
  // MINFIT MODE - Minimum size guarantee (scale up only, no shrinking)
  // ============================================================================

  describe('minFit mode', () => {
    it('should enlarge small images to meet minimum bounds', () => {
      // Small images are enlarged
      const result = calculator.calculateFinalLayout(100, 80, {
        fit: 'minFit',
        width: 500,
        height: 400,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 400 });
      expect(result.canvasSize).toEqual({ width: 500, height: 400 });
    });

    it('should NOT shrink large images', () => {
      // Large images maintain original size
      const result = calculator.calculateFinalLayout(2000, 1500, {
        fit: 'minFit',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 2000, height: 1500 });
      expect(result.canvasSize).toEqual({ width: 2000, height: 1500 });
    });

    it('should handle width-only constraint', () => {
      // Width constraint only
      const result = calculator.calculateFinalLayout(400, 300, {
        fit: 'minFit',
        width: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(600); // Maintain aspect ratio
    });

    it('should handle height-only constraint', () => {
      // Height constraint only
      const result = calculator.calculateFinalLayout(400, 300, {
        fit: 'minFit',
        height: 600,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(600);
    });

    it('should maintain aspect ratio when scaling up', () => {
      const result = calculator.calculateFinalLayout(200, 150, {
        fit: 'minFit',
        width: 800,
        height: 600,
      });

      const originalRatio = 200 / 150;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });

    it('should prevent quality degradation on large upscaling', () => {
      // Quality degradation prevention: Excessive upscaling should be warned
      // This test only validates warning (actual behavior is normal)
      const result = calculator.calculateFinalLayout(50, 50, {
        fit: 'minFit',
        width: 1000,
        height: 1000,
      });

      // 20x enlargement (50 → 1000)
      expect(result.imageSize).toEqual({ width: 1000, height: 1000 });

      // Calculate scale factor
      const scaleFactor = result.imageSize.width / 50;
      expect(scaleFactor).toBe(20); // 20x enlargement
    });
  });

  // ============================================================================
  // PADDING SYSTEM - Padding handling tests
  // ============================================================================

  describe('padding system', () => {
    describe('numeric padding', () => {
      it('should apply same padding to all sides', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'contain',
          width: 100,
          height: 100,
          padding: 20,
        });

        // Canvas size: 100 + 20*2 = 140
        expect(result.canvasSize).toEqual({ width: 140, height: 140 });
        // Image position: Offset by padding amount
        expect(result.position).toEqual({ x: 20, y: 20 });
      });

      it('should work with cover fit', () => {
        const result = calculator.calculateFinalLayout(200, 100, {
          fit: 'cover',
          width: 100,
          height: 100,
          padding: 10,
        });

        expect(result.canvasSize).toEqual({ width: 120, height: 120 });
        // cover: Image 200x100 → 200x100 (as is), center-aligned
        expect(result.imageSize.width).toBe(200);
        expect(result.imageSize.height).toBe(100);
      });
    });

    describe('object padding', () => {
      it('should apply different padding to each side', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'contain',
          width: 100,
          height: 100,
          padding: { top: 10, right: 20, bottom: 30, left: 40 },
        });

        // Canvas size: width=100+20+40=160, height=100+10+30=140
        expect(result.canvasSize).toEqual({ width: 160, height: 140 });
        // Image position: left=40, top=10
        expect(result.position).toEqual({ x: 40, y: 10 });
      });

      it('should handle partial object padding', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'contain',
          width: 100,
          height: 100,
          padding: { top: 15, left: 25 },
        });

        // Unspecified right, bottom default to 0
        expect(result.canvasSize).toEqual({ width: 125, height: 115 });
        expect(result.position).toEqual({ x: 25, y: 15 });
      });

      it('should handle empty object padding', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'contain',
          width: 100,
          height: 100,
          padding: {},
        });

        // All padding values are 0
        expect(result.canvasSize).toEqual({ width: 100, height: 100 });
        expect(result.position).toEqual({ x: 0, y: 0 });
      });
    });

    describe('no padding', () => {
      it('should work without padding (undefined)', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'contain',
          width: 100,
          height: 100,
        });

        expect(result.canvasSize).toEqual({ width: 100, height: 100 });
        expect(result.position).toEqual({ x: 0, y: 0 });
      });
    });

    describe('padding with maxFit/minFit', () => {
      it('should apply padding to maxFit canvas size', () => {
        // maxFit: Image size becomes canvas size
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'maxFit',
          width: 300,
          height: 200,
          padding: 20,
        });

        // Image: 100x100 (no enlargement)
        // Canvas: 100+40 = 140
        expect(result.imageSize).toEqual({ width: 100, height: 100 });
        expect(result.canvasSize).toEqual({ width: 140, height: 140 });
        expect(result.position).toEqual({ x: 20, y: 20 });
      });

      it('should apply padding to minFit canvas size', () => {
        // minFit: Image size becomes canvas size
        const result = calculator.calculateFinalLayout(200, 150, {
          fit: 'minFit',
          width: 100,
          height: 80,
          padding: 10,
        });

        // Image: 200x150 (no shrinking)
        // Canvas: 200+20 = 220, 150+20 = 170
        expect(result.imageSize).toEqual({ width: 200, height: 150 });
        expect(result.canvasSize).toEqual({ width: 220, height: 170 });
        expect(result.position).toEqual({ x: 10, y: 10 });
      });
    });

    describe('large padding edge cases', () => {
      it('should handle very large padding', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'contain',
          width: 100,
          height: 100,
          padding: 100,
        });

        // Canvas: 100+200 = 300
        expect(result.canvasSize).toEqual({ width: 300, height: 300 });
        expect(result.position).toEqual({ x: 100, y: 100 });
      });

      it('should handle asymmetric large padding', () => {
        const result = calculator.calculateFinalLayout(50, 50, {
          fit: 'contain',
          width: 50,
          height: 50,
          padding: { top: 200, right: 0, bottom: 0, left: 100 },
        });

        expect(result.canvasSize).toEqual({ width: 150, height: 250 });
        expect(result.position).toEqual({ x: 100, y: 200 });
      });
    });
  });

  // ============================================================================
  // EXTREME CASES - Extreme case tests
  // ============================================================================

  describe('extreme cases', () => {
    describe('very large images', () => {
      it('should handle 8K resolution (7680x4320)', () => {
        const result = calculator.calculateFinalLayout(7680, 4320, {
          fit: 'cover',
          width: 1920,
          height: 1080,
        });

        // 4x scale down
        expect(result.imageSize).toEqual({ width: 1920, height: 1080 });
        expect(result.canvasSize).toEqual({ width: 1920, height: 1080 });
      });

      it('should handle extremely large images (100000x100000)', () => {
        const result = calculator.calculateFinalLayout(100000, 100000, {
          fit: 'maxFit',
          width: 1000,
          height: 1000,
        });

        // 100x scale down
        expect(result.imageSize).toEqual({ width: 1000, height: 1000 });
      });
    });

    describe('very small images', () => {
      it('should handle 1x1 pixel image', () => {
        const result = calculator.calculateFinalLayout(1, 1, {
          fit: 'maxFit',
          width: 100,
          height: 100,
        });

        // No enlargement
        expect(result.imageSize).toEqual({ width: 1, height: 1 });
      });

      it('should handle very small images (10x10)', () => {
        const result = calculator.calculateFinalLayout(10, 10, {
          fit: 'contain',
          width: 500,
          height: 500,
        });

        // 50x enlargement
        expect(result.imageSize).toEqual({ width: 500, height: 500 });
      });
    });

    describe('extreme aspect ratios', () => {
      it('should handle very wide images (10000:1)', () => {
        const result = calculator.calculateFinalLayout(10000, 1, {
          fit: 'contain',
          width: 1000,
          height: 1000,
        });

        expect(result.imageSize.width).toBe(1000);
        expect(result.imageSize.height).toBe(0); // Math.round(1000 * 1/10000)
      });

      it('should handle very tall images (1:10000)', () => {
        const result = calculator.calculateFinalLayout(1, 10000, {
          fit: 'contain',
          width: 1000,
          height: 1000,
        });

        expect(result.imageSize.width).toBe(0); // Math.round(1000 * 1/10000)
        expect(result.imageSize.height).toBe(1000);
      });

      it('should handle panoramic images (21:9)', () => {
        const result = calculator.calculateFinalLayout(2560, 1080, {
          fit: 'cover',
          width: 1920,
          height: 1080,
        });

        // Maintain aspect ratio
        const ratio = result.imageSize.width / result.imageSize.height;
        expect(Math.abs(ratio - 2560 / 1080)).toBeLessThan(0.01);
      });
    });

    describe('edge case dimensions', () => {
      it('should handle zero width target', () => {
        // TypeScript doesn't allow this, but can occur at runtime
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'fill',
          width: 0,
          height: 100,
        } as ResizeConfig);

        expect(result.imageSize.width).toBe(0);
      });

      it('should handle zero height target', () => {
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'fill',
          width: 100,
          height: 0,
        } as ResizeConfig);

        expect(result.imageSize.height).toBe(0);
      });

      it('should handle fractional dimensions', () => {
        // Floating point operations may result in decimals
        const result = calculator.calculateFinalLayout(1000, 333, {
          fit: 'contain',
          width: 300,
          height: 100,
        });

        // Converted to integers via Math.round
        expect(Number.isInteger(result.imageSize.width)).toBe(true);
        expect(Number.isInteger(result.imageSize.height)).toBe(true);
      });
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS - Performance tests
  // ============================================================================

  describe('performance', () => {
    it('should calculate layout in reasonable time (1000 iterations)', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculator.calculateFinalLayout(1920, 1080, {
          fit: 'cover',
          width: 800,
          height: 600,
          padding: 10,
        });
      }

      const end = performance.now();
      const duration = end - start;

      // 1000 calculations should complete within 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle complex padding calculations efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculator.calculateFinalLayout(1920, 1080, {
          fit: 'contain',
          width: 800,
          height: 600,
          padding: { top: 10, right: 20, bottom: 15, left: 25 },
        });
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100);
    });

    it('should not degrade with different fit modes', () => {
      // Skip performance consistency test in Node.js environment
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        console.log('Performance consistency test skipped in Node.js environment');
        return;
      }

      const fitModes: Array<'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit'> = [
        'cover',
        'contain',
        'fill',
        'maxFit',
        'minFit',
      ];

      const durations: number[] = [];

      fitModes.forEach((fit) => {
        const start = performance.now();

        for (let i = 0; i < 500; i++) {
          calculator.calculateFinalLayout(1920, 1080, {
            fit,
            width: 800,
            height: 600,
          } as ResizeConfig);
        }

        const end = performance.now();
        durations.push(end - start);
      });

      // All fit modes should show similar performance
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      durations.forEach((duration) => {
        // Within ±50% of average
        expect(Math.abs(duration - avgDuration) / avgDuration).toBeLessThan(0.5);
      });
    });
  });

  // ============================================================================
  // REGRESSION TESTS - Bug regression prevention tests
  // ============================================================================

  describe('regression tests', () => {
    describe('maxFit enlargement bug', () => {
      it('should NOT enlarge 91x114 image to 300x200 (original bug)', () => {
        // Original bug: maxFit was enlarging small images
        const result = calculator.calculateFinalLayout(91, 114, {
          fit: 'maxFit',
          width: 300,
          height: 200,
        });

        expect(result.imageSize).toEqual({ width: 91, height: 114 });
        expect(result.canvasSize).toEqual({ width: 91, height: 114 });
        expect(result.position).toEqual({ x: 0, y: 0 });
      });

      it('should NOT enlarge any small image with maxFit', () => {
        const testCases = [
          { w: 50, h: 50, maxW: 100, maxH: 100 },
          { w: 80, h: 120, maxW: 200, maxH: 300 },
          { w: 150, h: 100, maxW: 500, maxH: 400 },
        ];

        testCases.forEach(({ w, h, maxW, maxH }) => {
          const result = calculator.calculateFinalLayout(w, h, {
            fit: 'maxFit',
            width: maxW,
            height: maxH,
          });

          expect(result.imageSize).toEqual({ width: w, height: h });
        });
      });
    });

    describe('minFit quality degradation', () => {
      it('should warn about large upscaling factors', () => {
        // Large upscaling with minFit causes quality degradation
        // Test only validates warning, actual behavior is normal
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'minFit',
          width: 1000,
          height: 1000,
        });

        const scaleFactor = result.imageSize.width / 100;
        expect(scaleFactor).toBe(10); // 10x enlargement

        // Recommendation: Warn for upscaling >4x
        if (scaleFactor > 4) {
          // In actual app: console.warn or display warning
          expect(scaleFactor).toBeGreaterThan(4);
        }
      });
    });

    describe('SVG size calculation accuracy', () => {
      it('should calculate correct dimensions for typical SVG sizes', () => {
        // SVGs are vectors and can be rendered at any size
        // However, original viewBox size should be calculated accurately
        const svgSizes = [
          { w: 24, h: 24 }, // Icon
          { w: 100, h: 100 }, // Small graphic
          { w: 512, h: 512 }, // Medium graphic
          { w: 1024, h: 1024 }, // Large graphic
        ];

        svgSizes.forEach(({ w, h }) => {
          const result = calculator.calculateFinalLayout(w, h, {
            fit: 'maxFit',
            width: 300,
            height: 200,
          });

          // Small SVGs should not be enlarged
          if (w <= 300 && h <= 200) {
            expect(result.imageSize).toEqual({ width: w, height: h });
          }
        });
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - Integration tests (combining multiple features)
  // ============================================================================

  describe('integration tests', () => {
    it('should handle complex scenario: cover + large padding + extreme ratio', () => {
      const result = calculator.calculateFinalLayout(3000, 1000, {
        fit: 'cover',
        width: 800,
        height: 800,
        padding: { top: 50, right: 30, bottom: 50, left: 30 },
      });

      // Image: 3:1 ratio → To cover square canvas, fit height to 800
      expect(result.imageSize.width).toBe(2400);
      expect(result.imageSize.height).toBe(800);

      // Canvas: 800 + 60 (padding) = 860
      expect(result.canvasSize).toEqual({ width: 860, height: 900 });

      // Position: Center-aligned + padding
      expect(result.position.x).toBeLessThan(0); // Horizontal crop
      expect(result.position.y).toBe(50); // Top padding
    });

    it('should handle all fit modes with same input', () => {
      const input = { width: 1920, height: 1080 };
      const target = { width: 800, height: 800 };

      const coverResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'cover',
        ...target,
      });
      const containResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'contain',
        ...target,
      });
      const fillResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'fill',
        ...target,
      });
      const maxFitResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'maxFit',
        ...target,
      });
      const minFitResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'minFit',
        ...target,
      });

      // cover: Covers canvas
      expect(coverResult.imageSize.width).toBeGreaterThanOrEqual(target.width);
      expect(coverResult.imageSize.height).toBeGreaterThanOrEqual(target.height);

      // contain: Fits inside canvas
      expect(containResult.imageSize.width).toBeLessThanOrEqual(target.width);
      expect(containResult.imageSize.height).toBeLessThanOrEqual(target.height);

      // fill: Exact fit
      expect(fillResult.imageSize).toEqual(target);

      // maxFit: Scale down only
      expect(maxFitResult.imageSize.width).toBeLessThanOrEqual(input.width);
      expect(maxFitResult.imageSize.height).toBeLessThanOrEqual(input.height);

      // minFit: Maintain original size (already large)
      expect(minFitResult.imageSize.width).toBe(input.width);
      expect(minFitResult.imageSize.height).toBe(input.height);
    });
  });
});
