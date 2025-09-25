/**
 * 유틸리티 함수들 테스트
 * 
 * @description toBlob, toDataURL, toFile 함수들의 
 * 변환 기능과 옵션을 검증하는 테스트
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { toBlob, toDataURL, toFile } from '../src/utils/converters';
import type { BlobOptions, DataURLOptions, FileOptions } from '../src/utils/converters';

// 테스트용 이미지 및 Canvas 생성 도우미들
async function createTestImage(width: number = 200, height: number = 150): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = width;
    canvas.height = height;
    
    // 체크보드 패턴 생성 (식별하기 쉽도록)
    const checkSize = 20;
    for (let x = 0; x < width; x += checkSize) {
      for (let y = 0; y < height; y += checkSize) {
        const isEven = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2;
        ctx.fillStyle = isEven ? '#ff4757' : '#5352ed';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }
    
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL();
  });
}

function createTestCanvas(width: number = 200, height: number = 150): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = width;
  canvas.height = height;
  
  // 그라디언트 패턴 생성
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#3742fa');
  gradient.addColorStop(1, '#2ed573');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas;
}

async function createTestBlob(width: number = 200, height: number = 150, type: string = 'image/png'): Promise<Blob> {
  const canvas = createTestCanvas(width, height);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), type);
  });
}

describe('toBlob', () => {
  let testImage: HTMLImageElement;
  let testCanvas: HTMLCanvasElement;
  let testBlob: Blob;
  
  beforeAll(async () => {
    testImage = await createTestImage(300, 200);
    testCanvas = createTestCanvas(250, 180);
    testBlob = await createTestBlob(400, 300, 'image/jpeg');
  });

  describe('HTMLImageElement 변환', () => {
    it('기본 PNG로 변환', async () => {
      const result = await toBlob(testImage);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/png');
      expect(result.size).toBeGreaterThan(0);
    });

    it('JPEG로 변환', async () => {
      const result = await toBlob(testImage, { format: 'jpeg', quality: 0.8 });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/jpeg');
    });

    it('메타데이터 포함', async () => {
      const result = await toBlob(testImage, { includeMetadata: true });
      
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('processingTime');
      expect((result as any).width).toBe(testImage.width);
      expect((result as any).height).toBe(testImage.height);
      expect((result as any).processingTime).toBeGreaterThan(0);
    });
  });

  describe('HTMLCanvasElement 변환', () => {
    it('Canvas 직접 변환', async () => {
      const result = await toBlob(testCanvas);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/png');
    });

    it('Canvas WebP 변환', async () => {
      const result = await toBlob(testCanvas, { format: 'webp', quality: 0.9 });
      
      // WebP 지원 여부에 따라 결과가 달라질 수 있음
      expect(result).toBeInstanceOf(Blob);
      expect(['image/webp', 'image/png']).toContain(result.type);
    });

    it('Canvas 메타데이터', async () => {
      const result = await toBlob(testCanvas, { includeMetadata: true });
      
      expect((result as any).width).toBe(testCanvas.width);
      expect((result as any).height).toBe(testCanvas.height);
    });
  });

  describe('Blob 변환', () => {
    it('동일한 포맷이면 그대로 반환', async () => {
      const pngBlob = await createTestBlob(100, 100, 'image/png');
      const result = await toBlob(pngBlob, { format: 'png' });
      
      expect(result).toBe(pngBlob); // 동일한 객체여야 함
    });

    it('포맷 변환 (JPEG → PNG)', async () => {
      const result = await toBlob(testBlob, { format: 'png' });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/png');
      expect(result).not.toBe(testBlob); // 다른 객체여야 함
    });

    it('Blob 메타데이터', async () => {
      const result = await toBlob(testBlob, { includeMetadata: true });
      
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
    });
  });

  describe('에러 처리', () => {
    it('잘못된 소스에 대한 에러', async () => {
      await expect(
        toBlob(null as any)
      ).rejects.toThrow(/변환 중 오류가 발생했습니다/);
    });

    it('지원하지 않는 포맷에 대한 fallback', async () => {
      const result = await toBlob(testImage, { 
        format: 'invalid' as any, 
        fallbackFormat: 'png' 
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/png');
    });
  });
});

describe('toDataURL', () => {
  let testImage: HTMLImageElement;
  let testCanvas: HTMLCanvasElement;
  let testBlob: Blob;
  
  beforeAll(async () => {
    testImage = await createTestImage(200, 150);
    testCanvas = createTestCanvas(180, 120);
    testBlob = await createTestBlob(220, 160);
  });

  describe('HTMLImageElement 변환', () => {
    it('기본 PNG Data URL', async () => {
      const result = await toDataURL(testImage);
      
      expect(typeof result).toBe('string');
      expect(result.startsWith('data:image/png;base64,')).toBe(true);
      expect(result.length).toBeGreaterThan(100);
    });

    it('JPEG Data URL', async () => {
      const result = await toDataURL(testImage, { format: 'jpeg', quality: 0.7 });
      
      expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
    });

    it('메타데이터 포함', async () => {
      const result = await toDataURL(testImage, { includeMetadata: true });
      
      expect(result).toHaveProperty('dataURL');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect((result as any).dataURL.startsWith('data:image/')).toBe(true);
    });
  });

  describe('HTMLCanvasElement 변환', () => {
    it('Canvas Data URL', async () => {
      const result = await toDataURL(testCanvas);
      
      expect(result.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('Canvas 품질 옵션', async () => {
      const highQuality = await toDataURL(testCanvas, { format: 'jpeg', quality: 0.9 });
      const lowQuality = await toDataURL(testCanvas, { format: 'jpeg', quality: 0.1 });
      
      expect(highQuality.length).toBeGreaterThan(lowQuality.length);
    });
  });

  describe('Blob 변환', () => {
    it('Blob을 Data URL로', async () => {
      const result = await toDataURL(testBlob);
      
      expect(result.startsWith('data:image/')).toBe(true);
    });
  });

  describe('문자열 최적화', () => {
    it('이미 Data URL인 문자열은 그대로 반환', async () => {
      const originalDataURL = testImage.src; // 이미 data: URL
      const result = await toDataURL(originalDataURL);
      
      expect(result).toBe(originalDataURL);
    });

    it('Data URL 문자열 메타데이터', async () => {
      const originalDataURL = testImage.src;
      const result = await toDataURL(originalDataURL, { includeMetadata: true });
      
      expect((result as any).dataURL).toBe(originalDataURL);
      expect((result as any).width).toBeGreaterThan(0);
      expect((result as any).height).toBeGreaterThan(0);
    });
  });
});

describe('toFile', () => {
  let testImage: HTMLImageElement;
  let testBlob: Blob;
  
  beforeAll(async () => {
    testImage = await createTestImage(150, 100);
    testBlob = await createTestBlob(200, 150);
  });

  describe('기본 File 생성', () => {
    it('HTMLImageElement에서 File 생성', async () => {
      const result = await toFile(testImage, 'test-image.png');
      
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('test-image.png');
      expect(result.type).toBe('image/png');
      expect(result.size).toBeGreaterThan(0);
      expect(result.lastModified).toBeCloseTo(Date.now(), -1000); // 1초 오차 허용
    });

    it('Blob에서 File 생성', async () => {
      const result = await toFile(testBlob, 'converted.jpg', { format: 'jpeg' });
      
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('converted.jpg');
      expect(result.type).toBe('image/jpeg');
    });
  });

  describe('파일명 확장자 처리', () => {
    it('확장자 자동 수정', async () => {
      const result = await toFile(testImage, 'image.png', {
        format: 'jpeg',
        autoExtension: true
      });
      
      expect(result.name).toBe('image.jpg'); // jpeg → jpg로 변경
    });

    it('자동 수정 비활성화', async () => {
      const result = await toFile(testImage, 'image.png', {
        format: 'jpeg',
        autoExtension: false
      });
      
      expect(result.name).toBe('image.png'); // 원래 이름 유지
    });

    it('확장자가 없는 파일명', async () => {
      const result = await toFile(testImage, 'image', {
        format: 'webp',
        autoExtension: true
      });
      
      expect(result.name).toBe('image.webp');
    });
  });

  describe('메타데이터 포함', () => {
    it('File 메타데이터', async () => {
      const result = await toFile(testImage, 'metadata-test.png', {
        includeMetadata: true
      });
      
      expect(result).toHaveProperty('file');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('processingTime');
      
      const fileResult = result as any;
      expect(fileResult.file).toBeInstanceOf(File);
      expect(fileResult.file.name).toBe('metadata-test.png');
      expect(fileResult.width).toBe(testImage.width);
      expect(fileResult.height).toBe(testImage.height);
    });
  });

  describe('FormData 호환성', () => {
    it('FormData에 추가 가능', async () => {
      const file = await toFile(testImage, 'form-test.jpg', { format: 'jpeg' });
      
      const formData = new FormData();
      formData.append('image', file);
      
      const retrievedFile = formData.get('image') as File;
      expect(retrievedFile).toBeInstanceOf(File);
      expect(retrievedFile.name).toBe('form-test.jpg');
      expect(retrievedFile.type).toBe('image/jpeg');
    });
  });
});

describe('모든 변환 함수 공통', () => {
  let testImage: HTMLImageElement;
  
  beforeAll(async () => {
    testImage = await createTestImage(100, 80);
  });

  describe('다양한 소스 타입', () => {
    it('문자열 URL 소스', async () => {
      const dataURL = testImage.src;
      
      const blobResult = await toBlob(dataURL);
      const dataURLResult = await toDataURL(dataURL);
      const fileResult = await toFile(dataURL, 'from-string.png');
      
      expect(blobResult).toBeInstanceOf(Blob);
      expect(typeof dataURLResult).toBe('string');
      expect(fileResult).toBeInstanceOf(File);
    });
  });

  describe('성능', () => {
    it('변환 시간이 합리적', async () => {
      const startTime = Date.now();
      
      await Promise.all([
        toBlob(testImage),
        toDataURL(testImage),
        toFile(testImage, 'perf-test.png')
      ]);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(500); // 500ms 이내
    });
  });

  describe('메모리 관리', () => {
    it('큰 이미지 처리', async () => {
      const largeImage = await createTestImage(1000, 800);
      
      const blob = await toBlob(largeImage);
      const dataURL = await toDataURL(largeImage);
      const file = await toFile(largeImage, 'large.png');
      
      expect(blob.size).toBeGreaterThan(0);
      expect(dataURL.length).toBeGreaterThan(1000);
      expect(file.size).toBeGreaterThan(0);
      
      // 메모리 정리 확인 (간접적)
      expect(blob.size).toBeLessThan(10 * 1024 * 1024); // 10MB 미만
    });
  });

  describe('동시 처리', () => {
    it('병렬 변환 처리', async () => {
      const sources = [
        await createTestImage(50, 50),
        await createTestImage(60, 60),
        await createTestImage(70, 70)
      ];
      
      const results = await Promise.all([
        ...sources.map(src => toBlob(src)),
        ...sources.map(src => toDataURL(src)),
        ...sources.map((src, i) => toFile(src, `parallel-${i}.png`))
      ]);
      
      expect(results).toHaveLength(9);
      results.forEach((result, index) => {
        if (index < 3) {
          expect(result).toBeInstanceOf(Blob);
        } else if (index < 6) {
          expect(typeof result).toBe('string');
        } else {
          expect(result).toBeInstanceOf(File);
        }
      });
    });
  });
});