/**
 * LazyRenderPipeline.addTransform 가드 검증 (jsdom-safe)
 *
 * 렌더까지 가지 않고 누적·검증·1회 가드·순서 가드만 본다.
 * 실제 렌더 결과는 single-renderer.transform 테스트와 processor 체인 테스트가 담당한다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline.internal';
import { ImageProcessError } from '../../../src/types';

function expectCode(fn: () => void, code: string): void {
  try {
    fn();
    expect.fail('ImageProcessError가 발생해야 한다');
  } catch (error) {
    expect(error).toBeInstanceOf(ImageProcessError);
    if (error instanceof ImageProcessError) {
      expect(error.code).toBe(code);
    }
  }
}

describe('LazyRenderPipeline.addTransform', () => {
  let pipeline: LazyRenderPipeline;

  beforeEach(() => {
    pipeline = new LazyRenderPipeline();
  });

  it('정규화된 transform 연산 하나를 누적한다', () => {
    pipeline.addTransform({ rotate: -90, crop: { x: 0.4, y: 0, width: 10, height: 10 } });

    expect(pipeline.getOperationCount()).toBe(1);
    expect(pipeline.getOperations()[0]).toEqual({
      type: 'transform',
      transform: {
        crop: { x: 0, y: 0, width: 10, height: 10 },
        flipX: false,
        flipY: false,
        degrees: 270,
        expand: true,
      },
    });
  });

  it('빈 옵션도 연산으로 누적한다 (no-op, 1회 슬롯 소비)', () => {
    pipeline.addTransform({});
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('두 번째 호출은 OPTION_INVALID로 거부한다', () => {
    pipeline.addTransform({ rotate: 90 });
    expectCode(() => pipeline.addTransform({ rotate: 180 }), 'OPTION_INVALID');
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('resize 뒤 호출은 OPTION_INVALID로 거부한다', () => {
    pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
    expectCode(() => pipeline.addTransform({ rotate: 90 }), 'OPTION_INVALID');
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('검증 실패 시 아무 상태도 남기지 않아 재호출이 가능하다', () => {
    expectCode(() => pipeline.addTransform({ rotate: Number.NaN }), 'OPTION_INVALID');
    expect(pipeline.getOperationCount()).toBe(0);

    pipeline.addTransform({ rotate: 90 });
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('crop 값 오류는 INVALID_DIMENSIONS로 전달된다', () => {
    expectCode(() => pipeline.addTransform({ crop: { x: 0, y: 0, width: 0, height: 10 } }), 'INVALID_DIMENSIONS');
  });

  it('transform 뒤 resize·blur는 정상 누적된다', () => {
    pipeline.addTransform({ flip: { horizontal: true } });
    pipeline.addBlur({ radius: 2 });
    pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

    expect(pipeline.getOperations().map((op) => op.type)).toEqual(['transform', 'blur', 'resize']);
  });
});
