/**
 * processor.toElement() cleanup 동작 회귀 테스트다.
 *
 * onload/onerror 핸들러 해제와 objectURL revoke가 올바르게 수행되는지 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline.internal';
import * as converter from '../../../src/core/source-converter/index';

import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';

// 소스 변환을 대체하기 위한 모듈 mock (실제 구현은 각 테스트에서 mockResolvedValue로 지정)
vi.mock('../../../src/core/source-converter/index', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../src/core/source-converter/index')>();
  return {
    ...orig,
    convertToImageElement: vi.fn().mockImplementation(orig.convertToImageElement),
  };
});

const originalDocumentCreateElement = document.createElement;

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

function createCanvasWithBlob(blob: Blob | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
    callback(blob);
  });
  return canvas;
}

function createControlledImage(result: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img');
  let assignedSrc = '';

  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      if (result === 'load') {
        img.onload?.(new Event('load'));
        return;
      }
      img.onerror?.(new Event('error'));
    },
  });

  return img;
}

/**
 * controlled canvas를 반환하는 processor를 만든다.
 * private 구현 대신 안정적 seam(소스 변환 mock + 렌더 코어의 공개 interface인
 * LazyRenderPipeline.render)을 대체해 jsdom에서 결정적으로 진행시킨다.
 */
function createProcessorWithCanvas(canvas: HTMLCanvasElement): any {
  vi.mocked(converter.convertToImageElement).mockResolvedValue({
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  } as unknown as HTMLImageElement);
  vi.spyOn(LazyRenderPipeline.prototype, 'render').mockReturnValue(createRenderOutput(canvas));
  return processImage(new Blob(['input'], { type: 'image/png' }));
}

describe('toElement cleanup 동작', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:processor-to-element');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.createElement = originalDocumentCreateElement;
  });

  it('성공 경로: processor.toElement()가 onload 후 핸들러를 해제하고 URL을 revoke한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['output'], { type: 'image/png' }));
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') {
        return img;
      }
      throw new Error(`Unexpected element creation: ${tagName}`);
    });

    let element: HTMLImageElement;
    try {
      element = await createProcessorWithCanvas(canvas).toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(element).toBe(img);
    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:processor-to-element');
  });

  it('실패 경로: processor.toElement()가 onerror 후 핸들러를 해제하고 URL을 revoke한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['output'], { type: 'image/png' }));
    const img = createControlledImage('error');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') {
        return img;
      }
      throw new Error(`Unexpected element creation: ${tagName}`);
    });

    try {
      await expect(createProcessorWithCanvas(canvas).toElement()).rejects.toBeInstanceOf(ImageProcessError);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:processor-to-element');
  });

  it('objectURL 생성 예외를 OUTPUT_FAILED로 감싸고 cause를 보존한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['output'], { type: 'image/png' }));
    const cause = new Error('object url unavailable');
    createObjectURLSpy.mockImplementation(() => {
      throw cause;
    });

    await expect(createProcessorWithCanvas(canvas).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: cause,
    });
  });
});
