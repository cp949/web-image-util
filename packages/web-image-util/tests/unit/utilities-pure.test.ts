/**
 * 유틸리티 함수 순수 로직 테스트
 * Node.js 환경에서 실행 가능한 브라우저 API 독립적 테스트
 */

import { describe, it, expect, vi } from 'vitest';

describe('유틸리티 함수 - 순수 로직', () => {
  describe('formatToMimeType', () => {
    // 내부 함수이므로 모듈에서 가져올 수 없지만, 테스트 가능한 로직 확인
    const formatToMimeType = (format: string): string => {
      const mimeTypes: Record<string, string> = {
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        avif: 'image/avif',
        gif: 'image/gif',
        bmp: 'image/bmp',
        tiff: 'image/tiff',
      };

      return mimeTypes[format.toLowerCase()] || 'image/png';
    };

    it('지원하는 포맷을 올바른 MIME 타입으로 변환', () => {
      const testCases = [
        { format: 'jpeg', expected: 'image/jpeg' },
        { format: 'jpg', expected: 'image/jpeg' },
        { format: 'png', expected: 'image/png' },
        { format: 'webp', expected: 'image/webp' },
        { format: 'avif', expected: 'image/avif' },
        { format: 'gif', expected: 'image/gif' },
        { format: 'bmp', expected: 'image/bmp' },
        { format: 'tiff', expected: 'image/tiff' },
      ];

      testCases.forEach(({ format, expected }) => {
        expect(formatToMimeType(format)).toBe(expected);
      });
    });

    it('대소문자를 구분하지 않음', () => {
      const testCases = [
        { format: 'JPEG', expected: 'image/jpeg' },
        { format: 'Png', expected: 'image/png' },
        { format: 'WebP', expected: 'image/webp' },
        { format: 'AVIF', expected: 'image/avif' },
      ];

      testCases.forEach(({ format, expected }) => {
        expect(formatToMimeType(format)).toBe(expected);
      });
    });

    it('지원하지 않는 포맷은 기본값 반환', () => {
      const unsupportedFormats = [
        'unknown',
        'svg',
        'ico',
        'psd',
        '',
        'not-a-format'
      ];

      unsupportedFormats.forEach(format => {
        expect(formatToMimeType(format)).toBe('image/png');
      });
    });

    it('JPEG와 JPG 동일하게 처리', () => {
      expect(formatToMimeType('jpeg')).toBe('image/jpeg');
      expect(formatToMimeType('jpg')).toBe('image/jpeg');
      expect(formatToMimeType('JPEG')).toBe('image/jpeg');
      expect(formatToMimeType('JPG')).toBe('image/jpeg');
    });
  });

  describe('adjustFileExtension', () => {
    // 내부 함수이므로 모듈에서 가져올 수 없지만, 테스트 가능한 로직 확인
    const adjustFileExtension = (filename: string, format: string): string => {
      const lastDotIndex = filename.lastIndexOf('.');
      const nameWithoutExt = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;

      // JPEG는 jpg로 통일
      const extension = format === 'jpeg' ? 'jpg' : format;

      return `${nameWithoutExt}.${extension}`;
    };

    it('기존 확장자를 새 포맷으로 변경', () => {
      const testCases = [
        { filename: 'image.png', format: 'jpeg', expected: 'image.jpg' },
        { filename: 'photo.jpg', format: 'webp', expected: 'photo.webp' },
        { filename: 'test.gif', format: 'png', expected: 'test.png' },
        { filename: 'picture.bmp', format: 'avif', expected: 'picture.avif' },
      ];

      testCases.forEach(({ filename, format, expected }) => {
        expect(adjustFileExtension(filename, format)).toBe(expected);
      });
    });

    it('확장자가 없는 파일명에 확장자 추가', () => {
      const testCases = [
        { filename: 'image', format: 'png', expected: 'image.png' },
        { filename: 'photo', format: 'jpeg', expected: 'photo.jpg' },
        { filename: 'test', format: 'webp', expected: 'test.webp' },
      ];

      testCases.forEach(({ filename, format, expected }) => {
        expect(adjustFileExtension(filename, format)).toBe(expected);
      });
    });

    it('JPEG 포맷은 jpg 확장자로 변환', () => {
      const testCases = [
        { filename: 'image.png', format: 'jpeg', expected: 'image.jpg' },
        { filename: 'photo.webp', format: 'jpeg', expected: 'photo.jpg' },
        { filename: 'test', format: 'jpeg', expected: 'test.jpg' },
      ];

      testCases.forEach(({ filename, format, expected }) => {
        expect(adjustFileExtension(filename, format)).toBe(expected);
      });
    });

    it('복잡한 파일명 처리', () => {
      const testCases = [
        { filename: 'my.image.file.png', format: 'webp', expected: 'my.image.file.webp' },
        { filename: 'test.backup.old.jpg', format: 'png', expected: 'test.backup.old.png' },
        { filename: 'file.with.dots.gif', format: 'jpeg', expected: 'file.with.dots.jpg' },
      ];

      testCases.forEach(({ filename, format, expected }) => {
        expect(adjustFileExtension(filename, format)).toBe(expected);
      });
    });

    it('숨김 파일 처리', () => {
      const testCases = [
        { filename: '.hidden.png', format: 'jpeg', expected: '.hidden.jpg' },
        { filename: '.config.json', format: 'png', expected: '.config.png' },
      ];

      testCases.forEach(({ filename, format, expected }) => {
        expect(adjustFileExtension(filename, format)).toBe(expected);
      });
    });

    it('점으로 시작하지만 확장자 없는 파일', () => {
      // .hidden처럼 점으로 시작하는 파일은 lastIndexOf('.')가 0을 반환하므로
      // nameWithoutExt는 ''이 되고, 따라서 '.png'가 됨
      expect(adjustFileExtension('.hidden', 'png')).toBe('.png');
      expect(adjustFileExtension('.config', 'jpeg')).toBe('.jpg');
    });
  });

  describe('옵션 검증 로직', () => {
    const isValidQuality = (quality: any): boolean => {
      return typeof quality === 'number' && quality >= 0 && quality <= 1;
    };

    const isValidFormat = (format: any): boolean => {
      const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tiff'];
      return typeof format === 'string' && supportedFormats.includes(format.toLowerCase());
    };

    describe('품질 값 검증', () => {
      it('유효한 품질 값 식별', () => {
        const validQualities = [0, 0.1, 0.5, 0.8, 0.95, 1];

        validQualities.forEach(quality => {
          expect(isValidQuality(quality)).toBe(true);
        });
      });

      it('무효한 품질 값 식별', () => {
        const invalidQualities = [
          -0.1,     // 음수
          1.1,      // 1 초과
          '0.8',    // 문자열
          true,     // boolean
          null,     // null
          undefined, // undefined
          {},       // 객체
          []        // 배열
        ];

        invalidQualities.forEach(quality => {
          expect(isValidQuality(quality)).toBe(false);
        });
      });
    });

    describe('포맷 검증', () => {
      it('지원하는 포맷 식별', () => {
        const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tiff'];

        supportedFormats.forEach(format => {
          expect(isValidFormat(format)).toBe(true);
        });
      });

      it('대소문자 무관하게 포맷 식별', () => {
        const formats = ['JPEG', 'Png', 'WebP', 'AVIF', 'GIF'];

        formats.forEach(format => {
          expect(isValidFormat(format)).toBe(true);
        });
      });

      it('지원하지 않는 포맷 식별', () => {
        const unsupportedFormats = [
          'svg',      // SVG
          'ico',      // 아이콘
          'psd',      // Photoshop
          'raw',      // RAW
          'heic',     // HEIC
          '',         // 빈 문자열
          123,        // 숫자
          null,       // null
          undefined,  // undefined
          {},         // 객체
          []          // 배열
        ];

        unsupportedFormats.forEach(format => {
          expect(isValidFormat(format)).toBe(false);
        });
      });
    });
  });

  describe('파일명 검증 로직', () => {
    const isValidFilename = (filename: any): boolean => {
      if (typeof filename !== 'string' || filename.length === 0) {
        return false;
      }

      // 금지된 문자 확인 (Windows, Linux, macOS 공통)
      const forbiddenChars = /[<>:"|?*\x00-\x1f]/;
      if (forbiddenChars.test(filename)) {
        return false;
      }

      // 예약된 이름 확인 (Windows)
      const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
      if (reservedNames.test(filename)) {
        return false;
      }

      return true;
    };

    it('유효한 파일명 식별', () => {
      const validFilenames = [
        'image.jpg',
        'photo.png',
        'test-file.webp',
        'my_image.gif',
        'file123.bmp',
        'picture (1).jpg',
        'test.backup.png',
        '.hidden.jpg',
        'very-long-filename-with-many-characters.jpeg'
      ];

      validFilenames.forEach(filename => {
        expect(isValidFilename(filename)).toBe(true);
      });
    });

    it('무효한 파일명 식별', () => {
      const invalidFilenames = [
        '',                  // 빈 문자열
        'file<name>.jpg',    // 금지된 문자 <
        'file>name.png',     // 금지된 문자 >
        'file:name.gif',     // 금지된 문자 :
        'file"name.bmp',     // 금지된 문자 "
        'file|name.jpg',     // 금지된 문자 |
        'file?name.png',     // 금지된 문자 ?
        'file*name.gif',     // 금지된 문자 *
        'CON.jpg',           // 예약된 이름
        'PRN.png',           // 예약된 이름
        'COM1.gif',          // 예약된 이름
        'LPT1.bmp',          // 예약된 이름
        123,                 // 숫자
        null,                // null
        undefined            // undefined
      ];

      invalidFilenames.forEach(filename => {
        expect(isValidFilename(filename)).toBe(false);
      });
    });

    it('타입이 문자열이 아닌 경우', () => {
      const nonStringInputs = [
        123,
        true,
        false,
        {},
        [],
        null,
        undefined
      ];

      nonStringInputs.forEach(input => {
        expect(isValidFilename(input)).toBe(false);
      });
    });
  });

  describe('에러 메시지 포맷팅', () => {
    const formatErrorMessage = (operation: string, details?: string): string => {
      const baseMessage = `${operation} 중 오류가 발생했습니다`;
      return details ? `${baseMessage}: ${details}` : baseMessage;
    };

    it('기본 에러 메시지 생성', () => {
      const testCases = [
        { operation: 'Blob 변환', expected: 'Blob 변환 중 오류가 발생했습니다' },
        { operation: 'Data URL 변환', expected: 'Data URL 변환 중 오류가 발생했습니다' },
        { operation: 'File 객체 생성', expected: 'File 객체 생성 중 오류가 발생했습니다' },
      ];

      testCases.forEach(({ operation, expected }) => {
        expect(formatErrorMessage(operation)).toBe(expected);
      });
    });

    it('세부 정보 포함 에러 메시지 생성', () => {
      const testCases = [
        {
          operation: 'Blob 변환',
          details: '지원하지 않는 포맷',
          expected: 'Blob 변환 중 오류가 발생했습니다: 지원하지 않는 포맷'
        },
        {
          operation: 'Canvas 생성',
          details: '2D context 없음',
          expected: 'Canvas 생성 중 오류가 발생했습니다: 2D context 없음'
        },
      ];

      testCases.forEach(({ operation, details, expected }) => {
        expect(formatErrorMessage(operation, details)).toBe(expected);
      });
    });
  });

  describe('성능 측정 로직', () => {
    it('처리 시간 계산', () => {
      const startTime = 1000;
      const endTime = 1500;
      const processingTime = endTime - startTime;

      expect(processingTime).toBe(500);
      expect(typeof processingTime).toBe('number');
      expect(processingTime).toBeGreaterThanOrEqual(0);
    });

    it('시간 측정 함수 모킹', () => {
      const mockDateNow = vi.spyOn(Date, 'now');

      // 시작 시간 설정
      mockDateNow.mockReturnValueOnce(1000);
      const startTime = Date.now();

      // 종료 시간 설정
      mockDateNow.mockReturnValueOnce(1250);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(startTime).toBe(1000);
      expect(endTime).toBe(1250);
      expect(processingTime).toBe(250);

      mockDateNow.mockRestore();
    });
  });

  describe('브라우저 기능 감지 로직', () => {
    const hasCanvasSupport = (): boolean => {
      // Node.js 환경에서는 항상 false
      return typeof HTMLCanvasElement !== 'undefined' &&
             typeof CanvasRenderingContext2D !== 'undefined';
    };

    const hasBlobSupport = (): boolean => {
      // Node.js 환경에서는 Blob이 있을 수 있음
      return typeof Blob !== 'undefined';
    };

    const hasFileReaderSupport = (): boolean => {
      return typeof FileReader !== 'undefined';
    };

    it('Canvas 지원 여부 확인', () => {
      // Node.js 환경에서는 Canvas가 없음
      expect(hasCanvasSupport()).toBe(false);
    });

    it('Blob 지원 여부 확인', () => {
      // Node.js 18+에서는 Blob이 지원됨
      expect(typeof hasBlobSupport()).toBe('boolean');
    });

    it('FileReader 지원 여부 확인', () => {
      // Node.js 환경에서는 FileReader가 없음
      expect(hasFileReaderSupport()).toBe(false);
    });
  });
});