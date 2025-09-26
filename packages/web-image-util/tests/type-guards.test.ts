/**
 * 타입 가드 함수들 테스트
 * 
 * @description 런타임 타입 검증 함수들의 정확성과 
 * TypeScript 타입 narrowing 기능을 검증하는 테스트
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  isImageElement,
  isCanvasElement,
  isBlob,
  isFile,
  isDataURL,
  isHttpURL,
  isSVGString,
  isValidImageSource,
  isValidResizeFit,
  isValidResizePosition,
  isValidBackgroundColor,
  isValidImageFormat,
  isValidQuality,
  isValidDimension,
  validateResizeOptions,
  validateOutputOptions,
  assertImageSource,
  assertPositiveInteger,
  assertQuality,
} from '../src/types/guards';

// 테스트용 객체들 생성
async function createTestObjects() {
  // HTMLImageElement 생성
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  });

  // HTMLCanvasElement 생성
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;

  // Blob 생성
  const blob = new Blob(['test'], { type: 'image/png' });

  // File 생성
  const file = new File(['test'], 'test.png', { type: 'image/png' });

  return { img, canvas, blob, file };
}

describe('기본 타입 가드 함수들', () => {
  let testObjects: Awaited<ReturnType<typeof createTestObjects>>;
  
  beforeAll(async () => {
    testObjects = await createTestObjects();
  });

  describe('isImageElement', () => {
    it('HTMLImageElement 감지', () => {
      expect(isImageElement(testObjects.img)).toBe(true);
    });

    it('다른 타입들은 false', () => {
      expect(isImageElement(testObjects.canvas)).toBe(false);
      expect(isImageElement(testObjects.blob)).toBe(false);
      expect(isImageElement('test')).toBe(false);
      expect(isImageElement(null)).toBe(false);
      expect(isImageElement(undefined)).toBe(false);
      expect(isImageElement({})).toBe(false);
    });
  });

  describe('isCanvasElement', () => {
    it('HTMLCanvasElement 감지', () => {
      expect(isCanvasElement(testObjects.canvas)).toBe(true);
    });

    it('다른 타입들은 false', () => {
      expect(isCanvasElement(testObjects.img)).toBe(false);
      expect(isCanvasElement(testObjects.blob)).toBe(false);
      expect(isCanvasElement('canvas')).toBe(false);
      expect(isCanvasElement({})).toBe(false);
    });
  });

  describe('isBlob', () => {
    it('Blob 감지', () => {
      expect(isBlob(testObjects.blob)).toBe(true);
    });

    it('File도 Blob의 서브클래스로 감지', () => {
      expect(isBlob(testObjects.file)).toBe(true);
    });

    it('다른 타입들은 false', () => {
      expect(isBlob(testObjects.img)).toBe(false);
      expect(isBlob('blob')).toBe(false);
      expect(isBlob({})).toBe(false);
    });
  });

  describe('isFile', () => {
    it('File 감지', () => {
      expect(isFile(testObjects.file)).toBe(true);
    });

    it('일반 Blob은 File이 아님', () => {
      expect(isFile(testObjects.blob)).toBe(false);
    });

    it('다른 타입들은 false', () => {
      expect(isFile('file')).toBe(false);
      expect(isFile({})).toBe(false);
    });
  });
});

describe('문자열 타입 가드 함수들', () => {
  describe('isDataURL', () => {
    it('유효한 Data URL 감지', () => {
      expect(isDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')).toBe(true);
      expect(isDataURL('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD')).toBe(true);
      expect(isDataURL('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ')).toBe(true);
    });

    it('유효하지 않은 Data URL은 false', () => {
      expect(isDataURL('data:text/plain;base64,dGVzdA==')).toBe(false);
      expect(isDataURL('http://example.com/image.png')).toBe(false);
      expect(isDataURL('image.png')).toBe(false);
      expect(isDataURL('')).toBe(false);
      expect(isDataURL(null)).toBe(false);
      expect(isDataURL(123)).toBe(false);
    });
  });

  describe('isHttpURL', () => {
    it('유효한 HTTP/HTTPS URL 감지', () => {
      expect(isHttpURL('http://example.com/image.png')).toBe(true);
      expect(isHttpURL('https://example.com/photo.jpg')).toBe(true);
      expect(isHttpURL('https://cdn.example.com/assets/image.webp?v=1')).toBe(true);
    });

    it('다른 프로토콜이나 유효하지 않은 URL은 false', () => {
      expect(isHttpURL('ftp://example.com/file.png')).toBe(false);
      expect(isHttpURL('file:///path/to/image.png')).toBe(false);
      expect(isHttpURL('data:image/png;base64,xyz')).toBe(false);
      expect(isHttpURL('relative/path.png')).toBe(false);
      expect(isHttpURL('/absolute/path.png')).toBe(false);
      expect(isHttpURL('not-a-url')).toBe(false);
      expect(isHttpURL('')).toBe(false);
      expect(isHttpURL(null)).toBe(false);
    });
  });

  describe('isSVGString', () => {
    it('유효한 SVG 문자열 감지', () => {
      expect(isSVGString('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>')).toBe(true);
      expect(isSVGString('<svg><circle cx="50" cy="50" r="40"/></svg>')).toBe(true);
      expect(isSVGString('  <svg>  <path d="M10 10 L90 90"/>  </svg>  ')).toBe(true);
    });

    it('유효하지 않은 SVG 문자열은 false', () => {
      expect(isSVGString('<div><svg></svg></div>')).toBe(false);
      expect(isSVGString('<svg><rect/>')).toBe(false); // 닫는 태그 없음
      expect(isSVGString('svg content')).toBe(false);
      expect(isSVGString('')).toBe(false);
      expect(isSVGString(null)).toBe(false);
      expect(isSVGString(123)).toBe(false);
    });
  });
});

describe('복합 타입 가드 함수들', () => {
  let testObjects: Awaited<ReturnType<typeof createTestObjects>>;
  
  beforeAll(async () => {
    testObjects = await createTestObjects();
  });

  describe('isValidImageSource', () => {
    it('모든 유효한 이미지 소스 감지', () => {
      expect(isValidImageSource(testObjects.img)).toBe(true);
      expect(isValidImageSource(testObjects.blob)).toBe(true);
      expect(isValidImageSource('data:image/png;base64,xyz')).toBe(true);
      expect(isValidImageSource('http://example.com/image.png')).toBe(true);
      expect(isValidImageSource('https://example.com/image.jpg')).toBe(true);
      expect(isValidImageSource('<svg><rect/></svg>')).toBe(true);
      expect(isValidImageSource('relative/path/image.png')).toBe(true);
      expect(isValidImageSource('/absolute/path/image.jpg')).toBe(true);
    });

    it('유효하지 않은 소스는 false', () => {
      expect(isValidImageSource(null)).toBe(false);
      expect(isValidImageSource(undefined)).toBe(false);
      expect(isValidImageSource('')).toBe(false);
      expect(isValidImageSource(123)).toBe(false);
      expect(isValidImageSource({})).toBe(false);
      expect(isValidImageSource([])).toBe(false);
    });
  });

  describe('isValidResizeFit', () => {
    it('유효한 fit 값들 감지', () => {
      expect(isValidResizeFit('cover')).toBe(true);
      expect(isValidResizeFit('contain')).toBe(true);
      expect(isValidResizeFit('fill')).toBe(true);
      expect(isValidResizeFit('inside')).toBe(true);
      expect(isValidResizeFit('outside')).toBe(true);
    });

    it('유효하지 않은 fit 값은 false', () => {
      expect(isValidResizeFit('contain')).toBe(false);
      expect(isValidResizeFit('fill')).toBe(false);
      expect(isValidResizeFit('inside')).toBe(false);
      expect(isValidResizeFit('outside')).toBe(false);
      expect(isValidResizeFit('crop')).toBe(false);
      expect(isValidResizeFit('')).toBe(false);
      expect(isValidResizeFit(null)).toBe(false);
      expect(isValidResizeFit(123)).toBe(false);
    });
  });

  describe('isValidResizePosition', () => {
    it('문자열 위치값들 감지', () => {
      expect(isValidResizePosition('center')).toBe(true);
      expect(isValidResizePosition('top')).toBe(true);
      expect(isValidResizePosition('bottom left')).toBe(true);
      expect(isValidResizePosition('northeast')).toBe(true);
    });

    it('숫자 위치값들 감지 (0-100)', () => {
      expect(isValidResizePosition(0)).toBe(true);
      expect(isValidResizePosition(50)).toBe(true);
      expect(isValidResizePosition(100)).toBe(true);
    });

    it('객체 위치값들 감지', () => {
      expect(isValidResizePosition({ x: 50, y: 50 })).toBe(true);
      expect(isValidResizePosition({ x: 0, y: 100 })).toBe(true);
    });

    it('유효하지 않은 위치값은 false', () => {
      expect(isValidResizePosition('invalid')).toBe(false);
      expect(isValidResizePosition(-1)).toBe(false);
      expect(isValidResizePosition(101)).toBe(false);
      expect(isValidResizePosition({ x: -1, y: 50 })).toBe(false);
      expect(isValidResizePosition({ x: 50, y: 101 })).toBe(false);
      expect(isValidResizePosition({ x: 50 })).toBe(false); // y 누락
    });
  });

  describe('isValidBackgroundColor', () => {
    it('CSS 색상 문자열 감지', () => {
      expect(isValidBackgroundColor('#ffffff')).toBe(true);
      expect(isValidBackgroundColor('#fff')).toBe(true);
      expect(isValidBackgroundColor('red')).toBe(true);
      expect(isValidBackgroundColor('rgb(255, 0, 0)')).toBe(true);
      expect(isValidBackgroundColor('rgba(255, 0, 0, 0.5)')).toBe(true);
      expect(isValidBackgroundColor('transparent')).toBe(true);
    });

    it('RGB 객체 형식 감지', () => {
      expect(isValidBackgroundColor({ r: 255, g: 0, b: 0 })).toBe(true);
      expect(isValidBackgroundColor({ r: 0, g: 255, b: 0, alpha: 0.5 })).toBe(true);
    });

    it('유효하지 않은 색상은 false', () => {
      expect(isValidBackgroundColor({ r: 256, g: 0, b: 0 })).toBe(false); // r > 255
      expect(isValidBackgroundColor({ r: 255, g: -1, b: 0 })).toBe(false); // g < 0
      expect(isValidBackgroundColor({ r: 255, g: 0 })).toBe(false); // b 누락
      expect(isValidBackgroundColor({ r: 255, g: 0, b: 0, alpha: 2 })).toBe(false); // alpha > 1
      expect(isValidBackgroundColor(123)).toBe(false);
      expect(isValidBackgroundColor(null)).toBe(false);
    });
  });
});

describe('값 범위 검증 함수들', () => {
  describe('isValidImageFormat', () => {
    it('지원되는 포맷들 감지', () => {
      expect(isValidImageFormat('jpeg')).toBe(true);
      expect(isValidImageFormat('jpg')).toBe(true);
      expect(isValidImageFormat('png')).toBe(true);
      expect(isValidImageFormat('webp')).toBe(true);
      expect(isValidImageFormat('avif')).toBe(true);
      expect(isValidImageFormat('gif')).toBe(true);
      expect(isValidImageFormat('tiff')).toBe(true);
      expect(isValidImageFormat('bmp')).toBe(true);
    });

    it('대소문자 구분 없이 감지', () => {
      expect(isValidImageFormat('JPEG')).toBe(true);
      expect(isValidImageFormat('PNG')).toBe(true);
      expect(isValidImageFormat('WebP')).toBe(true);
    });

    it('지원되지 않는 포맷은 false', () => {
      expect(isValidImageFormat('svg')).toBe(false);
      expect(isValidImageFormat('raw')).toBe(false);
      expect(isValidImageFormat('pdf')).toBe(false);
      expect(isValidImageFormat('')).toBe(false);
      expect(isValidImageFormat(null)).toBe(false);
    });
  });

  describe('isValidQuality', () => {
    it('유효한 품질 값들 (0.0-1.0) 감지', () => {
      expect(isValidQuality(0.0)).toBe(true);
      expect(isValidQuality(0.5)).toBe(true);
      expect(isValidQuality(0.8)).toBe(true);
      expect(isValidQuality(1.0)).toBe(true);
    });

    it('유효하지 않은 품질 값은 false', () => {
      expect(isValidQuality(-0.1)).toBe(false);
      expect(isValidQuality(1.1)).toBe(false);
      expect(isValidQuality(NaN)).toBe(false);
      expect(isValidQuality('0.5')).toBe(false);
      expect(isValidQuality(null)).toBe(false);
    });
  });

  describe('isValidDimension', () => {
    it('양의 정수들 감지', () => {
      expect(isValidDimension(1)).toBe(true);
      expect(isValidDimension(100)).toBe(true);
      expect(isValidDimension(1920)).toBe(true);
      expect(isValidDimension(4096)).toBe(true);
    });

    it('유효하지 않은 차원값은 false', () => {
      expect(isValidDimension(0)).toBe(false);
      expect(isValidDimension(-1)).toBe(false);
      expect(isValidDimension(1.5)).toBe(false);
      expect(isValidDimension(NaN)).toBe(false);
      expect(isValidDimension('100')).toBe(false);
      expect(isValidDimension(null)).toBe(false);
    });
  });
});

describe('옵션 검증 함수들', () => {
  describe('validateResizeOptions', () => {
    it('유효한 옵션들 통과', () => {
      const result = validateResizeOptions({
        width: 300,
        height: 200,
        fit: 'cover',
        position: 'center',
        background: '#ffffff'
      });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('잘못된 옵션들 감지', () => {
      const result = validateResizeOptions({
        width: -100,
        height: 'invalid',
        fit: 'fill',
        position: 'invalid',
        background: 'not-a-color'
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('width'))).toBe(true);
      expect(result.errors.some(err => err.includes('height'))).toBe(true);
      expect(result.errors.some(err => err.includes('fit'))).toBe(true);
    });

    it('경고 메시지 생성', () => {
      const result = validateResizeOptions({
        width: 8000,
        height: 6000
      });
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(warn => warn.includes('큰 이미지'))).toBe(true);
    });
  });

  describe('validateOutputOptions', () => {
    it('유효한 출력 옵션들 통과', () => {
      const result = validateOutputOptions({
        format: 'jpeg',
        quality: 0.8,
        fallbackFormat: 'png'
      });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('잘못된 출력 옵션들 감지', () => {
      const result = validateOutputOptions({
        format: 'invalid',
        quality: 1.5,
        fallbackFormat: 'unknown'
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('PNG 품질 설정 경고', () => {
      const result = validateOutputOptions({
        format: 'png',
        quality: 0.5
      });
      
      expect(result.warnings.some(warn => warn.includes('PNG'))).toBe(true);
    });
  });
});

describe('어설션 함수들', () => {
  let testObjects: Awaited<ReturnType<typeof createTestObjects>>;
  
  beforeAll(async () => {
    testObjects = await createTestObjects();
  });

  describe('assertImageSource', () => {
    it('유효한 소스는 통과', () => {
      expect(() => assertImageSource(testObjects.img)).not.toThrow();
      expect(() => assertImageSource(testObjects.blob)).not.toThrow();
      expect(() => assertImageSource('http://example.com/image.png')).not.toThrow();
    });

    it('유효하지 않은 소스는 TypeError 발생', () => {
      expect(() => assertImageSource(null)).toThrow(TypeError);
      expect(() => assertImageSource(123)).toThrow(TypeError);
      expect(() => assertImageSource({})).toThrow(TypeError);
    });

    it('커스텀 매개변수명 사용', () => {
      expect(() => assertImageSource(null, 'imageData')).toThrow(/imageData/);
    });
  });

  describe('assertPositiveInteger', () => {
    it('양의 정수는 통과', () => {
      expect(() => assertPositiveInteger(1)).not.toThrow();
      expect(() => assertPositiveInteger(100)).not.toThrow();
      expect(() => assertPositiveInteger(1920)).not.toThrow();
    });

    it('유효하지 않은 값은 TypeError 발생', () => {
      expect(() => assertPositiveInteger(0)).toThrow(TypeError);
      expect(() => assertPositiveInteger(-1)).toThrow(TypeError);
      expect(() => assertPositiveInteger(1.5)).toThrow(TypeError);
      expect(() => assertPositiveInteger('100')).toThrow(TypeError);
    });
  });

  describe('assertQuality', () => {
    it('유효한 품질값은 통과', () => {
      expect(() => assertQuality(0.0)).not.toThrow();
      expect(() => assertQuality(0.5)).not.toThrow();
      expect(() => assertQuality(1.0)).not.toThrow();
    });

    it('유효하지 않은 품질값은 TypeError 발생', () => {
      expect(() => assertQuality(-0.1)).toThrow(TypeError);
      expect(() => assertQuality(1.5)).toThrow(TypeError);
      expect(() => assertQuality('0.8')).toThrow(TypeError);
    });
  });
});

describe('TypeScript 타입 narrowing', () => {
  it('타입 가드 후 타입이 좁혀짐', () => {
    const unknownValue: unknown = new Image();
    
    if (isImageElement(unknownValue)) {
      // 이 블록 내에서 unknownValue는 HTMLImageElement 타입
      expect(unknownValue.src).toBeDefined();
      expect(unknownValue.width).toBeGreaterThanOrEqual(0);
    }
  });

  it('isValidImageSource 후 ImageSource 타입으로 narrowing', () => {
    const userInput: unknown = 'http://example.com/image.png';
    
    if (isValidImageSource(userInput)) {
      // 이 블록 내에서 userInput은 ImageSource 타입
      // 컴파일러가 HTMLImageElement | Blob | string 중 하나로 인식
      expect(typeof userInput === 'string' || 
             userInput instanceof HTMLImageElement || 
             userInput instanceof Blob).toBe(true);
    }
  });
});