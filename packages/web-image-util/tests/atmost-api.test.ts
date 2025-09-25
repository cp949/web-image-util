/**
 * atMost 메서드들 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processImage } from '../src';

describe('processImage atMost API', () => {
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

  describe('atMostRect 메서드', () => {
    it('processImage에 atMostRect 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.atMostRect).toBe('function');
    });

    it('atMostRect 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.atMostRect(300, 200);
      expect(result).toBe(processor);
    });

    it('atMostRect 메서드가 적절한 매개변수를 받아야 함', () => {
      const processor = processImage(mockImg);
      expect(() => {
        processor.atMostRect(300, 200);
      }).not.toThrow();

      expect(() => {
        processor.atMostRect(300, 200, { withoutEnlargement: true });
      }).not.toThrow();
    });
  });

  describe('atMostWidth 메서드', () => {
    it('processImage에 atMostWidth 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.atMostWidth).toBe('function');
    });

    it('atMostWidth 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.atMostWidth(300);
      expect(result).toBe(processor);
    });
  });

  describe('atMostHeight 메서드', () => {
    it('processImage에 atMostHeight 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.atMostHeight).toBe('function');
    });

    it('atMostHeight 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.atMostHeight(200);
      expect(result).toBe(processor);
    });
  });

  describe('atMostSize 메서드', () => {
    it('processImage에 atMostSize 메서드가 존재해야 함', () => {
      const processor = processImage(mockImg);
      expect(typeof processor.atMostSize).toBe('function');
    });

    it('atMostSize 메서드가 체이닝을 지원해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.atMostSize(300);
      expect(result).toBe(processor);
    });
  });

  describe('메서드 체이닝', () => {
    it('atMost 메서드들이 다른 메서드와 체이닝될 수 있어야 함', () => {
      const processor = processImage(mockImg);

      expect(() => {
        processor
          .atMostRect(300, 200)
          .blur(2);
      }).not.toThrow();

      expect(() => {
        processor
          .blur(1)
          .atMostWidth(300);
      }).not.toThrow();
    });
  });

  describe('타입 검증', () => {
    it('AtMostOptions 타입이 올바르게 작동해야 함', () => {
      const processor = processImage(mockImg);

      // 이런 코드들이 타입 에러 없이 컴파일되어야 함
      processor.atMostRect(300, 200, {
        background: '#ffffff',
        withoutEnlargement: true,
        quality: 0.8
      });

      processor.atMostWidth(300, {
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        withoutEnlargement: false
      });
    });
  });
});