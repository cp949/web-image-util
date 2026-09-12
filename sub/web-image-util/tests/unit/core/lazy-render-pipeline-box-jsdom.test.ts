/**
 * LazyRenderPipeline.addBox 가드 검증 (jsdom-safe)
 *
 * 렌더까지 가지 않고 누적·검증·1회 가드만 본다.
 * 실제 렌더 결과는 single-renderer.box 테스트와 processor 체인 테스트가 담당한다.
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

describe('LazyRenderPipeline.addBox', () => {
  let pipeline: LazyRenderPipeline;

  beforeEach(() => {
    pipeline = new LazyRenderPipeline();
  });

  it('정규화된 box 연산 하나를 누적한다', () => {
    pipeline.addBox({ padding: 10, background: '#fff' });

    expect(pipeline.getOperationCount()).toBe(1);
    expect(pipeline.getOperations()[0]).toEqual({
      type: 'box',
      box: {
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        background: '#fff',
        radius: 0,
        border: null,
      },
    });
  });

  it('빈 옵션도 연산으로 누적한다 (no-op, 1회 슬롯 소비)', () => {
    pipeline.addBox({});
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('두 번째 호출은 OPTION_INVALID로 거부한다', () => {
    pipeline.addBox({ padding: 4 });
    expectCode(() => pipeline.addBox({ padding: 8 }), 'OPTION_INVALID');
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('검증 실패 시 아무 상태도 남기지 않아 재호출이 가능하다', () => {
    expectCode(() => pipeline.addBox({ padding: -1 }), 'OPTION_INVALID');
    expect(pipeline.getOperationCount()).toBe(0);

    pipeline.addBox({ padding: 4 });
    expect(pipeline.getOperationCount()).toBe(1);
  });

  it('box() 뒤 resize()는 정상 누적된다', () => {
    pipeline.addBox({ radius: 10 });
    pipeline.addResize({ fit: 'cover', width: 100, height: 100 });

    expect(pipeline.getOperations().map((op) => op.type)).toEqual(['box', 'resize']);
  });

  it('resize() 뒤 box()는 정상 누적된다', () => {
    pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
    pipeline.addBox({ radius: 10 });

    expect(pipeline.getOperations().map((op) => op.type)).toEqual(['resize', 'box']);
  });

  it('box·transform·resize·blur를 함께 쓰면 전부 정상 누적된다', () => {
    pipeline.addTransform({ rotate: 90 });
    pipeline.addBlur({ radius: 2 });
    pipeline.addResize({ fit: 'cover', width: 100, height: 100 });
    pipeline.addBox({ padding: 4 });

    expect(pipeline.getOperations().map((op) => op.type)).toEqual(['transform', 'blur', 'resize', 'box']);
  });
});
