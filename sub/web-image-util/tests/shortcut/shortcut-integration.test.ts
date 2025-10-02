import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';

describe('Shortcut API Integration Tests', () => {
  // Base64로 인코딩된 100x100 파란 사각형 SVG
  const testImageUrl =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzNzNkYyIvPjwvc3ZnPg==';

  describe('Group 1: Direct Mapping Operations', () => {
    // Vitest 모범 사례: describe.each를 사용하여 반복적인 테스트를 간결하게 표현
    describe.each([
      {
        method: 'coverBox',
        args: [300, 200],
        description: 'cover fit with box dimensions',
      },
      {
        method: 'containBox',
        args: [300, 200],
        description: 'contain fit with box dimensions',
      },
      {
        method: 'exactSize',
        args: [300, 200],
        description: 'exact size without aspect ratio preservation',
      },
      {
        method: 'maxWidth',
        args: [500],
        description: 'maximum width constraint',
      },
      {
        method: 'maxHeight',
        args: [400],
        description: 'maximum height constraint',
      },
      {
        method: 'maxSize',
        args: [{ width: 800, height: 600 }],
        description: 'maximum size with both dimensions',
      },
      {
        method: 'minWidth',
        args: [300],
        description: 'minimum width guarantee',
      },
      {
        method: 'minHeight',
        args: [200],
        description: 'minimum height guarantee',
      },
      {
        method: 'minSize',
        args: [{ width: 400, height: 300 }],
        description: 'minimum size with both dimensions',
      },
    ])('$method - $description', ({ method, args }) => {
      it('should return a valid processor instance', () => {
        const shortcutBuilder = processImage(testImageUrl).shortcut;
        const processor = (shortcutBuilder as any)[method](...args);

        expect(processor, `${method} should return a defined processor`).toBeDefined();
      });

      it('should have required output methods', () => {
        const shortcutBuilder = processImage(testImageUrl).shortcut;
        const processor = (shortcutBuilder as any)[method](...args);

        expect(typeof processor.toBlob, `${method} processor should have toBlob method`).toBe('function');
        expect(typeof processor.toDataURL, `${method} processor should have toDataURL method`).toBe('function');
        expect(typeof processor.toCanvas, `${method} processor should have toCanvas method`).toBe('function');
      });

      it('should support method chaining', () => {
        const shortcutBuilder = processImage(testImageUrl).shortcut;
        const processor = (shortcutBuilder as any)[method](...args);
        const chained = processor.blur(2);

        expect(chained, `${method} should support chaining with blur`).toBeDefined();
        expect(typeof chained.toBlob, 'chained processor should have toBlob method').toBe('function');
      });
    });
  });

  describe('Group 2: Lazy Operations', () => {
    // Vitest 모범 사례: describe.each로 lazy 연산 테스트를 체계적으로 구조화
    describe.each([
      {
        method: 'exactWidth',
        args: [100],
        description: 'resize to specific width maintaining aspect ratio',
        expectedScale: { sx: 1, sy: 1 }, // 100x100 원본 -> 100x100
      },
      {
        method: 'exactHeight',
        args: [200],
        description: 'resize to specific height maintaining aspect ratio',
        expectedScale: { sx: 2, sy: 2 }, // 100x100 원본 -> 200x200
      },
      {
        method: 'scale',
        args: [1.5],
        description: 'uniform scale transformation',
        expectedScale: { sx: 1.5, sy: 1.5 },
      },
      {
        method: 'scale',
        args: [{ sx: 2, sy: 0.75 }],
        description: 'non-uniform scale with object notation',
        expectedScale: { sx: 2, sy: 0.75 },
      },
      {
        method: 'scaleX',
        args: [2],
        description: 'horizontal scale only',
        expectedScale: { sx: 2, sy: 1 },
      },
      {
        method: 'scaleY',
        args: [0.5],
        description: 'vertical scale only',
        expectedScale: { sx: 1, sy: 0.5 },
      },
      {
        method: 'scaleXY',
        args: [2, 1.5],
        description: 'independent horizontal and vertical scale',
        expectedScale: { sx: 2, sy: 1.5 },
      },
    ])('$method - $description', ({ method, args }) => {
      it('should return a valid processor instance', () => {
        const shortcutBuilder = processImage(testImageUrl).shortcut;
        const processor = (shortcutBuilder as any)[method](...args);

        expect(processor, `${method} should return a defined processor`).toBeDefined();
      });

      it('should have required output methods', () => {
        const shortcutBuilder = processImage(testImageUrl).shortcut;
        const processor = (shortcutBuilder as any)[method](...args);

        expect(typeof processor.toBlob, `${method} processor should have toBlob method`).toBe('function');
        expect(typeof processor.toDataURL, `${method} processor should have toDataURL method`).toBe('function');
        expect(typeof processor.toCanvas, `${method} processor should have toCanvas method`).toBe('function');
      });

      it('should support lazy evaluation (no immediate processing)', () => {
        const shortcutBuilder = processImage(testImageUrl).shortcut;
        const startTime = performance.now();
        const processor = (shortcutBuilder as any)[method](...args);
        const creationTime = performance.now() - startTime;

        // Lazy 연산은 즉시 실행되지 않으므로 생성 시간이 매우 짧아야 함 (< 5ms)
        expect(creationTime, `${method} should create processor instantly without processing`).toBeLessThan(5);
        expect(processor, 'processor should be ready for future execution').toBeDefined();
      });
    });
  });

  describe('Method Chaining', () => {
    it('should support chaining direct operations with blur', () => {
      const processor = processImage(testImageUrl).shortcut.coverBox(300, 200).blur(2);
      expect(processor).toBeDefined();
      expect(typeof processor.toBlob).toBe('function');
    });

    it('should support chaining lazy operations with blur', () => {
      const processor = processImage(testImageUrl).shortcut.scale(1.5).blur(3);
      expect(processor).toBeDefined();
      expect(typeof processor.toBlob).toBe('function');
    });

    it('should support complex chaining', () => {
      const processor = processImage(testImageUrl).shortcut.exactWidth(300).blur(2);
      expect(processor).toBeDefined();
      expect(typeof processor.toBlob).toBe('function');
    });
  });

  describe('Actual Processing', () => {
    it('should actually process coverBox to canvas', async () => {
      const result = await processImage(testImageUrl).shortcut.coverBox(300, 200).toCanvas();
      expect(result.canvas).toBeDefined();
      expect(result.canvas.width).toBe(300);
      expect(result.canvas.height).toBe(200);
    });

    it('should actually process toScale to canvas', async () => {
      const result = await processImage(testImageUrl).shortcut.scale(2).toCanvas();
      expect(result.canvas).toBeDefined();
      expect(result.canvas.width).toBe(200);
      expect(result.canvas.height).toBe(200);
    });

    it('should actually process toWidth to canvas', async () => {
      const result = await processImage(testImageUrl).shortcut.exactWidth(50).toCanvas();
      expect(result.canvas).toBeDefined();
      expect(result.canvas.width).toBe(50);
      expect(result.canvas.height).toBe(50);
    });

    it('should actually process exactSize to canvas', async () => {
      const result = await processImage(testImageUrl).shortcut.exactSize(400, 300).toCanvas();
      expect(result.canvas).toBeDefined();
      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(300);
    });
  });
});
