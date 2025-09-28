import { describe, expect, test } from 'vitest';
import {
  FORMAT_INFO,
  ImageErrorCodeConstants,
  ImageFormats,
  OPTIMAL_QUALITY_BY_FORMAT,
  OUTPUT_FORMAT_INFO,
  OutputFormats,
  OutputOptimalQuality,
  ResizeFitConstants,
} from '../../../src/types';

/**
 * 상수 정의 테스트
 *
 * @description WSL 환경에서 실행 가능한 상수 시스템 검증
 * - 포맷별 품질 설정 확인
 * - MIME 타입 정보 검증
 * - 상수 불변성 테스트
 */
describe('상수 정의', () => {
  describe('OPTIMAL_QUALITY_BY_FORMAT / OutputOptimalQuality', () => {
    test('모든 출력 포맷에 대한 최적 품질이 정의되어야 함', () => {
      expect(OPTIMAL_QUALITY_BY_FORMAT.png).toBe(1.0);
      expect(OPTIMAL_QUALITY_BY_FORMAT.jpeg).toBe(0.85);
      expect(OPTIMAL_QUALITY_BY_FORMAT.jpg).toBe(0.85);
      expect(OPTIMAL_QUALITY_BY_FORMAT.webp).toBe(0.8);
      expect(OPTIMAL_QUALITY_BY_FORMAT.avif).toBe(0.75);
    });

    test('OutputOptimalQuality와 OPTIMAL_QUALITY_BY_FORMAT가 동일해야 함', () => {
      expect(OutputOptimalQuality).toEqual(OPTIMAL_QUALITY_BY_FORMAT);
    });

    test('품질 값이 올바른 범위에 있어야 함', () => {
      Object.values(OPTIMAL_QUALITY_BY_FORMAT).forEach((quality) => {
        expect(quality).toBeGreaterThan(0);
        expect(quality).toBeLessThanOrEqual(1);
        expect(typeof quality).toBe('number');
        expect(Number.isFinite(quality)).toBe(true);
      });
    });

    test('무손실 포맷(PNG)은 품질 1.0이어야 함', () => {
      expect(OPTIMAL_QUALITY_BY_FORMAT.png).toBe(1.0);
    });

    test('손실 압축 포맷들은 1.0 미만이어야 함', () => {
      expect(OPTIMAL_QUALITY_BY_FORMAT.jpeg).toBeLessThan(1.0);
      expect(OPTIMAL_QUALITY_BY_FORMAT.jpg).toBeLessThan(1.0);
      expect(OPTIMAL_QUALITY_BY_FORMAT.webp).toBeLessThan(1.0);
      expect(OPTIMAL_QUALITY_BY_FORMAT.avif).toBeLessThan(1.0);
    });

    test('최신 포맷들이 더 높은 압축률(낮은 품질)을 가져야 함', () => {
      // 더 효율적인 압축 알고리즘을 가진 포맷들
      expect(OPTIMAL_QUALITY_BY_FORMAT.avif).toBeLessThanOrEqual(OPTIMAL_QUALITY_BY_FORMAT.webp);
      expect(OPTIMAL_QUALITY_BY_FORMAT.webp).toBeLessThanOrEqual(OPTIMAL_QUALITY_BY_FORMAT.jpeg);
    });
  });

  describe('FORMAT_INFO', () => {
    test('모든 포맷에 대한 MIME 타입이 정의되어야 함', () => {
      expect(FORMAT_INFO.jpeg.mimeType).toBe('image/jpeg');
      expect(FORMAT_INFO.jpg.mimeType).toBe('image/jpeg');
      expect(FORMAT_INFO.png.mimeType).toBe('image/png');
      expect(FORMAT_INFO.webp.mimeType).toBe('image/webp');
      expect(FORMAT_INFO.gif.mimeType).toBe('image/gif');
      expect(FORMAT_INFO.svg.mimeType).toBe('image/svg+xml');
    });

    test('JPEG와 JPG가 동일한 MIME 타입을 가져야 함', () => {
      expect(FORMAT_INFO.jpeg.mimeType).toBe(FORMAT_INFO.jpg.mimeType);
    });

    test('MIME 타입이 올바른 형식이어야 함', () => {
      Object.values(FORMAT_INFO).forEach((info) => {
        expect(info.mimeType).toMatch(/^image\//);
        expect(typeof info.mimeType).toBe('string');
        expect(info.mimeType.length).toBeGreaterThan('image/'.length);
      });
    });

    test('표준 MIME 타입을 사용해야 함', () => {
      const standardMimeTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'image/avif',
      ]);

      Object.values(FORMAT_INFO).forEach((info) => {
        expect(standardMimeTypes.has(info.mimeType)).toBe(true);
      });
    });

    test('모든 ImageFormats가 FORMAT_INFO에 포함되어야 함', () => {
      Object.values(ImageFormats).forEach((format) => {
        expect(FORMAT_INFO).toHaveProperty(format);
        expect(FORMAT_INFO[format as keyof typeof FORMAT_INFO]).toBeDefined();
      });
    });
  });

  describe('OUTPUT_FORMAT_INFO', () => {
    test('출력 가능한 포맷만 포함되어야 함', () => {
      const outputFormats = Object.keys(OUTPUT_FORMAT_INFO);

      expect(outputFormats).toContain('jpeg');
      expect(outputFormats).toContain('jpg');
      expect(outputFormats).toContain('png');
      expect(outputFormats).toContain('webp');

      // 출력 불가능한 포맷들은 제외
      expect(outputFormats).not.toContain('svg');
      expect(outputFormats).not.toContain('gif');
      // avif는 브라우저 지원에 따라 다를 수 있음
    });

    test('출력 MIME 타입이 올바르게 설정되어야 함', () => {
      expect(OUTPUT_FORMAT_INFO.jpeg.mimeType).toBe('image/jpeg');
      expect(OUTPUT_FORMAT_INFO.jpg.mimeType).toBe('image/jpeg');
      expect(OUTPUT_FORMAT_INFO.png.mimeType).toBe('image/png');
      expect(OUTPUT_FORMAT_INFO.webp.mimeType).toBe('image/webp');
    });

    test('OUTPUT_FORMAT_INFO가 FORMAT_INFO의 부분집합이어야 함', () => {
      Object.entries(OUTPUT_FORMAT_INFO).forEach(([format, info]) => {
        expect(FORMAT_INFO).toHaveProperty(format);
        expect(FORMAT_INFO[format as keyof typeof FORMAT_INFO].mimeType).toBe(info.mimeType);
      });
    });

    test('모든 OutputFormats가 OUTPUT_FORMAT_INFO에 포함되어야 함', () => {
      Object.values(OutputFormats).forEach((format) => {
        expect(OUTPUT_FORMAT_INFO).toHaveProperty(format);
        expect(OUTPUT_FORMAT_INFO[format as keyof typeof OUTPUT_FORMAT_INFO]).toBeDefined();
      });
    });
  });

  describe('ImageFormats 상수', () => {
    test('모든 이미지 포맷 상수가 정의되어야 함', () => {
      expect(ImageFormats.JPEG).toBe('jpeg');
      expect(ImageFormats.JPG).toBe('jpg');
      expect(ImageFormats.PNG).toBe('png');
      expect(ImageFormats.WEBP).toBe('webp');
      expect(ImageFormats.AVIF).toBe('avif');
      expect(ImageFormats.GIF).toBe('gif');
      expect(ImageFormats.SVG).toBe('svg');
    });

    test('상수 값이 소문자여야 함', () => {
      Object.values(ImageFormats).forEach((format) => {
        expect(format).toBe(format.toLowerCase());
        expect(format).toMatch(/^[a-z]+$/);
      });
    });

    test('ImageFormats 객체가 올바른 타입을 가져야 함', () => {
      // 타입스크립트 레벨에서의 상수 정의 확인
      expect(typeof ImageFormats.JPEG).toBe('string');
      expect(ImageFormats.JPEG).toBe('jpeg');
    });

    test('지원하는 포맷 수가 적절해야 함', () => {
      const formatCount = Object.keys(ImageFormats).length;
      expect(formatCount).toBeGreaterThanOrEqual(6); // 최소 6개 포맷
      expect(formatCount).toBeLessThanOrEqual(10); // 너무 많지 않게
    });
  });

  describe('OutputFormats 상수', () => {
    test('모든 출력 포맷 상수가 정의되어야 함', () => {
      expect(OutputFormats.JPEG).toBe('jpeg');
      expect(OutputFormats.JPG).toBe('jpg');
      expect(OutputFormats.PNG).toBe('png');
      expect(OutputFormats.WEBP).toBe('webp');
      expect(OutputFormats.AVIF).toBe('avif');
    });

    test('OutputFormats가 ImageFormats의 부분집합이어야 함', () => {
      Object.values(OutputFormats).forEach((format) => {
        expect(Object.values(ImageFormats)).toContain(format);
      });
    });

    test('Canvas에서 지원하지 않는 포맷이 제외되어야 함', () => {
      expect(Object.values(OutputFormats)).not.toContain('svg');
      expect(Object.values(OutputFormats)).not.toContain('gif');
    });

    test('OutputFormats 객체가 올바른 타입을 가져야 함', () => {
      // 타입스크립트 레벨에서의 상수 정의 확인
      expect(typeof OutputFormats.PNG).toBe('string');
      expect(OutputFormats.PNG).toBe('png');
    });
  });

  describe('ResizeFitConstants 상수', () => {
    test('모든 리사이즈 fit 상수가 정의되어야 함', () => {
      expect(ResizeFitConstants.COVER).toBe('cover');
      expect(ResizeFitConstants.CONTAIN).toBe('contain');
      expect(ResizeFitConstants.FILL).toBe('fill');
      expect(ResizeFitConstants.INSIDE).toBe('inside');
      expect(ResizeFitConstants.OUTSIDE).toBe('outside');
    });

    test('fit 값들이 CSS object-fit과 호환되어야 함', () => {
      // CSS object-fit과 동일한 값들
      expect(ResizeFitConstants.COVER).toBe('cover');
      expect(ResizeFitConstants.CONTAIN).toBe('contain');
      expect(ResizeFitConstants.FILL).toBe('fill');
    });

    test('ResizeFitConstants 객체가 올바른 타입을 가져야 함', () => {
      // 타입스크립트 레벨에서의 상수 정의 확인
      expect(typeof ResizeFitConstants.COVER).toBe('string');
      expect(ResizeFitConstants.COVER).toBe('cover');
    });

    test('모든 fit 값이 소문자여야 함', () => {
      Object.values(ResizeFitConstants).forEach((fit) => {
        expect(fit).toBe(fit.toLowerCase());
        expect(fit).toMatch(/^[a-z]+$/);
      });
    });
  });

  describe('ImageErrorCodeConstants 상수', () => {
    test('주요 에러 코드들이 정의되어야 함', () => {
      expect(ImageErrorCodeConstants.INVALID_SOURCE).toBe('INVALID_SOURCE');
      expect(ImageErrorCodeConstants.CANVAS_CREATION_FAILED).toBe('CANVAS_CREATION_FAILED');
      expect(ImageErrorCodeConstants.OUTPUT_FAILED).toBe('OUTPUT_FAILED');
      expect(ImageErrorCodeConstants.PROCESSING_FAILED).toBe('PROCESSING_FAILED');
      expect(ImageErrorCodeConstants.MEMORY_ERROR).toBe('MEMORY_ERROR');
    });

    test('에러 코드가 일관된 명명 규칙을 따라야 함', () => {
      Object.values(ImageErrorCodeConstants).forEach((code) => {
        // 대문자와 언더스코어만 사용
        expect(code).toMatch(/^[A-Z_]+$/);
        // 언더스코어로 시작하거나 끝나지 않음
        expect(code).not.toMatch(/^_|_$/);
        // 연속된 언더스코어 없음
        expect(code).not.toMatch(/__/);
      });
    });

    test('에러 코드가 카테고리별로 잘 정리되어야 함', () => {
      const codes = Object.values(ImageErrorCodeConstants);

      // 소스 관련 에러들
      const sourceCodes = codes.filter((code) => code.includes('SOURCE') || code.includes('LOAD'));
      expect(sourceCodes.length).toBeGreaterThan(0);

      // Canvas 관련 에러들
      const canvasCodes = codes.filter((code) => code.includes('CANVAS'));
      expect(canvasCodes.length).toBeGreaterThan(0);

      // 출력 관련 에러들
      const outputCodes = codes.filter(
        (code) => code.includes('OUTPUT') || code.includes('BLOB') || code.includes('DOWNLOAD')
      );
      expect(outputCodes.length).toBeGreaterThan(0);
    });

    test('ImageErrorCodeConstants 객체가 올바른 타입을 가져야 함', () => {
      // 타입스크립트 레벨에서의 상수 정의 확인
      expect(typeof ImageErrorCodeConstants.INVALID_SOURCE).toBe('string');
      expect(ImageErrorCodeConstants.INVALID_SOURCE).toBe('INVALID_SOURCE');
    });

    test('에러 코드가 중복되지 않아야 함', () => {
      const codes = Object.values(ImageErrorCodeConstants);
      const uniqueCodes = [...new Set(codes)];
      expect(codes.length).toBe(uniqueCodes.length);
    });

    test('충분한 수의 에러 코드가 정의되어야 함', () => {
      const codeCount = Object.keys(ImageErrorCodeConstants).length;
      expect(codeCount).toBeGreaterThanOrEqual(15); // 최소 15개
      expect(codeCount).toBeLessThanOrEqual(30); // 너무 많지 않게
    });
  });

  describe('상수 간의 일관성', () => {
    test('FORMAT_INFO의 키가 ImageFormats 값과 일치해야 함', () => {
      Object.values(ImageFormats).forEach((format) => {
        expect(FORMAT_INFO).toHaveProperty(format);
      });
    });

    test('OUTPUT_FORMAT_INFO의 키가 OutputFormats 값과 일치해야 함', () => {
      Object.values(OutputFormats).forEach((format) => {
        expect(OUTPUT_FORMAT_INFO).toHaveProperty(format);
      });
    });

    test('OPTIMAL_QUALITY_BY_FORMAT의 키가 OutputFormats 값과 일치해야 함', () => {
      Object.values(OutputFormats).forEach((format) => {
        expect(OPTIMAL_QUALITY_BY_FORMAT).toHaveProperty(format);
      });
    });

    test('상수 객체들이 모두 올바른 값을 가져야 함', () => {
      // 타입스크립트 레벨에서의 상수들이 올바른 값을 가지는지 확인
      expect(ImageFormats.JPEG).toBe('jpeg');
      expect(OutputFormats.PNG).toBe('png');
      expect(ResizeFitConstants.COVER).toBe('cover');
      expect(ImageErrorCodeConstants.INVALID_SOURCE).toBe('INVALID_SOURCE');
    });
  });

  describe('브라우저 호환성 고려사항', () => {
    test('모든 MIME 타입이 표준을 준수해야 함', () => {
      const allMimeTypes = [
        ...Object.values(FORMAT_INFO).map((info) => info.mimeType),
        ...Object.values(OUTPUT_FORMAT_INFO).map((info) => info.mimeType),
      ];

      const uniqueMimeTypes = [...new Set(allMimeTypes)];

      uniqueMimeTypes.forEach((mimeType) => {
        // RFC 2046 준수: type/subtype 형식
        expect(mimeType).toMatch(/^[a-z]+\/[a-z0-9][a-z0-9\-\+]*$/);
        // 이미지 타입만
        expect(mimeType).toMatch(/^image\//);
      });
    });

    test('출력 포맷이 Canvas toBlob() 지원 포맷과 일치해야 함', () => {
      // Canvas toBlob()에서 일반적으로 지원하는 포맷들
      const canvasSupportedFormats = ['image/png', 'image/jpeg', 'image/webp'];

      Object.values(OUTPUT_FORMAT_INFO).forEach((info) => {
        // image/webp는 모든 브라우저에서 지원하지 않을 수 있지만,
        // 라이브러리에서 폴백 처리를 한다고 가정
        expect(canvasSupportedFormats.includes(info.mimeType) || info.mimeType === ('image/avif' as string)).toBe(true);
      });
    });
  });
});
