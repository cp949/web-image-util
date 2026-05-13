/**
 * Type-safe processor 검증 중 Blob → Image 로드를 거쳐 `.toBlob()` 출력까지 가는 케이스만 happy-dom에 남긴다.
 * 타입 검증과 resize() 가드 같은 출력 없는 케이스는 `typed-processor-jsdom.test.ts`에 있다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../src/processor';
import { createTestImageBlob } from '../../utils';

describe('Type-safe processor tests (Blob 입력 출력 경로)', () => {
  describe('Runtime behavior validation', () => {
    it('should allow independent resize() calls on separate instances', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'yellow');

      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      const result1 = await processor1.resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
      const result2 = await processor2.resize({ fit: 'contain', width: 300, height: 200 }).toBlob();

      expect(result1.width).toBe(150);
      expect(result1.height).toBe(150);
      expect(result2.width).toBe(300);
      expect(result2.height).toBe(200);
    });
  });

  describe('Chaining order validation', () => {
    it('should work with blur() → resize() → blur() order', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'pink');

      const result = await processImage(testBlob)
        .blur(1)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(3)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should work with resize() → blur() order', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'teal');

      const result = await processImage(testBlob).resize({ fit: 'maxFit', width: 300 }).blur(2).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBeLessThanOrEqual(300);
    });

    it('should work with multiple blur() calls', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'navy');

      const result = await processImage(testBlob)
        .blur(1)
        .blur(2)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(1)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('Type inference validation', () => {
    it('should have accurate type inference in method chaining', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'lime');

      const step1 = processImage(testBlob);
      const step2 = step1.blur(1);
      const step3 = step2.resize({ fit: 'cover', width: 200, height: 200 });
      const step4 = step3.blur(2);

      const result = await step4.toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });
});
