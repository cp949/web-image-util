/**
 * *Detailed 변환 유틸의 반환 형태와 no-op 경로를 검증한다.
 *
 * Canvas 경로는 직접 인코딩을 처리하고, no-op 경로는 원본 객체를 재사용한다.
 * getBlobDimensions는 jsdom에서 blob: URL 이미지 로딩이 불가하므로 vi.mock으로 격리한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureBlobDetailed,
  ensureDataURLDetailed,
  ensureFileDetailed,
  ensureImageElement,
} from '../../../src/utils/converters';
import * as canvasBridge from '../../../src/utils/converters/canvas-bridge';
import { createTestCanvas } from '../../utils/canvas-helper';

// jsdom에서 blob: URL 이미지 로딩이 불가하므로 getBlobDimensions만 mock으로 대체한다.
vi.mock('../../../src/utils/converters/canvas-bridge', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/utils/converters/canvas-bridge')>();
  return { ...actual, getBlobDimensions: vi.fn() };
});

describe('*Detailed 변환 유틸 반환 형태 (jsdom-safe)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureBlobDetailed', () => {
    it('Canvas 입력 → blob·width·height·processingTime 포함한 결과 반환', async () => {
      const canvas = createTestCanvas(100, 80, 'blue');

      const result = await ensureBlobDetailed(canvas);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(100);
      expect(result.height).toBe(80);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('Canvas 입력 경로 → originalSize는 포함하지 않는다', async () => {
      const canvas = createTestCanvas(100, 80);

      const result = await ensureBlobDetailed(canvas);

      expect(result.originalSize).toBeUndefined();
    });

    it('기존 Blob no-op 경로 → 원본 Blob 인스턴스 그대로 재사용하며 치수와 processingTime을 포함한다', async () => {
      const blob = new Blob(['mock'], { type: 'image/png' });
      vi.mocked(canvasBridge.getBlobDimensions).mockResolvedValue({ width: 80, height: 60 });

      const result = await ensureBlobDetailed(blob);

      expect(result.blob).toBe(blob);
      expect(result.width).toBe(80);
      expect(result.height).toBe(60);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(vi.mocked(canvasBridge.getBlobDimensions)).toHaveBeenCalledWith(blob);
    });

    it('기존 Blob no-op 경로 → originalSize는 포함하지 않는다', async () => {
      const blob = new Blob(['mock'], { type: 'image/png' });
      vi.mocked(canvasBridge.getBlobDimensions).mockResolvedValue({ width: 80, height: 60 });

      const result = await ensureBlobDetailed(blob);

      expect(result.originalSize).toBeUndefined();
    });

    it('재인코딩 경로 → originalSize에 원본 이미지 치수가 채워진다', async () => {
      // jsdom은 Blob → ObjectURL → img.load 경로가 막혀 있으므로(TESTING-GUIDE 알려진 제약),
      // 동일 코드 분기(ensure.ts:80-88)를 진입시키는 HTMLImageElement 입력을 사용한다.
      const srcCanvas = createTestCanvas(200, 150, 'red');
      const img = await ensureImageElement(srcCanvas);

      const result = await ensureBlobDetailed(img);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
      expect(result.originalSize).toEqual({ width: 200, height: 150 });
    });
  });

  describe('ensureDataURLDetailed', () => {
    it('Canvas 입력 → dataURL·width·height·processingTime 포함한 결과 반환', async () => {
      const canvas = createTestCanvas(120, 90, 'green');

      const result = await ensureDataURLDetailed(canvas);

      expect(result.dataURL).toMatch(/^data:image\//);
      expect(result.width).toBe(120);
      expect(result.height).toBe(90);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.originalSize).toBeUndefined();
    });

    it('재인코딩 경로(HTMLImageElement 입력) → originalSize에 원본 이미지 치수가 채워진다', async () => {
      // ensure.ts:149-156 경로: HTMLImageElement 입력은 convertToImageElement → imageElementToCanvas → 재인코딩을 거쳐
      // originalSize에 원본 치수가 채워진다.
      const srcCanvas = createTestCanvas(180, 120, 'green');
      const img = await ensureImageElement(srcCanvas);

      const result = await ensureDataURLDetailed(img);

      expect(result.dataURL).toMatch(/^data:image\//);
      expect(result.width).toBe(180);
      expect(result.height).toBe(120);
      expect(result.originalSize).toEqual({ width: 180, height: 120 });
    });

    it('기존 Data URL 문자열 입력 → quality/format 옵션을 넘겨도 원본 문자열 그대로 재사용한다(options 무시)', async () => {
      // canvas.toDataURL()이 반환하는 유효한 PNG Data URL은 jsdom(resources: 'usable')에서 img.onload가 발화한다.
      // ensure.ts:139-141 경로: convertToImageElement로 이미지를 디코딩해 width/height를 계산한다.
      const canvas = createTestCanvas(60, 40);
      const inputDataURL = canvas.toDataURL('image/png');

      const result = await ensureDataURLDetailed(inputDataURL, { quality: 0.5, format: 'jpeg' });

      expect(result.dataURL).toBe(inputDataURL);
      expect(result.width).toBe(60);
      expect(result.height).toBe(40);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.originalSize).toBeUndefined();
    });
  });

  describe('ensureFileDetailed', () => {
    it('기존 File no-op 경로 → 원본 File 인스턴스 그대로 재사용하며 치수와 processingTime을 포함한다', async () => {
      const file = new File(['mock'], 'image.png', { type: 'image/png' });
      vi.mocked(canvasBridge.getBlobDimensions).mockResolvedValue({ width: 100, height: 75 });

      const result = await ensureFileDetailed(file, 'image.png', { format: 'png' });

      expect(result.file).toBe(file);
      expect(result.width).toBe(100);
      expect(result.height).toBe(75);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(vi.mocked(canvasBridge.getBlobDimensions)).toHaveBeenCalledWith(file);
      expect(result.originalSize).toBeUndefined();
    });

    it('재인코딩 경로(HTMLImageElement 입력) → originalSize에 원본 이미지 치수가 채워진다', async () => {
      // File이 아닌 HTMLImageElement 입력은 재인코딩 경로(ensure.ts:213-225)를 탄다.
      // ensureBlobDetailed가 originalSize를 채우면 FileResultImpl 5번째 인자로 전파된다.
      const srcCanvas = createTestCanvas(160, 100, 'blue');
      const img = await ensureImageElement(srcCanvas);

      const result = await ensureFileDetailed(img, 'output.png', { format: 'png' });

      expect(result.file).toBeInstanceOf(File);
      expect(result.width).toBe(160);
      expect(result.height).toBe(100);
      expect(result.originalSize).toEqual({ width: 160, height: 100 });
    });
  });
});
