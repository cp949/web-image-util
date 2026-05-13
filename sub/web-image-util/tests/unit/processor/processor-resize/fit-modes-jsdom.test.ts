/**
 * processImage fit 모드별 resize 검증 중 Canvas 입력만 사용해 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - Blob 입력 흐름은 jsdom의 Blob URL 이미지 로딩 제약 때문에 이 파일에서 다루지 않는다.
 * - Canvas 입력은 source-converter가 그대로 통과시켜 fit 모드 / padding / 런타임 검증 / 엣지 케이스가
 *   모두 jsdom에서 동작한다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import type { ResizeConfig } from '../../../../src/types/resize-config';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('fit 모드별 resize (Canvas 입력, jsdom-safe)', () => {
  describe('기본 fit 모드', () => {
    it('cover fit 모드를 지원한다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('contain fit 모드를 지원한다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');
      const result = await processImage(canvas).resize({ fit: 'contain', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('fill fit 모드를 지원한다', async () => {
      const canvas = createTestCanvas(400, 300, 'green');
      const result = await processImage(canvas).resize({ fit: 'fill', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('maxFit 모드 — width만 지정', async () => {
      const canvas = createTestCanvas(400, 300, 'yellow');
      const result = await processImage(canvas).resize({ fit: 'maxFit', width: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('maxFit 모드 — height만 지정', async () => {
      const canvas = createTestCanvas(400, 300, 'purple');
      const result = await processImage(canvas).resize({ fit: 'maxFit', height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('minFit 모드 — width만 지정', async () => {
      const canvas = createTestCanvas(100, 100, 'orange');
      const result = await processImage(canvas).resize({ fit: 'minFit', width: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('모든 fit 모드를 병렬로 처리한다', async () => {
      const canvas = createTestCanvas(400, 300, 'cyan');

      const results = await Promise.all([
        processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toBlob(),
        processImage(canvas).resize({ fit: 'contain', width: 200, height: 200 }).toBlob(),
        processImage(canvas).resize({ fit: 'fill', width: 200, height: 200 }).toBlob(),
        processImage(canvas).resize({ fit: 'maxFit', width: 200 }).toBlob(),
        processImage(canvas).resize({ fit: 'minFit', width: 200 }).toBlob(),
      ]);

      for (const result of results) {
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.blob.type).toMatch(/^image\//);
      }
    });
  });

  describe('contain + withoutEnlargement', () => {
    it('withoutEnlargement 옵션이 있을 때 요청한 캔버스 크기를 유지한다', async () => {
      const canvas = createTestCanvas(100, 100, 'green');

      const result = await processImage(canvas)
        .resize({ fit: 'contain', width: 400, height: 400, withoutEnlargement: true })
        .toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });
  });

  describe('padding · background 옵션', () => {
    it('모든 fit 모드에 padding을 적용한다', async () => {
      const canvas = createTestCanvas(100, 100, 'red');

      const configs: ResizeConfig[] = [
        { fit: 'cover', width: 100, height: 100, padding: 10 },
        { fit: 'contain', width: 100, height: 100, padding: 10 },
        { fit: 'fill', width: 100, height: 100, padding: 10 },
        { fit: 'maxFit', width: 100, padding: 10 },
        { fit: 'minFit', width: 200, padding: 10 },
      ];

      for (const config of configs) {
        const result = await processImage(canvas).resize(config).toCanvas();
        expect(result.width).toBeGreaterThan(100);
        expect(result.height).toBeGreaterThan(100);
      }
    });

    it('padding과 함께 background 색상을 적용한다', async () => {
      const canvas = createTestCanvas(100, 100, 'yellow');

      const result = await processImage(canvas)
        .resize({ fit: 'cover', width: 100, height: 100, padding: 20, background: 'blue' })
        .toCanvas();

      expect(result.width).toBe(140); // 100 + 20*2
      expect(result.height).toBe(140);
    });
  });

  describe('런타임 설정 검증', () => {
    it('maxFit에 width/height 없으면 INVALID_DIMENSIONS 에러를 던진다', async () => {
      const canvas = createTestCanvas(400, 300, 'red');

      await expect(async () => {
        await processImage(canvas)
          .resize({ fit: 'maxFit' } as any)
          .toBlob();
      }).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });

    it('minFit에 width/height 없으면 INVALID_DIMENSIONS 에러를 던진다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');

      await expect(async () => {
        await processImage(canvas)
          .resize({ fit: 'minFit' } as any)
          .toBlob();
      }).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });

    it('cover에 width 없으면 INVALID_DIMENSIONS 에러를 던진다', async () => {
      const canvas = createTestCanvas(400, 300, 'green');

      await expect(async () => {
        await processImage(canvas)
          .resize({ fit: 'cover', height: 200 } as any)
          .toBlob();
      }).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });

    it('음수 padding이면 INVALID_DIMENSIONS 에러를 던진다', async () => {
      const canvas = createTestCanvas(400, 300, 'yellow');

      await expect(async () => {
        await processImage(canvas)
          .resize({ fit: 'cover', width: 200, height: 200, padding: -10 } as any)
          .toBlob();
      }).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });
  });

  describe('엣지 케이스', () => {
    it('매우 작은 원본 이미지를 처리한다', async () => {
      const canvas = createTestCanvas(10, 10, 'teal');
      const result = await processImage(canvas).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('매우 큰 목표 크기를 처리한다', async () => {
      const canvas = createTestCanvas(100, 100, 'navy');
      const result = await processImage(canvas).resize({ fit: 'cover', width: 2000, height: 2000 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('극단적인 종횡비를 처리한다', async () => {
      const canvas = createTestCanvas(1000, 100, 'maroon');
      const result = await processImage(canvas).resize({ fit: 'cover', width: 100, height: 1000 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });
  });
});
