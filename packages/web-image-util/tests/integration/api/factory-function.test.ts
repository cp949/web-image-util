/**
 * processImage 팩토리 함수 통합 테스트
 * 다양한 소스 타입 및 옵션 처리 검증
 */

// @vitest-environment browser
import { describe, it, expect, beforeEach } from 'vitest';
import { processImage } from '../../../src/index';
import { isValidImageSource } from '../../../src/types/guards';
import {
  setupSuccessfulCanvasMocking,
  setupSuccessfulImageLoading,
  TEST_SOURCES,
  testWithAllSourceTypes,
  waitForImageLoad
} from '../../helpers/integration-helpers';

describe('processImage 팩토리 함수', () => {
  beforeEach(() => {
    setupSuccessfulCanvasMocking();
    setupSuccessfulImageLoading();
  });

  describe('소스 타입별 인스턴스 생성', () => {
    it('HTTP URL로 인스턴스 생성', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);
      expect(processor).toBeDefined();
      expect(typeof processor.resize).toBe('function');
    });

    it('HTTPS URL로 인스턴스 생성', () => {
      const processor = processImage(TEST_SOURCES.HTTPS_URL);
      expect(processor).toBeDefined();
      expect(typeof processor.toBlob).toBe('function');
    });

    it('Data URL로 인스턴스 생성', () => {
      const processor = processImage(TEST_SOURCES.DATA_URL);
      expect(processor).toBeDefined();
      expect(typeof processor.toDataURL).toBe('function');
    });

    it('SVG 문자열로 인스턴스 생성', () => {
      const processor = processImage(TEST_SOURCES.SVG_STRING);
      expect(processor).toBeDefined();
      expect(typeof processor.toFile).toBe('function');
    });

    it('Blob으로 인스턴스 생성', () => {
      const processor = processImage(TEST_SOURCES.BLOB);
      expect(processor).toBeDefined();
      expect(typeof processor.toCanvas).toBe('function');
    });

    it('HTMLImageElement로 인스턴스 생성', () => {
      // 모킹된 Image 엘리먼트 생성
      const img = new Image();
      img.src = TEST_SOURCES.HTTP_URL;

      const processor = processImage(img);
      expect(processor).toBeDefined();
      expect(typeof processor.blur).toBe('function');
    });

    it('모든 소스 타입이 정상 처리됨', () => {
      testWithAllSourceTypes((source, sourceName) => {
        expect(() => {
          const processor = processImage(source);
          expect(processor, `${sourceName} 처리 실패`).toBeDefined();
        }, `${sourceName} 테스트`).not.toThrow();
      });
    });
  });

  describe('소스 유효성 검증', () => {
    it('유효한 소스는 통과', () => {
      const validSources = [
        TEST_SOURCES.HTTP_URL,
        TEST_SOURCES.HTTPS_URL,
        TEST_SOURCES.DATA_URL,
        TEST_SOURCES.SVG_STRING,
        TEST_SOURCES.BLOB,
        'relative/path/image.jpg',
        '/absolute/path/image.png'
      ];

      validSources.forEach(source => {
        expect(() => processImage(source)).not.toThrow();
        expect(isValidImageSource(source)).toBe(true);
      });
    });

    it('무효한 소스는 에러 발생', () => {
      const invalidSources = [
        null,
        undefined,
        123,
        true,
        {},
        [],
        '',
        '   ', // 공백만 있는 문자열
      ];

      invalidSources.forEach(source => {
        expect(() => processImage(source as any)).toThrow();
        expect(isValidImageSource(source)).toBe(false);
      });
    });
  });

  describe('옵션 처리', () => {
    it('기본 옵션으로 생성', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);
      expect(processor).toBeDefined();
    });

    it('crossOrigin 옵션 설정', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL, {
        crossOrigin: 'anonymous'
      });
      expect(processor).toBeDefined();
    });

    it('기본 품질 설정', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL, {
        defaultQuality: 0.9
      });
      expect(processor).toBeDefined();
    });

    it('기본 배경색 설정', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL, {
        defaultBackground: { r: 255, g: 255, b: 255, alpha: 1 }
      });
      expect(processor).toBeDefined();
    });

    it('복합 옵션 설정', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL, {
        crossOrigin: 'use-credentials',
        defaultQuality: 0.85,
        defaultBackground: 'white'
      });
      expect(processor).toBeDefined();
    });

    it('빈 옵션 객체 처리', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL, {});
      expect(processor).toBeDefined();
    });
  });

  describe('타입 추론 및 반환 타입', () => {
    it('processImage 반환 타입이 ImageProcessor', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);

      // TypeScript 컴파일러가 타입을 올바르게 추론하는지 확인
      expect(processor.resize).toBeInstanceOf(Function);
      expect(processor.blur).toBeInstanceOf(Function);
      expect(processor.toBlob).toBeInstanceOf(Function);
      expect(processor.toDataURL).toBeInstanceOf(Function);
      expect(processor.toFile).toBeInstanceOf(Function);
      expect(processor.toCanvas).toBeInstanceOf(Function);
    });

    it('체이닝 메서드들의 반환 타입', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);

      const resized = processor.resize(100, 100);
      expect(resized).toBe(processor); // 같은 인스턴스

      const blurred = processor.blur(2);
      expect(blurred).toBe(processor); // 같은 인스턴스
    });

    it('최종 메서드들의 Promise 반환', async () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);
      await waitForImageLoad();

      const blobPromise = processor.toBlob();
      expect(blobPromise).toBeInstanceOf(Promise);

      const dataUrlPromise = processor.toDataURL();
      expect(dataUrlPromise).toBeInstanceOf(Promise);

      const filePromise = processor.toFile('test.jpg');
      expect(filePromise).toBeInstanceOf(Promise);

      const canvasPromise = processor.toCanvas();
      expect(canvasPromise).toBeInstanceOf(Promise);
    });
  });

  describe('메모리 관리', () => {
    it('다중 인스턴스 생성이 서로 독립적', () => {
      const processor1 = processImage(TEST_SOURCES.HTTP_URL);
      const processor2 = processImage(TEST_SOURCES.HTTPS_URL);

      expect(processor1).not.toBe(processor2);

      // 한 인스턴스의 변경이 다른 인스턴스에 영향을 주지 않음
      processor1.resize(100, 100);
      processor2.resize(200, 200);

      expect(processor1).not.toBe(processor2);
    });

    it('동일 소스로 여러 인스턴스 생성 가능', () => {
      const source = TEST_SOURCES.HTTP_URL;
      const processor1 = processImage(source);
      const processor2 = processImage(source);

      expect(processor1).not.toBe(processor2);
      expect(processor1).toBeInstanceOf(Object);
      expect(processor2).toBeInstanceOf(Object);
    });
  });

  describe('소스별 특수 처리', () => {
    it('상대 경로 URL 처리', () => {
      const relativePath = './images/test.jpg';
      expect(() => processImage(relativePath)).not.toThrow();
    });

    it('절대 경로 URL 처리', () => {
      const absolutePath = '/images/test.jpg';
      expect(() => processImage(absolutePath)).not.toThrow();
    });

    it('복잡한 SVG 문자열 처리', () => {
      const complexSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
            </linearGradient>
          </defs>
          <ellipse cx="100" cy="100" rx="80" ry="40" fill="url(#grad1)" />
        </svg>
      `;

      expect(() => processImage(complexSvg)).not.toThrow();
    });

    it('큰 Data URL 처리', () => {
      const longDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
      expect(() => processImage(longDataUrl)).not.toThrow();
    });

    it('다양한 MIME 타입의 Blob 처리', () => {
      const mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      mimeTypes.forEach(mimeType => {
        const blob = new Blob(['fake-data'], { type: mimeType });
        expect(() => processImage(blob)).not.toThrow();
      });
    });
  });

  describe('에러 메시지 품질', () => {
    it('null 소스에 대한 명확한 에러 메시지', () => {
      expect(() => processImage(null as any)).toThrow(/유효한 이미지 소스/);
    });

    it('undefined 소스에 대한 명확한 에러 메시지', () => {
      expect(() => processImage(undefined as any)).toThrow(/유효한 이미지 소스/);
    });

    it('숫자 타입에 대한 명확한 에러 메시지', () => {
      expect(() => processImage(123 as any)).toThrow(/유효한 이미지 소스/);
    });

    it('빈 문자열에 대한 명확한 에러 메시지', () => {
      expect(() => processImage('')).toThrow(/유효한 이미지 소스/);
    });
  });
});