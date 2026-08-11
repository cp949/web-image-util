/**
 * OutputPipeline 행동 테스트.
 *
 * 출력 경로 deep module의 public interface(생성자/addResize/addResizeOperation/addBlur/출력 메서드)
 * 경유로만 검증한다. 내부 상태 단언 금지.
 *
 * 검증 계약 (아키텍처 리뷰 #2 계획서):
 * - 소스 준비 캐싱: 출력 N회에 소스 변환 1회 (동시 첫 출력 포함)
 * - pending 재생 순서: resize → blur (축적 순서와 무관)
 * - 준비 후 addResizeOperation 즉시 반영 / addResize 무반영 (현행 quirk 보존)
 * - resize 1회 제약: 경로별 메시지 2종, 검증 실패 시 상태 무변화
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

  describe('pending 재생 순서', () => {
    it('blur를 resize보다 먼저 축적해도 재생은 resize가 먼저다', async () => {
      // 재생 순서(resize config → blur)는 현행 setupLazyPipeline의 계약이다.
      // interface 결과(픽셀)로는 관찰 불가하므로 렌더 코어 접수 순서를 스파이로 관찰한다(실구현 유지).
      const addResizeSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addResize');
      const addBlurSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addBlur');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      pipeline.addBlur(2);
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
      await pipeline.toBlob();

      expect(addResizeSpy).toHaveBeenCalledTimes(1);
      expect(addBlurSpy).toHaveBeenCalledTimes(1);
      expect(addResizeSpy.mock.invocationCallOrder[0]).toBeLessThan(addBlurSpy.mock.invocationCallOrder[0]);
    });

    it('여러 blur는 호출 순서대로 재생된다', async () => {
      const addBlurSpy = vi.spyOn(LazyRenderPipeline.prototype, 'addBlur');
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      pipeline.addBlur(2);
      pipeline.addBlur(5, { quality: 'high' } as never);
      await pipeline.toBlob();

      expect(addBlurSpy.mock.calls.map(([options]) => options.radius)).toEqual([2, 5]);
    });
  });

  describe('축적과 준비 시점', () => {
    it('준비 전 addResizeOperation은 첫 출력에서 재생된다', async () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      pipeline.addResizeOperation({ type: 'scale', value: 0.5 });
      const result = await pipeline.toBlob();

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('첫 출력 후 addResizeOperation은 다음 출력에 즉시 반영된다', async () => {
      // mutation: 준비 후 즉시 전달 분기를 제거하면 두 번째 출력이 400x300으로 남아 실패한다
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      const first = await pipeline.toBlob();
      pipeline.addResizeOperation({ type: 'scale', value: 0.5 });
      const second = await pipeline.toBlob();

      expect(first.width).toBe(400);
      expect(second.width).toBe(200);
      expect(second.height).toBe(150);
    });

    it('첫 출력 후 addResize는 이후 출력에 반영되지 않는다 (현행 동작 보존)', async () => {
      // 초기화 이후 resize config 무반영은 관찰 가능한 현행 공개 동작이다 — 동작 불변 원칙으로 고정
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await pipeline.toBlob();
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
      const second = await pipeline.toBlob();

      expect(second.width).toBe(400);
      expect(second.height).toBe(300);
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
    it('addResize 두 번째 호출은 resize 경로 메시지로 거부한다', () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));
      pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

      try {
        pipeline.addResize({ fit: 'fill', width: 50, height: 50 });
        expect.fail('두 번째 addResize는 에러를 던져야 한다');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessError);
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.message).toContain('single resize() call');
        }
      }
    });

    it('addResizeOperation 두 번째 호출은 operation 경로 메시지로 거부한다', () => {
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));
      pipeline.addResizeOperation({ type: 'scale', value: 2 });

      try {
        pipeline.addResizeOperation({ type: 'scale', value: 0.5 });
        expect.fail('두 번째 addResizeOperation은 에러를 던져야 한다');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessError);
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.message).toContain('single resize operation');
        }
      }
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
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
        callback(null);
      });
      const pipeline = new OutputPipeline(createTestCanvas(400, 300, 'red'));

      await expect(pipeline.toBlob()).rejects.toThrow();

      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('에러 모드', () => {
    it('인코딩 실패는 OUTPUT_FAILED로 래핑한다', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
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
