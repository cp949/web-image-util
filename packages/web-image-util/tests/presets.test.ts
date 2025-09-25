/**
 * 프리셋 함수들 테스트
 * 
 * @description createThumbnail, createAvatar, createSocialImage 함수들의 
 * 기능과 옵션을 검증하는 테스트
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  createThumbnail, 
  createAvatar, 
  createSocialImage,
  type ThumbnailOptions,
  type AvatarOptions,
  type SocialImageOptions,
} from '../src/presets';

// 테스트용 이미지 생성
async function createTestImage(width: number = 300, height: number = 200): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = width;
    canvas.height = height;
    
    // 그라디언트 패턴으로 테스트 이미지 생성
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.5, '#4ecdc4');
    gradient.addColorStop(1, '#45b7d1');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // 중앙에 원 그리기 (식별 용도)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 30, 0, 2 * Math.PI);
    ctx.fill();
    
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL();
  });
}

async function createTestBlob(width: number = 300, height: number = 200): Promise<Blob> {
  const img = await createTestImage(width, height);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0);
  
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/png');
  });
}

describe('createThumbnail', () => {
  let testImage: HTMLImageElement;
  let testBlob: Blob;
  
  beforeAll(async () => {
    testImage = await createTestImage(800, 600);
    testBlob = await createTestBlob(400, 300);
  });

  it('기본 사용법: 정사각형 썸네일 생성', async () => {
    const result = await createThumbnail(testImage, { size: 150 });
    
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(150);
    expect(result.height).toBe(150);
    expect(result.processingTime).toBeGreaterThan(0);
    
    // 파일 크기가 원본보다 작아야 함
    const originalCanvas = document.createElement('canvas');
    const originalCtx = originalCanvas.getContext('2d')!;
    originalCanvas.width = testImage.width;
    originalCanvas.height = testImage.height;
    originalCtx.drawImage(testImage, 0, 0);
    
    const originalSize = await new Promise<number>(resolve => {
      originalCanvas.toBlob(blob => resolve(blob?.size || 0));
    });
    
    expect(result.blob.size).toBeLessThan(originalSize);
  });

  it('직사각형 썸네일 생성', async () => {
    const result = await createThumbnail(testBlob, {
      size: { width: 400, height: 300 }
    });
    
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it('포맷과 품질 옵션', async () => {
    // JPEG 포맷
    const jpegResult = await createThumbnail(testImage, {
      size: 200,
      format: 'jpeg',
      quality: 0.9
    });
    
    expect(jpegResult.blob.type).toBe('image/jpeg');
    
    // PNG 포맷
    const pngResult = await createThumbnail(testImage, {
      size: 200,
      format: 'png'
    });
    
    expect(pngResult.blob.type).toBe('image/png');
  });

  it('fit 옵션: contain vs cover', async () => {
    // Cover fit (기본): 이미지가 잘릴 수 있지만 전체를 채움
    const coverResult = await createThumbnail(testImage, {
      size: 100,
      fit: 'cover'
    });
    
    // Contain fit: 전체 이미지가 보이지만 여백이 생길 수 있음
    const containResult = await createThumbnail(testImage, {
      size: 100,
      fit: 'contain',
      background: '#ffffff'
    });
    
    expect(coverResult.width).toBe(100);
    expect(coverResult.height).toBe(100);
    expect(containResult.width).toBe(100);
    expect(containResult.height).toBe(100);
  });

  it('잘못된 옵션에 대한 에러 처리', async () => {
    await expect(
      createThumbnail(testImage, { size: -1 } as any)
    ).rejects.toThrow();
    
    await expect(
      createThumbnail(null as any, { size: 100 })
    ).rejects.toThrow();
  });
});

describe('createAvatar', () => {
  let testImage: HTMLImageElement;
  
  beforeAll(async () => {
    testImage = await createTestImage(400, 300);
  });

  it('기본 64px 정사각형 아바타 생성', async () => {
    const result = await createAvatar(testImage);
    
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.blob.type).toBe('image/png'); // 기본 PNG
  });

  it('커스텀 크기 아바타', async () => {
    const result = await createAvatar(testImage, { size: 128 });
    
    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
  });

  it('포맷 옵션', async () => {
    const webpResult = await createAvatar(testImage, {
      size: 96,
      format: 'webp'
    });
    
    // WebP 지원 여부에 따라 달라질 수 있음
    expect(['image/webp', 'image/png']).toContain(webpResult.blob.type);
  });

  it('원형 아바타 옵션 (미구현 경고)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = await createAvatar(testImage, {
      size: 80,
      circle: true
    });
    
    expect(result.width).toBe(80);
    expect(result.height).toBe(80);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('원형 아바타 기능은 아직 구현되지 않았습니다')
    );
    
    consoleSpy.mockRestore();
  });

  it('테두리 옵션 (미구현 경고)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = await createAvatar(testImage, {
      size: 80,
      border: { width: 2, color: '#ff0000' }
    });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('테두리 기능은 아직 구현되지 않았습니다')
    );
    
    consoleSpy.mockRestore();
  });
});

describe('createSocialImage', () => {
  let testImage: HTMLImageElement;
  
  beforeAll(async () => {
    testImage = await createTestImage(1000, 800);
  });

  it('트위터용 이미지 (1200x675)', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'twitter'
    });
    
    expect(result.width).toBe(1200);
    expect(result.height).toBe(675);
    expect(result.blob.type).toBe('image/jpeg'); // 기본 JPEG
  });

  it('인스타그램용 정사각형 이미지 (1080x1080)', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'instagram'
    });
    
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
  });

  it('페이스북용 이미지 (1200x630)', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'facebook'
    });
    
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
  });

  it('링크드인용 이미지 (1200x627)', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'linkedin'
    });
    
    expect(result.width).toBe(1200);
    expect(result.height).toBe(627);
  });

  it('유튜브 썸네일 (1280x720)', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'youtube'
    });
    
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
  });

  it('핀터레스트용 세로형 이미지 (1000x1500)', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'pinterest'
    });
    
    expect(result.width).toBe(1000);
    expect(result.height).toBe(1500);
  });

  it('커스텀 크기로 오버라이드', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'twitter',
      customSize: { width: 800, height: 600 }
    });
    
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('배경색 및 포맷 옵션', async () => {
    const result = await createSocialImage(testImage, {
      platform: 'facebook',
      background: '#f0f0f0',
      format: 'png',
      quality: 0.9
    });
    
    expect(result.blob.type).toBe('image/png');
  });

  it('패딩 옵션 (미구현 경고)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = await createSocialImage(testImage, {
      platform: 'twitter',
      padding: 40
    });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('패딩 기능은 아직 구현되지 않았습니다')
    );
    
    consoleSpy.mockRestore();
  });
});

describe('모든 프리셋 공통 기능', () => {
  let testImage: HTMLImageElement;
  
  beforeAll(async () => {
    testImage = await createTestImage(500, 400);
  });

  it('메타데이터 포함 결과 검증', async () => {
    const thumbnailResult = await createThumbnail(testImage, { size: 100 });
    const avatarResult = await createAvatar(testImage, { size: 64 });
    const socialResult = await createSocialImage(testImage, { platform: 'twitter' });
    
    // 모든 결과에 메타데이터가 포함되어야 함
    [thumbnailResult, avatarResult, socialResult].forEach(result => {
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('processingTime');
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  it('다양한 소스 타입 지원', async () => {
    const testBlob = await createTestBlob(300, 200);
    const dataURL = testImage.src;
    
    // HTMLImageElement
    const fromImage = await createThumbnail(testImage, { size: 50 });
    
    // Blob
    const fromBlob = await createThumbnail(testBlob, { size: 50 });
    
    // Data URL
    const fromDataURL = await createThumbnail(dataURL, { size: 50 });
    
    [fromImage, fromBlob, fromDataURL].forEach(result => {
      expect(result.width).toBe(50);
      expect(result.height).toBe(50);
      expect(result.blob).toBeInstanceOf(Blob);
    });
  });

  it('성능: 처리 시간이 합리적 범위 내', async () => {
    const startTime = Date.now();
    
    const result = await createThumbnail(testImage, { size: 200 });
    
    const totalTime = Date.now() - startTime;
    
    // 전체 처리 시간이 1초를 넘지 않아야 함
    expect(totalTime).toBeLessThan(1000);
    expect(result.processingTime).toBeLessThan(totalTime);
  });
});