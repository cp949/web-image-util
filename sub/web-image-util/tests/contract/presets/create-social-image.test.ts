import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSocialImage } from '../../../src/presets';
import type { ImageSource, SocialImageOptions } from '../../../src/types';

// Context7 MCP 베스트 프랙티스: 단순한 모킹 패턴
vi.mock('../../../src/processor');

describe('createSocialImage 프리셋', () => {
  let mockImageSource: ImageSource;

  beforeEach(() => {
    mockImageSource = new Blob(['test'], { type: 'image/jpeg' });
    vi.clearAllMocks();
  });

  describe('플랫폼별 크기', () => {
    test('Twitter 플랫폼 크기가 적용되어야 함', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 1200,
          height: 675,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = { platform: 'twitter' };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(
        1200,
        675, // Twitter 크기
        expect.objectContaining({ fit: 'contain' })
      );
    });

    test('Facebook 플랫폼 크기가 적용되어야 함', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 1200,
          height: 630,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = { platform: 'facebook' };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(
        1200,
        630, // Facebook 크기
        expect.any(Object)
      );
    });

    test('Instagram 플랫폼 크기가 적용되어야 함 (정사각형)', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 1080,
          height: 1080,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = { platform: 'instagram' };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(
        1080,
        1080, // Instagram 정사각형
        expect.any(Object)
      );
    });
  });

  describe('기본값 검증', () => {
    test('기본 포맷이 JPEG여야 함 (소셜 플랫폼 최적화)', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 1200,
          height: 675,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = { platform: 'twitter' };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.toBlob).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg' }));
    });

    test('기본 품질이 0.85여야 함', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 1200,
          height: 630,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = { platform: 'facebook' };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.toBlob).toHaveBeenCalledWith(expect.objectContaining({ quality: 0.85 }));
    });

    test('contain fit 모드가 기본값이어야 함', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 1200,
          height: 627,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = { platform: 'linkedin' };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(1200, 627, expect.objectContaining({ fit: 'contain' }));
    });
  });

  describe('커스텀 크기 오버라이드', () => {
    test('커스텀 크기가 플랫폼 크기를 오버라이드해야 함', async () => {
      // Context7 MCP 패턴: 간단한 모킹 구현
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({
          blob: new Blob(['mock'], { type: 'image/jpeg' }),
          width: 800,
          height: 600,
          processingTime: 80,
          format: 'jpeg',
        }),
      };
      const { processImage } = await import('../../../src/processor');
      (processImage as any).mockReturnValue(mockProcessor);

      const options: SocialImageOptions = {
        platform: 'twitter',
        customSize: { width: 800, height: 600 },
      };
      await createSocialImage(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(
        800,
        600, // 커스텀 크기 사용
        expect.any(Object)
      );
    });
  });
});
