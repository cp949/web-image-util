import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createAvatar } from '../../../src/presets';
import type { AvatarOptions, ImageSource } from '../../../src/types';

// processImage 모킹
vi.mock('../../../src/processor', () => ({
  processImage: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    toBlob: vi.fn().mockResolvedValue({
      blob: new Blob(['mock'], { type: 'image/png' }),
      width: 64,
      height: 64,
      processingTime: 30,
      format: 'png',
    }),
  })),
}));

describe('createAvatar 프리셋', () => {
  let mockImageSource: ImageSource;

  beforeEach(() => {
    mockImageSource = new Blob(['test'], { type: 'image/jpeg' });
    vi.clearAllMocks();
  });

  describe('기본 동작', () => {
    test('기본 64px 정사각형 아바타를 생성해야 함', async () => {
      const result = await createAvatar(mockImageSource);

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(64); // 모킹된 결과
      expect(result.height).toBe(64);
    });

    test('옵션 없이도 작동해야 함', async () => {
      await expect(createAvatar(mockImageSource)).resolves.toBeDefined();
    });

    test('빈 옵션 객체도 처리해야 함', async () => {
      const result = await createAvatar(mockImageSource, {});
      expect(result).toBeDefined();
    });
  });

  describe('크기 옵션 처리', () => {
    test('사용자 지정 크기가 적용되어야 함', async () => {
      const { processImage } = await import('../../../src/processor');
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({ blob: new Blob() }),
      };
      const processorModule = await import('../../../src/processor');
      if (
        processorModule.processImage &&
        typeof (processorModule.processImage as any).mockImplementation === 'function'
      ) {
        (processorModule.processImage as any).mockImplementation(() => mockProcessor);
      }

      const options: AvatarOptions = { size: 128 };
      await createAvatar(mockImageSource, options);

      expect(mockProcessor.resize).toHaveBeenCalledWith(
        128,
        128,
        expect.objectContaining({
          fit: 'cover',
          position: 'center',
        })
      );
    });
  });

  describe('기본값 검증', () => {
    test('기본 배경색이 투명이어야 함', async () => {
      const { processImage } = await import('../../../src/processor');
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({ blob: new Blob() }),
      };
      const processorModule = await import('../../../src/processor');
      if (
        processorModule.processImage &&
        typeof (processorModule.processImage as any).mockImplementation === 'function'
      ) {
        (processorModule.processImage as any).mockImplementation(() => mockProcessor);
      }

      await createAvatar(mockImageSource);

      expect(mockProcessor.resize).toHaveBeenCalledWith(64, 64, expect.objectContaining({ background: 'transparent' }));
    });

    test('기본 포맷이 PNG여야 함 (투명도 지원)', async () => {
      const { processImage } = await import('../../../src/processor');
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({ blob: new Blob() }),
      };
      const processorModule = await import('../../../src/processor');
      if (
        processorModule.processImage &&
        typeof (processorModule.processImage as any).mockImplementation === 'function'
      ) {
        (processorModule.processImage as any).mockImplementation(() => mockProcessor);
      }

      await createAvatar(mockImageSource);

      expect(mockProcessor.toBlob).toHaveBeenCalledWith(expect.objectContaining({ format: 'png' }));
    });

    test('기본 품질이 0.9여야 함 (고품질)', async () => {
      const { processImage } = await import('../../../src/processor');
      const mockProcessor = {
        resize: vi.fn().mockReturnThis(),
        toBlob: vi.fn().mockResolvedValue({ blob: new Blob() }),
      };
      const processorModule = await import('../../../src/processor');
      if (
        processorModule.processImage &&
        typeof (processorModule.processImage as any).mockImplementation === 'function'
      ) {
        (processorModule.processImage as any).mockImplementation(() => mockProcessor);
      }

      await createAvatar(mockImageSource);

      expect(mockProcessor.toBlob).toHaveBeenCalledWith(expect.objectContaining({ quality: 0.9 }));
    });
  });
});
