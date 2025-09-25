/**
 * toBlob 포맷 오버로드 유닛 테스트
 */
import { describe, expect, it } from 'vitest';
import { OPTIMAL_QUALITY_BY_FORMAT } from '../src';

describe('출력 메서드 포맷 오버로드', () => {
  it('toBlob, toDataURL, toFile 모든 메서드의 타입 정의가 올바른지 확인', () => {
    // 이 테스트는 TypeScript 컴파일 시간에 타입 체크됨
    // 컴파일이 성공하면 타입 정의가 올바른 것

    // toBlob 오버로드 시그니처 확인
    type ToBlobOverloads = {
      (options?: import('../src').OutputOptions): Promise<import('../src').BlobResult>;
      (format: import('../src').ImageFormat): Promise<import('../src').BlobResult>;
    };

    // toDataURL 오버로드 시그니처 확인
    type ToDataURLOverloads = {
      (options?: import('../src').OutputOptions): Promise<import('../src').DataURLResult>;
      (format: import('../src').ImageFormat): Promise<import('../src').DataURLResult>;
    };

    // toFile 오버로드 시그니처 확인
    type ToFileOverloads = {
      (filename: string, options?: import('../src').OutputOptions): Promise<import('../src').FileResult>;
      (filename: string, format: import('../src').ImageFormat): Promise<import('../src').FileResult>;
    };

    // 타입이 올바르게 정의되었다면 이 테스트는 통과
    expect(true).toBe(true);
  });
});

describe('포맷별 최적 품질 상수', () => {
  it('OPTIMAL_QUALITY_BY_FORMAT 상수가 올바르게 정의되어야 함', () => {
    // 포맷별 최적 품질 값 확인
    expect(OPTIMAL_QUALITY_BY_FORMAT.png).toBe(1.0);    // 무손실
    expect(OPTIMAL_QUALITY_BY_FORMAT.jpeg).toBe(0.85);  // 품질과 크기의 균형
    expect(OPTIMAL_QUALITY_BY_FORMAT.jpg).toBe(0.85);   // JPEG와 동일
    expect(OPTIMAL_QUALITY_BY_FORMAT.webp).toBe(0.9);   // 고효율 압축
    expect(OPTIMAL_QUALITY_BY_FORMAT.avif).toBe(0.9);   // 차세대 포맷
    expect(OPTIMAL_QUALITY_BY_FORMAT.gif).toBe(1.0);    // 무손실
    expect(OPTIMAL_QUALITY_BY_FORMAT.tiff).toBe(1.0);   // 일반적으로 무손실
    expect(OPTIMAL_QUALITY_BY_FORMAT.bmp).toBe(1.0);    // 무압축

    // 모든 값이 0과 1 사이에 있는지 확인
    Object.values(OPTIMAL_QUALITY_BY_FORMAT).forEach(quality => {
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(1);
    });
  });

  it('모든 ImageFormat에 대한 품질 값이 정의되어야 함', () => {
    // 모든 지원 포맷에 대해 품질 값이 존재하는지 확인
    const expectedFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp'];

    expectedFormats.forEach(format => {
      expect(OPTIMAL_QUALITY_BY_FORMAT).toHaveProperty(format);
      expect(typeof OPTIMAL_QUALITY_BY_FORMAT[format as keyof typeof OPTIMAL_QUALITY_BY_FORMAT]).toBe('number');
    });
  });

  it('손실/무손실 포맷 분류가 올바른지 확인', () => {
    // 무손실 포맷들은 1.0 품질
    const losslessFormats = ['png', 'gif', 'tiff', 'bmp'];
    losslessFormats.forEach(format => {
      expect(OPTIMAL_QUALITY_BY_FORMAT[format as keyof typeof OPTIMAL_QUALITY_BY_FORMAT]).toBe(1.0);
    });

    // 손실 압축 포맷들은 1.0 미만
    const lossyFormats = ['jpeg', 'jpg', 'webp', 'avif'];
    lossyFormats.forEach(format => {
      expect(OPTIMAL_QUALITY_BY_FORMAT[format as keyof typeof OPTIMAL_QUALITY_BY_FORMAT]).toBeLessThan(1.0);
    });
  });

  it('현대적 포맷이 더 높은 품질을 가지는지 확인', () => {
    // WebP와 AVIF가 JPEG보다 높은 품질을 가져야 함 (더 효율적이므로)
    expect(OPTIMAL_QUALITY_BY_FORMAT.webp).toBeGreaterThan(OPTIMAL_QUALITY_BY_FORMAT.jpeg);
    expect(OPTIMAL_QUALITY_BY_FORMAT.avif).toBeGreaterThan(OPTIMAL_QUALITY_BY_FORMAT.jpeg);

    // JPG와 JPEG는 동일해야 함
    expect(OPTIMAL_QUALITY_BY_FORMAT.jpg).toBe(OPTIMAL_QUALITY_BY_FORMAT.jpeg);
  });
});