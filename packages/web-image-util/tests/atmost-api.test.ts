/**
 * inside 메서드들 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processImage } from '../src';

describe('processImage inside API', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockImg: HTMLImageElement;

  beforeEach(() => {
    // Mock Canvas
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 100;
    mockCanvas.height = 100;

    const ctx = mockCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 100, 100);
    }

    // Mock Image
    mockImg = new Image();
    Object.defineProperty(mockImg, 'naturalWidth', { value: 100, writable: false });
    Object.defineProperty(mockImg, 'naturalHeight', { value: 100, writable: false });
    Object.defineProperty(mockImg, 'width', { value: 100, writable: false });
    Object.defineProperty(mockImg, 'height', { value: 100, writable: false });
  });

  describe('insideRect 메서드', () => {
    it('processImage에 insideRect 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.insideRect).toBe('function');
    });

    it('insideRect 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.insideRect(300, 200);
      expect(result).toBe(processor);
    });

    it('insideRect 메서드가 적절한 매개변수를 받아야 함', () => {
      const processor = processImage(mockImg);
      expect(() => {
        processor.insideRect(300, 200);
      }).not.toThrow();

      expect(() => {
        processor.insideRect(300, 200, { withoutEnlargement: true });
      }).not.toThrow();
    });
  });

  describe('insideWidth 메서드', () => {
    it('processImage에 insideWidth 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.insideWidth).toBe('function');
    });

    it('insideWidth 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.insideWidth(300);
      expect(result).toBe(processor);
    });
  });

  describe('insideHeight 메서드', () => {
    it('processImage에 insideHeight 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.insideHeight).toBe('function');
    });

    it('insideHeight 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.insideHeight(200);
      expect(result).toBe(processor);
    });
  });

  describe('insideSize 메서드', () => {
    it('processImage에 insideSize 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.insideSize).toBe('function');
    });

    it('insideSize 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.insideSize(300);
      expect(result).toBe(processor);
    });
  });

  describe('메서드 체이닝', () => {
    it('inside 메서드들이 다른 메서드와 체이닝될 수 있어야 함', () => {
      const processor = processImage(mockImg);

      expect(() => {
        processor
          .insideRect(300, 200)
          .blur(2);
      }).not.toThrow();

      expect(() => {
        processor
          .blur(1)
          .insideWidth(300);
      }).not.toThrow();
    });
  });

  describe('타입 검증', () => {
    it('AtMostOptions 타입이 올바르게 작동해야 함', () => {
      const processor = processImage(mockImg);

      // 이런 코드들이 타입 에러 없이 컴파일되어야 함
      processor.insideRect(300, 200, {
        background: '#ffffff',
        withoutEnlargement: true,
        quality: 0.8
      });

      processor.insideWidth(300, {
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        withoutEnlargement: false
      });
    });
  });
});