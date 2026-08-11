/**
 * processor.toArrayBuffer() 비동기 콜백 예외 래핑 회귀 테스트다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasLease } from '../../../src/base/canvas-lease.internal';

import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline.internal';
import * as converter from '../../../src/core/source-converter/index';
import { processImage } from '../../../src/processor';

// 소스 변환을 대체하기 위한 모듈 mock (실제 구현은 각 테스트에서 mockResolvedValue로 지정)
vi.mock('../../../src/core/source-converter/index', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../src/core/source-converter/index')>();
  return {
    ...orig,
    convertToImageElement: vi.fn().mockImplementation(orig.convertToImageElement),
  };
});

function createRenderOutput(canvas: HTMLCanvasElement): ReturnType<LazyRenderPipeline['render']> {
  return {
    lease: new CanvasLease(canvas),
    metadata: {
      width: canvas.width,
      height: canvas.height,
      processingTime: 0,
      operations: 0,
    },
  } as unknown as ReturnType<LazyRenderPipeline['render']>;
}

function createCanvasWithBlob(blob: Blob): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
    callback(blob);
  });
  return canvas;
}

function createCanvasWithAsyncBlob(blob: Blob): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
    setTimeout(() => callback(blob), 0);
  });
  return canvas;
}

/**
 * controlled canvas를 반환하는 processor를 만든다.
 * private 구현 대신 안정적 seam(소스 변환 mock + 렌더 코어의 공개 interface인
 * LazyRenderPipeline.render)을 대체해 jsdom에서 결정적으로 진행시킨다.
 */
function createProcessorWithCanvas(canvas: HTMLCanvasElement): ReturnType<typeof processImage> {
  vi.mocked(converter.convertToImageElement).mockResolvedValue({
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  } as unknown as HTMLImageElement);
  vi.spyOn(LazyRenderPipeline.prototype, 'render').mockReturnValue(createRenderOutput(canvas));
  return processImage(new Blob(['input'], { type: 'image/png' }));
}

describe('toArrayBuffer 오류 원인 보존', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('toBlob 콜백 내부 예외를 OUTPUT_FAILED로 감싸고 cause를 보존한다', async () => {
    vi.useFakeTimers();
    const canvas = createCanvasWithAsyncBlob(new Blob(['output'], { type: 'image/png' }));
    const cause = new Error('canvas release failed');
    vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {
      throw cause;
    });

    const result = createProcessorWithCanvas(canvas).toArrayBuffer();
    // release 실패는 lease.consume → toBlob에서 OUTPUT_FAILED로 감싸이고,
    // toArrayBuffer가 한 번 더 감싼다. 원인 체인으로 원본 에러가 보존된다.
    const assertion = expect(result).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({ code: 'OUTPUT_FAILED', cause }),
    });

    await vi.runAllTimersAsync();

    await assertion;
  });

  it('Blob 획득은 png 출력 경로를 사용하고 ArrayBuffer를 반환한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['output'], { type: 'image/png' }));

    const result = await createProcessorWithCanvas(canvas).toArrayBuffer();

    expect(result.byteLength).toBe(6);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', expect.any(Number));
  });
});
