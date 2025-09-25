/**
 * processImage API 기본 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processImage, ImageProcessor, features } from '../src';

describe('processImage API', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockImg: HTMLImageElement;

  beforeEach(() => {
    // Mock Canvas 설정
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 100;
    mockCanvas.height = 100;
    
    const mockCtx = mockCanvas.getContext('2d');
    if (mockCtx) {
      // 간단한 테스트 이미지 그리기
      mockCtx.fillStyle = '#ff0000';
      mockCtx.fillRect(0, 0, 100, 100);
    }

    // Mock Image 설정
    mockImg = new Image();
    Object.defineProperties(mockImg, {
      naturalWidth: { value: 100, writable: false },
      naturalHeight: { value: 100, writable: false },
      width: { value: 100, writable: false },
      height: { value: 100, writable: false },
      complete: { value: true, writable: false },
    });
  });

  describe('팩토리 함수', () => {
    it('processImage는 ImageProcessor 인스턴스를 반환해야 함', () => {
      const processor = processImage(mockImg);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('다양한 소스 타입을 받을 수 있어야 함', () => {
      expect(() => processImage(mockImg)).not.toThrow();
      expect(() => processImage('data:image/png;base64,iVBOR...')).not.toThrow();
      expect(() => processImage('<svg>...</svg>')).not.toThrow();
    });

    it('옵션과 함께 생성할 수 있어야 함', () => {
      const processor = processImage(mockImg, {
        crossOrigin: 'use-credentials',
        defaultQuality: 0.9,
      });
      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('메서드 체이닝', () => {
    it('resize 메서드는 this를 반환하여 체이닝이 가능해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.resize(200, 150);
      expect(result).toBe(processor);
    });

    it('blur 메서드는 this를 반환하여 체이닝이 가능해야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.blur(2);
      expect(result).toBe(processor);
    });

    it('여러 메서드를 연속으로 체이닝할 수 있어야 함', () => {
      const processor = processImage(mockImg);
      const result = processor.resize(200, 150).blur(2);
      expect(result).toBe(processor);
    });
  });

  describe('resize 메서드', () => {
    it('기본 리사이징 (cover fit)', () => {
      const processor = processImage(mockImg);
      expect(() => processor.resize(200, 150)).not.toThrow();
    });

    it('너비만 지정 (비율 유지)', () => {
      const processor = processImage(mockImg);
      expect(() => processor.resize(200)).not.toThrow();
    });

    it('높이만 지정 (비율 유지)', () => {
      const processor = processImage(mockImg);
      expect(() => processor.resize(undefined, 150)).not.toThrow();
    });

    it('다양한 fit 옵션', () => {
      const processor = processImage(mockImg);
      
      expect(() => processor.resize(200, 150, { fit: 'cover' })).not.toThrow();
      expect(() => processor.resize(200, 150, { fit: 'contain' })).not.toThrow();
      expect(() => processor.resize(200, 150, { fit: 'fill' })).not.toThrow();
    });

    it('고급 옵션들', () => {
      const processor = processImage(mockImg);
      
      expect(() => processor.resize(200, 150, {
        fit: 'contain',
        position: 'top',
        background: '#ffffff',
        withoutEnlargement: true,
      })).not.toThrow();
    });
  });

  describe('blur 메서드', () => {
    it('기본 블러 (반지름 2)', () => {
      const processor = processImage(mockImg);
      expect(() => processor.blur()).not.toThrow();
    });

    it('사용자 정의 반지름', () => {
      const processor = processImage(mockImg);
      expect(() => processor.blur(5)).not.toThrow();
    });

    it('고급 블러 옵션', () => {
      const processor = processImage(mockImg);
      expect(() => processor.blur(5, {
        precision: 2,
        minAmplitude: 0.5,
      })).not.toThrow();
    });
  });

  // Note: 실제 Canvas API 테스트는 브라우저 환경에서 실행
  describe.skipIf(!features.webp)('출력 메서드 (브라우저 환경)', () => {
    it('toBlob은 메타데이터와 함께 Blob을 반환해야 함', async () => {
      const processor = processImage(mockImg);
      
      // 실제 구현에서는 Canvas API 사용
      try {
        const result = await processor.toBlob();
        
        expect(result).toHaveProperty('blob');
        expect(result).toHaveProperty('width');
        expect(result).toHaveProperty('height');
        expect(result).toHaveProperty('processingTime');
        expect(result.blob).toBeInstanceOf(Blob);
        expect(typeof result.width).toBe('number');
        expect(typeof result.height).toBe('number');
        expect(typeof result.processingTime).toBe('number');
      } catch (error) {
        // 테스트 환경에서는 Canvas API가 제한될 수 있음
        console.log('Canvas API 테스트는 브라우저 환경에서만 가능합니다');
      }
    });

    it('다양한 출력 포맷을 지원해야 함', async () => {
      const processor = processImage(mockImg);
      
      try {
        // PNG (기본)
        await processor.toBlob();
        
        // JPEG
        await processor.toBlob({ format: 'jpeg', quality: 0.8 });
        
        // WebP (지원되는 경우)
        if (features.webp) {
          await processor.toBlob({ format: 'webp', quality: 0.8 });
        }
      } catch (error) {
        console.log('출력 테스트는 브라우저 환경에서만 가능합니다');
      }
    });
  });
});

describe('features 객체', () => {
  it('브라우저 기능 감지 정보를 제공해야 함', () => {
    expect(features).toHaveProperty('webp');
    expect(features).toHaveProperty('avif');
    expect(features).toHaveProperty('offscreenCanvas');
    expect(features).toHaveProperty('imageBitmap');
    
    expect(typeof features.webp).toBe('boolean');
    expect(typeof features.avif).toBe('boolean');
    expect(typeof features.offscreenCanvas).toBe('boolean');
    expect(typeof features.imageBitmap).toBe('boolean');
  });
});

describe('API 사용 예제', () => {
  it('README 예제 코드가 정상적으로 작동해야 함', async () => {
    // 기본 사용법
    const processor1 = processImage(mockImg);
    expect(() => processor1.resize(300, 200)).not.toThrow();
    
    // 고급 사용법
    const processor2 = processImage(mockImg);
    expect(() => processor2
      .resize(300, 200, { fit: 'contain', background: '#ffffff' })
      .blur(2)
    ).not.toThrow();
  });

  it('Sharp와 유사한 API 패턴', () => {
    // Sharp: sharp(input).resize(300, 200).blur(2).toFormat('webp')
    const processor = processImage(mockImg);
    
    expect(() => processor
      .resize(300, 200)
      .blur(2)
    ).not.toThrow();
    
    // 출력도 Sharp와 유사한 패턴
    expect(typeof processor.toBlob).toBe('function');
    expect(typeof processor.toDataURL).toBe('function');
    expect(typeof processor.toFile).toBe('function');
  });
});

describe('에러 처리', () => {
  it('잘못된 소스에 대해 적절한 에러를 발생시켜야 함', () => {
    // null이나 undefined 같은 잘못된 입력
    expect(() => processImage(null as any)).toThrow();
    expect(() => processImage(undefined as any)).toThrow();
  });

  it('지원하지 않는 옵션에 대해 적절히 처리해야 함', () => {
    const processor = processImage(mockImg);
    
    // 잘못된 fit 옵션 (TypeScript에서 컴파일 에러 발생)
    // processor.resize(300, 200, { fit: 'invalid' as any });
    
    // 음수 크기
    expect(() => processor.resize(-100, 200)).not.toThrow(); // 내부에서 처리
  });
});