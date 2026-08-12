/**
 * OutputPipeline 행동 테스트.
 *
 * 출력 경로 deep module의 public interface(생성자/addResize/addBlur/출력 메서드)
 * 경유로만 검증한다. 내부 상태 단언 금지.
 *
 * 검증 계약 (아키텍처 리뷰 #2 카드 4):
 * - 소스 준비 캐싱: 출력 N회에 소스 변환 1회 (동시 첫 출력 포함)
 * - 연산 전달: 호출 즉시 파이프라인에 축적, 호출 순서 보존
 * - 첫 출력 이후의 addResize/addBlur도 다음 출력에 반영 (출력 전후 의미 동일)
 * - resize 1회 제약: LazyRenderPipeline 단일 가드, 검증 실패 시 상태 무변화
 * - 포맷/품질 기본값: 스마트 포맷, 문자열 포맷 최적 품질, quality 0 보존
 * - toFile 파일명/포맷 해석
 * - CanvasLease 소유권: 인코딩 후 pool 반환, toCanvas는 detach
 * - 에러 코드 보존: OUTPUT_FAILED / CANVAS_CREATION_FAILED / ImageProcessError 통과
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline.internal';
import { OutputPipeline } from '../../../src/core/output-pipeline.internal';
import * as converter from '../../../src/core/source-converter/index';
import { ImageProcessError } from '../../../src/types';
import { createTestCanvas } from '../../utils/canvas-helper';

// convertToImageElement 호출 횟수·인자를 추적하면서 실제 구현은 그대로 유지한다.
vi.mock('../../../src/core/source-converter/index', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../src/core/source-converter/index')>();
  return {
    ...orig,
    convertToImageElement: vi.fn().mockImplementation(orig.convertToImageElement),
  };
});

describe('OutputPipeline', () => {
  beforeEach(() => {
    vi.mocked(converter.convertToImageElement).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('소스 준비 캐싱', () => {
    it('출력을 두 번 호출해도 소스 변환은 한 번만 수행한다', async () => {
      // mutation: 준비 결과 캐시를 제거하면 변환이 2회가 되어 실패한다
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob();
      await pipeline.toBlob();

      expect(vi.mocked(converter.convertToImageElement)).toHaveBeenCalledTimes(1);
    });

    it('동시 첫 출력에서도 소스 변환은 한 번만 수행한다', async () => {
      // mutation: promise 메모이즈를 "await 후 필드 체크"로 바꾸면 race에서 2회가 되어 실패한다
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await Promise.all([pipeline.toBlob(), pipeline.toBlob()]);

      expect(vi.mocked(converter.convertToImageElement)).toHaveBeenCalledTimes(1);
    });

    it('첫 출력이 소스 변환 실패로 거부돼도 다음 출력은 소스 변환을 재시도한다', async () => {
      // mutation: prepare promise가 rejection까지 캐시하면 두 번째 출력이 캐시된 실패를
      // 재사용해 영구 실패한다 (리뷰 H-01 — 구 코드의 재시도 동작 보존)
      vi.mocked(converter.convertToImageElement).mockRejectedValueOnce(new Error('transient network error'));
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

      await expect(pipeline.toBlob()).rejects.toMatchObject({ code: 'CANVAS_CREATION_FAILED' });

      // 두 번째 호출은 실제 변환으로 회복하고, 실패 전 축적된 연산도 그대로 재생된다
      const result = await pipeline.toBlob();
      expect(result.width).toBe(100);
      expect(vi.mocked(converter.convertToImageElement)).toHaveBeenCalledTimes(2);
    });

    it('생성자 옵션이 기본값과 병합되어 소스 변환에 전달된다', async () => {
      // mutation: 옵션 병합(기본값 주입)을 제거하면 실패한다 — 표면 테스트와 동일 관찰 경계
      const canvas = createTestCanvas(400, 300, 'green');
      const bg = { r: 255, g: 255, b: 255, alpha: 1 };
      const pipeline = new OutputPipeline(canvas, { defaultBackground: bg });

      await pipeline.toBlob();

      expect(vi.mocked(converter.convertToImageElement)).toHaveBeenCalledWith(
        canvas,
        expect.objectContaining({
          defaultBackground: bg,
          crossOrigin: 'anonymous', // 기본값 병합 확인
        })
      );
    });
  });

  describe('연산 전달', () => {
    it('연산은 호출 즉시 파이프라인에 호출 순서대로 축적된다', async () => {
      // 파이프라인이 생성 시점부터 존재하므로 pending 재생 없이 직접 전달된다.
      // 렌더 결과는 연산 순서 무관(blur는 filters 누적, resize는 layout 계산)이다.
      const addResizeSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addResize');
      const addBlurSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addBlur');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      pipeline.addBlur(2);
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
      const result = await pipeline.toBlob();

      expect(addResizeSpy).toHaveBeenCalledTimes(1);
      expect(addBlurSpy).toHaveBeenCalledTimes(1);
      expect(addBlurSpy.mock.invocationCallOrder[0]).toBeLessThan(addResizeSpy.mock.invocationCallOrder[0]);
      expect(result.width).toBe(100);
    });

    it('여러 blur는 호출 순서대로 전달된다', async () => {
      const addBlurSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addBlur');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      pipeline.addBlur(2);
      pipeline.addBlur(5, { quality: 'high' } as never);
      await pipeline.toBlob();

      expect(addBlurSpy.mock.calls.map(([options]) => options.radius)).toEqual([2, 5]);
    });
  });

  describe('축적과 준비 시점', () => {
    it('출력 전 축적한 scale 설정은 첫 출력에 반영된다', async () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      pipeline.addResize({ fit: 'scale', scale: 0.5 });
      const result = await pipeline.toBlob();

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('첫 출력 후 addResize는 다음 출력에 반영된다', async () => {
      // 파이프라인이 생성 시점부터 하나뿐이므로 출력 전후의 반영 의미가 동일하다
      // (구 pending 재생 구조의 "첫 출력 후 무반영" quirk 소멸)
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      const first = await pipeline.toBlob();
      pipeline.addResize({ fit: 'scale', scale: 0.5 });
      const second = await pipeline.toBlob();

      expect(first.width).toBe(400);
      expect(second.width).toBe(200);
      expect(second.height).toBe(150);
    });

    it('첫 출력 후 addBlur도 다음 출력에 반영된다', async () => {
      const addBlurSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addBlur');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob();
      pipeline.addBlur(3);
      await pipeline.toBlob();

      expect(addBlurSpy).toHaveBeenCalledTimes(1);
      expect(addBlurSpy).toHaveBeenCalledWith(expect.objectContaining({ radius: 3 }));
    });

    it('출력 메타데이터에 원본 크기가 담긴다', async () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'blue'));
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

      const result = await pipeline.toBlob();

      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.originalSize).toEqual({ width: 400, height: 300 });
    });
  });

  describe('resize 1회 제약', () => {
    it('addResize 두 번째 호출은 동기적으로 거부한다 (메시지 1벌)', () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

      try {
        pipeline.addResize({ fit: 'fill', width: 50, height: 50 });
        expect.fail('두 번째 addResize는 에러를 던져야 한다');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessError);
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.message).toContain('can only be called once');
        }
      }
    });

    it('scale 설정과 box 설정을 섞어도 1회 제약은 동일하게 적용된다', () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));
      pipeline.addResize({ fit: 'scale', scale: 2 });

      expect(() => {
        pipeline.addResize({ fit: 'scale', scale: 0.5 });
      }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
    });

    it('config 검증 실패 시 1회 제약 상태가 남지 않는다', async () => {
      // mutation: 기록을 검증보다 먼저 수행하면 두 번째(정상) 호출이 거부되어 실패한다
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      expect(() => pipeline.addResize({ fit: 'cover', width: -1, height: 100 })).toThrow(ImageProcessError);

      // 검증 실패는 상태를 남기지 않으므로 정상 config는 성공해야 한다
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
      const result = await pipeline.toBlob();
      expect(result.width).toBe(100);
    });
  });

  describe('포맷/품질 기본값', () => {
    it('무인자 toBlob은 스마트 기본 포맷과 그 포맷의 최적 품질을 적용한다', async () => {
      // 스마트 포맷: webp 지원 시 webp(0.8), 아니면 png(1.0). 포맷-품질 쌍으로 단언한다.
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob();

      const [, mimeType, quality] = toBlobSpy.mock.calls[0] ?? [];
      expect([
        ['image/webp', 0.8],
        ['image/png', 1.0],
      ]).toContainEqual([mimeType, quality]);
    });

    it('문자열 포맷 지정 시 해당 포맷의 최적 품질을 적용한다', async () => {
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob('jpeg');

      const [, mimeType, quality] = toBlobSpy.mock.calls[0] ?? [];
      expect(mimeType).toBe('image/jpeg');
      expect(quality).toBe(0.85);
    });

    it('quality 0은 falsy가 아니라 0으로 보존된다', async () => {
      // mutation: `options.quality || 기본값` 패턴을 쓰면 0이 기본값으로 대체되어 실패한다
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob({ format: 'jpeg', quality: 0 });

      const [, , quality] = toBlobSpy.mock.calls[0] ?? [];
      expect(quality).toBe(0);
    });

    it('format만 지정하고 quality를 생략하면 그 포맷의 최적 품질을 적용한다', async () => {
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob({ format: 'png' });

      const [, mimeType, quality] = toBlobSpy.mock.calls[0] ?? [];
      expect(mimeType).toBe('image/png');
      expect(quality).toBe(1.0);
    });
  });

  describe('toFile 파일명/포맷 해석', () => {
    it('파일명 확장자에서 포맷과 최적 품질을 추론한다', async () => {
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      const result = await pipeline.toFile('image.jpg');

      expect(result.file.name).toBe('image.jpg');
      const [, mimeType, quality] = toBlobSpy.mock.calls[0] ?? [];
      expect(mimeType).toBe('image/jpeg');
      expect(quality).toBe(0.85);
    });

    it('포맷 지정 시 파일명 확장자를 그 포맷에 맞춰 정규화한다', async () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      const result = await pipeline.toFile('photo.png', 'jpeg');

      expect(result.file.name).toBe('photo.jpg');
    });

    it('알려진 확장자가 없으면 포맷의 권장 확장자를 덧붙인다', async () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      const result = await pipeline.toFile('photo', { format: 'png' });

      expect(result.file.name).toBe('photo.png');
    });
  });

  describe('CanvasLease 소유권', () => {
    it('toBlob은 인코딩 후 canvas를 pool로 반환한다', async () => {
      // mutation: consume 대신 canvas를 직접 꺼내 쓰면 pool 반환이 사라져 실패한다
      const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob();

      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });

    it('toCanvas는 canvas를 pool로 반환하지 않고 사용자 소유로 이전한다', async () => {
      const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'blue'));
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

      const result = await pipeline.toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(100);
      expect(result.originalSize).toEqual({ width: 400, height: 300 });
      expect(releaseSpy).not.toHaveBeenCalled();
    });

    it('인코딩 실패 시에도 canvas는 pool로 반환된다', async () => {
      const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release');
      // 요청 포맷과 fallback 둘 다 인코딩 실패(null)로 만든다
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toBlob()).rejects.toThrow();

      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('에러 모드', () => {
    it('인코딩 실패는 OUTPUT_FAILED로 래핑한다', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toBlob()).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'OUTPUT_FAILED',
      });
    });

    it('소스 변환의 일반 오류는 CANVAS_CREATION_FAILED로 래핑한다', async () => {
      vi.mocked(converter.convertToImageElement).mockRejectedValueOnce(new Error('boom'));
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toBlob()).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'CANVAS_CREATION_FAILED',
      });
    });

    it('toCanvas 실패는 Canvas 변환 메시지의 OUTPUT_FAILED로 래핑한다', async () => {
      vi.mocked(converter.convertToImageElement).mockRejectedValueOnce(new Error('boom'));
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toCanvas()).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'OUTPUT_FAILED',
        message: 'Error occurred during Canvas conversion',
      });
    });

    it('toCanvasDetailed 실패는 detailed 메시지의 OUTPUT_FAILED로 래핑한다', async () => {
      // toCanvasDetailed는 에러 메시지 문자열 차이가 toCanvas와의 유일한 계약이다
      vi.mocked(converter.convertToImageElement).mockRejectedValueOnce(new Error('boom'));
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toCanvasDetailed()).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'OUTPUT_FAILED',
        message: 'Error occurred during detailed Canvas conversion',
      });
    });

    it('소스 변환의 ImageProcessError는 코드를 보존한 채 통과한다', async () => {
      vi.mocked(converter.convertToImageElement).mockRejectedValueOnce(
        new ImageProcessError('invalid source', 'INVALID_SOURCE')
      );
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toBlob()).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'INVALID_SOURCE',
      });
    });
  });
});
