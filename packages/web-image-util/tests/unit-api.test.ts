/**
 * processImage API 단위 테스트 (Node.js 환경)
 */

import { describe, it, expect } from 'vitest';
import { processImage, ImageProcessor, features, defaults } from '../src';

// Mock 이미지 소스
const mockImageSource = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('processImage API - 기본 구조', () => {
  describe('팩토리 함수', () => {
    it('processImage는 ImageProcessor 인스턴스를 반환해야 함', () => {
      const processor = processImage(mockImageSource);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('다양한 소스 타입을 받을 수 있어야 함', () => {
      // Data URL
      expect(() => processImage('data:image/png;base64,iVBOR...')).not.toThrow();
      
      // HTTP URL
      expect(() => processImage('https://example.com/image.jpg')).not.toThrow();
      
      // SVG XML
      expect(() => processImage('<svg><rect width="100" height="100"/></svg>')).not.toThrow();
      
      // 파일 경로
      expect(() => processImage('./image.jpg')).not.toThrow();
    });

    it('옵션과 함께 생성할 수 있어야 함', () => {
      const processor = processImage(mockImageSource, {
        crossOrigin: 'use-credentials',
        defaultQuality: 0.9,
      });
      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('메서드 체이닝 구조', () => {
    it('resize 메서드는 this를 반환하여 체이닝이 가능해야 함', () => {
      const processor = processImage(mockImageSource);
      const result = processor.resize(200, 150);
      expect(result).toBe(processor);
    });

    it('blur 메서드는 this를 반환하여 체이닝이 가능해야 함', () => {
      const processor = processImage(mockImageSource);
      const result = processor.blur(2);
      expect(result).toBe(processor);
    });

    it('여러 메서드를 연속으로 체이닝할 수 있어야 함', () => {
      const processor = processImage(mockImageSource);
      const result = processor.resize(200, 150).blur(2);
      expect(result).toBe(processor);
      
      // 더 복잡한 체이닝
      const result2 = processor
        .resize(300, 200, { fit: 'contain' })
        .blur(1)
        .resize(100, 100); // 두 번째 resize (마지막 것만 적용됨)
      expect(result2).toBe(processor);
    });
  });

  describe('메서드 파라미터 검증', () => {
    let processor: ImageProcessor;

    beforeEach(() => {
      processor = processImage(mockImageSource);
    });

    it('resize - 기본 파라미터', () => {
      expect(() => processor.resize(200, 150)).not.toThrow();
    });

    it('resize - 너비만 지정', () => {
      expect(() => processor.resize(200)).not.toThrow();
    });

    it('resize - 높이만 지정', () => {
      expect(() => processor.resize(undefined, 150)).not.toThrow();
    });

    it('resize - 다양한 fit 옵션', () => {
      expect(() => processor.resize(200, 150, { fit: 'cover' })).not.toThrow();
      expect(() => processor.resize(200, 150, { fit: 'contain' })).not.toThrow();
      expect(() => processor.resize(200, 150, { fit: 'fill' })).not.toThrow();
      expect(() => processor.resize(200, 150, { fit: 'inside' })).not.toThrow();
      expect(() => processor.resize(200, 150, { fit: 'outside' })).not.toThrow();
    });

    it('resize - 고급 옵션들', () => {
      expect(() => processor.resize(200, 150, {
        fit: 'contain',
        position: 'top',
        background: '#ffffff',
        withoutEnlargement: true,
        withoutReduction: false,
      })).not.toThrow();
    });

    it('blur - 기본 파라미터', () => {
      expect(() => processor.blur()).not.toThrow();
    });

    it('blur - 사용자 정의 반지름', () => {
      expect(() => processor.blur(5)).not.toThrow();
      expect(() => processor.blur(0)).not.toThrow();
      expect(() => processor.blur(100)).not.toThrow();
    });

    it('blur - 고급 옵션', () => {
      expect(() => processor.blur(5, {
        precision: 2,
        minAmplitude: 0.5,
      })).not.toThrow();
    });
  });
});

describe('타입 시스템', () => {
  it('ResizeFit 타입이 올바른 값들을 허용해야 함', () => {
    const processor = processImage(mockImageSource);
    
    // 컴파일 타임에 체크되는 타입들
    expect(() => processor.resize(100, 100, { fit: 'cover' })).not.toThrow();
    expect(() => processor.resize(100, 100, { fit: 'contain' })).not.toThrow();
    expect(() => processor.resize(100, 100, { fit: 'fill' })).not.toThrow();
    expect(() => processor.resize(100, 100, { fit: 'inside' })).not.toThrow();
    expect(() => processor.resize(100, 100, { fit: 'outside' })).not.toThrow();
  });

  it('ResizePosition 타입이 올바른 값들을 허용해야 함', () => {
    const processor = processImage(mockImageSource);
    
    // 문자열 위치
    expect(() => processor.resize(100, 100, { position: 'center' })).not.toThrow();
    expect(() => processor.resize(100, 100, { position: 'top' })).not.toThrow();
    expect(() => processor.resize(100, 100, { position: 'bottom left' })).not.toThrow();
    
    // 숫자 위치 (백분율)
    expect(() => processor.resize(100, 100, { position: 50 })).not.toThrow();
    
    // 객체 위치
    expect(() => processor.resize(100, 100, { position: { x: 25, y: 75 } })).not.toThrow();
  });

  it('BackgroundColor 타입이 올바른 값들을 허용해야 함', () => {
    const processor = processImage(mockImageSource);
    
    // CSS 색상 문자열
    expect(() => processor.resize(100, 100, { background: '#ffffff' })).not.toThrow();
    expect(() => processor.resize(100, 100, { background: 'red' })).not.toThrow();
    expect(() => processor.resize(100, 100, { background: 'rgb(255,0,0)' })).not.toThrow();
    
    // RGBA 객체
    expect(() => processor.resize(100, 100, { 
      background: { r: 255, g: 255, b: 255, alpha: 0.5 } 
    })).not.toThrow();
    
    // RGB 객체 (alpha 선택적)
    expect(() => processor.resize(100, 100, { 
      background: { r: 255, g: 255, b: 255 } 
    })).not.toThrow();
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

  it('Node.js 환경에서는 브라우저 기능이 false여야 함', () => {
    // Node.js에서는 대부분 false일 것
    expect(typeof features.webp).toBe('boolean');
    expect(typeof features.avif).toBe('boolean');
    expect(features.offscreenCanvas).toBe(false);
    expect(features.imageBitmap).toBe(false);
  });
});

describe('defaults 객체', () => {
  it('기본 설정값들을 제공해야 함', () => {
    expect(defaults).toHaveProperty('quality');
    expect(defaults).toHaveProperty('fit');
    expect(defaults).toHaveProperty('background');
    expect(defaults).toHaveProperty('blurRadius');
    expect(defaults).toHaveProperty('format');
    
    expect(defaults.quality).toBe(0.8);
    expect(defaults.fit).toBe('cover');
    expect(defaults.blurRadius).toBe(2);
    expect(defaults.format).toBe('png');
    expect(defaults.background).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
  });
});

describe('에러 처리 구조', () => {
  it('생성자 단계에서는 에러가 발생하지 않아야 함', () => {
    // processImage는 lazy evaluation - 실제 처리시에만 에러 발생
    expect(() => processImage('invalid-source')).not.toThrow();
    expect(() => processImage('')).not.toThrow();
    
    // null/undefined는 타입 에러이므로 런타임에서 체크
    // 실제로는 executeProcessing 단계에서 에러 발생
  });

  it('메서드 체이닝은 에러를 발생시키지 않아야 함', () => {
    const processor = processImage('some-source');
    
    // 체이닝 자체는 에러가 없어야 함
    expect(() => processor.resize(-100, -200)).not.toThrow();
    expect(() => processor.blur(-5)).not.toThrow();
    
    // 실제 에러는 toBlob(), toDataURL() 등 실행 시점에 발생
  });
});

describe('API 사용 패턴', () => {
  it('Sharp와 유사한 API 패턴을 따라야 함', () => {
    // Sharp 패턴: sharp(input).resize(300, 200).blur(2).toFormat('webp')
    const processor = processImage(mockImageSource);
    
    expect(() => processor
      .resize(300, 200)
      .blur(2)
    ).not.toThrow();
    
    // 출력 메서드들이 존재해야 함
    expect(typeof processor.toBlob).toBe('function');
    expect(typeof processor.toDataURL).toBe('function');
    expect(typeof processor.toFile).toBe('function');
  });

  it('직관적인 기본값들을 사용해야 함', () => {
    const processor = processImage(mockImageSource);
    
    // 기본 리사이징은 cover fit (Sharp와 동일)
    expect(() => processor.resize(300, 200)).not.toThrow();
    
    // 기본 블러는 2px
    expect(() => processor.blur()).not.toThrow();
  });

  it('옵션을 통한 세밀한 제어가 가능해야 함', () => {
    const processor = processImage(mockImageSource, {
      defaultQuality: 0.9,
      defaultBackground: { r: 255, g: 255, b: 255, alpha: 1 },
    });
    
    expect(() => processor
      .resize(300, 200, {
        fit: 'contain',
        position: 'top left',
        withoutEnlargement: true,
      })
      .blur(1.5, {
        precision: 2,
        minAmplitude: 0.1,
      })
    ).not.toThrow();
  });
});