import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createThumbnail } from '../../../src/presets';
import { processImage } from '../../../src/processor';
import type { ImageSource, ThumbnailOptions } from '../../../src/types';

// Context7 베스트 프랙티스: 모듈 전체 모킹
vi.mock('../../../src/processor', () => ({
  processImage: vi.fn(),
}));

describe('createThumbnail 프리셋', () => {
  let mockImageSource: ImageSource;
  let mockProcessor: any;

  beforeEach(() => {
    mockImageSource = new Blob(['test'], { type: 'image/jpeg' });

    // Context7 베스트 프랙티스: 각 테스트마다 새로운 모킹 설정
    mockProcessor = {
      resize: vi.fn().mockReturnThis(),
      toBlob: vi.fn().mockResolvedValue({
        blob: new Blob(['mock'], { type: 'image/webp' }),
        width: 100,
        height: 100,
        processingTime: 50,
        format: 'webp',
      }),
    };

    // processImage 모킹 설정
    vi.mocked(processImage).mockReturnValue(mockProcessor);
  });

  afterEach(() => {
    // Context7 베스트 프랙티스: 모든 모킹 정리
    vi.clearAllMocks();
  });

  describe('기본 동작', () => {
    test('정사각형 썸네일을 생성해야 함', async () => {
      const options: ThumbnailOptions = { size: 150 };

      const result = await createThumbnail(mockImageSource, options);

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(100); // 모킹된 결과
      expect(result.height).toBe(100);

      // processImage가 호출되었는지 확인
      expect(processImage).toHaveBeenCalledWith(mockImageSource);
    });

    test('직사각형 썸네일을 생성해야 함', async () => {
      const options: ThumbnailOptions = {
        size: { width: 200, height: 150 },
      };

      const result = await createThumbnail(mockImageSource, options);

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(processImage).toHaveBeenCalledWith(mockImageSource);
    });

    test('높이가 없는 경우 정사각형으로 처리해야 함', async () => {
      const options: ThumbnailOptions = {
        size: { width: 100 },
      };

      const result = await createThumbnail(mockImageSource, options);

      expect(result).toBeDefined();
      expect(processImage).toHaveBeenCalledWith(mockImageSource);
    });
  });

  describe('크기 옵션 처리', () => {
    test('숫자 크기가 정사각형으로 변환되어야 함', async () => {
      const options: ThumbnailOptions = { size: 100 };
      await createThumbnail(mockImageSource, options);

      // processImage 호출 확인
      expect(processImage).toHaveBeenCalledWith(mockImageSource);

      // resize 메서드 호출 확인 (실제 구현에 맞게)
      expect(mockProcessor.resize).toHaveBeenCalledWith(100, 100, expect.objectContaining({ fit: 'cover' }));
    });

    test('객체 크기가 올바르게 전달되어야 함', async () => {
      const options: ThumbnailOptions = {
        size: { width: 300, height: 200 },
      };
      await createThumbnail(mockImageSource, options);

      // processImage 호출 확인
      expect(processImage).toHaveBeenCalledWith(mockImageSource);

      // resize 메서드 호출 확인
      expect(mockProcessor.resize).toHaveBeenCalledWith(300, 200, expect.objectContaining({ fit: 'cover' }));
    });
  });

  describe('기본값 검증', () => {
    test('기본 fit 모드가 cover여야 함', async () => {
      const options: ThumbnailOptions = { size: 100 };
      await createThumbnail(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(100, 100, expect.objectContaining({ fit: 'cover' }));
    });

    test('기본 품질이 0.8이어야 함', async () => {
      const options: ThumbnailOptions = { size: 100 };
      await createThumbnail(mockImageSource, options);

      expect(mockProcessor.toBlob).toHaveBeenCalledWith(expect.objectContaining({ quality: 0.8 }));
    });
  });
});
