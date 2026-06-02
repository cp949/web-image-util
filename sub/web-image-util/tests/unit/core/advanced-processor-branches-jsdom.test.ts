/**
 * AdvancedImageProcessor.createThumbnail의 미커버 분기를 검증한다.
 *
 * PLAN 20260514-07 행동 테스트가 닿지 못한 분기만 대상으로 한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancedImageProcessor, ImagePurpose } from '../../../src/advanced-index';
import { createMockImage, makeProcessResult } from './advanced-processor-branches.helpers';

// ==========================================================================
// createThumbnail 분기
// ==========================================================================
describe('AdvancedImageProcessor.createThumbnail 분기', () => {
  let processImageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // processImage를 스텁해 실제 렌더링 없이 즉시 결과 반환
    processImageSpy = vi
      .spyOn(AdvancedImageProcessor, 'processImage')
      .mockResolvedValue(makeProcessResult({ withBlob: true }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 소스·캔버스 위임 단정 — 핵심 계약
  // -----------------------------------------------------------------------
  describe('소스·캔버스 위임 단정', () => {
    it('processImage에 전달한 source와 반환된 canvas가 동일 참조이다', async () => {
      const img = createMockImage();
      const stubResult = makeProcessResult({ withBlob: true });
      processImageSpy.mockResolvedValue(stubResult as any);

      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      // source 인자가 그대로 processImage에 전달됐는지 확인
      expect(processImageSpy.mock.calls[0]?.[0]).toBe(img);
      // 반환 canvas가 processImage 결과의 canvas와 동일 참조인지 확인
      expect(result.canvas).toBe(stubResult.canvas);
    });
  });

  // -----------------------------------------------------------------------
  // size 타입 분기
  // -----------------------------------------------------------------------
  describe('size 인자 타입 분기', () => {
    it('size가 number이면 width · height 모두 같은 값으로 resize에 매핑된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 200);

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.width).toBe(200);
      expect(opts?.resize?.height).toBe(200);
    });

    it('size가 객체이면 width · height가 그대로 resize에 매핑된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, { width: 320, height: 180 });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.width).toBe(320);
      expect(opts?.resize?.height).toBe(180);
    });
  });

  // -----------------------------------------------------------------------
  // quality → priority 매핑 분기
  // -----------------------------------------------------------------------
  describe('quality → priority 매핑 분기', () => {
    it("quality: 'fast' 는 priority: 'speed' 로 매핑된다", async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { quality: 'fast' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('speed');
    });

    it("quality: 'high' 는 priority: 'quality' 로 매핑된다", async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { quality: 'high' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('quality');
    });

    it("quality: 'balanced' 는 priority: 'balanced' 로 매핑된다", async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { quality: 'balanced' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('balanced');
    });

    it('quality 미전달 시 기본값 balanced가 사용된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100);

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.resize?.priority).toBe('balanced');
    });
  });

  // -----------------------------------------------------------------------
  // watermark 분기
  // -----------------------------------------------------------------------
  describe('watermark 옵션 분기', () => {
    it('watermark 문자열 전달 시 watermark.text에 text·position·style·size가 모두 설정된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { watermark: '© Test' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.watermark?.text).toMatchObject({
        text: '© Test',
        position: 'bottom-right',
        style: 'subtle',
        size: 'small',
      });
    });

    it('watermark 미전달 시 watermark 옵션이 undefined로 전달된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100);

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.watermark).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // format 분기
  // -----------------------------------------------------------------------
  describe('format 옵션 분기', () => {
    it('format 지정 시 해당 format이 processImage에 그대로 전달된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100, { format: 'webp' });

      const opts = processImageSpy.mock.calls[0]?.[1];
      expect(opts?.format).toBe('webp');
    });

    it('format 미전달 시 THUMBNAIL 목적의 SmartFormatOptions 객체가 기본값으로 전달된다', async () => {
      const img = createMockImage();
      await AdvancedImageProcessor.createThumbnail(img, 100);

      const opts = processImageSpy.mock.calls[0]?.[1];
      // purpose: THUMBNAIL, maxSizeKB: 50 가 기본 포맷 힌트
      expect(opts?.format).toMatchObject({ purpose: ImagePurpose.THUMBNAIL, maxSizeKB: 50 });
    });
  });

  // -----------------------------------------------------------------------
  // Blob 반환 분기
  // -----------------------------------------------------------------------
  describe('Blob 반환 분기', () => {
    it('processImage가 blob을 반환하면 해당 blob이 그대로 반환된다', async () => {
      const existingBlob = new Blob(['img'], { type: 'image/jpeg' });
      const stub = { ...makeProcessResult({ withBlob: false }), blob: existingBlob };
      processImageSpy.mockResolvedValue(stub as any);

      const img = createMockImage();
      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      expect(result.blob).toBe(existingBlob);
    });

    it('processImage가 blob을 반환하지 않으면 JPEG 폴백 blob이 생성된다', async () => {
      // blob 없는 결과 → createThumbnail이 canvas.toBlob으로 JPEG를 직접 생성
      processImageSpy.mockResolvedValue(makeProcessResult({ withBlob: false }) as any);

      const img = createMockImage();
      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      expect(result.blob).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob!.type).toBe('image/jpeg');
    });

    it('canvas.toBlob 콜백이 null을 받으면 "Blob creation failed" 에러로 reject된다', async () => {
      // blob 없는 결과 → createThumbnail이 canvas.toBlob 경로에 진입
      processImageSpy.mockResolvedValue(makeProcessResult({ withBlob: false }) as any);
      // toBlob 콜백을 null로 강제 호출해 reject 분기 유도
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });

      const img = createMockImage();
      await expect(AdvancedImageProcessor.createThumbnail(img, 100)).rejects.toThrow('Blob creation failed');
    });

    it('반환값은 canvas · blob만으로 구성된다 (AdvancedProcessingResult 전체 반환 회귀 방지)', async () => {
      const img = createMockImage();
      const result = await AdvancedImageProcessor.createThumbnail(img, 100);

      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('blob');
      expect(result).not.toHaveProperty('processing');
      expect(result).not.toHaveProperty('stats');
      expect(result).not.toHaveProperty('messages');
    });
  });
});
