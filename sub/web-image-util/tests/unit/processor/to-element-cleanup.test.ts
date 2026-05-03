/**
 * processor.toElement() cleanup 동작 회귀 테스트다.
 *
 * onload/onerror 핸들러 해제와 objectURL revoke가 올바르게 수행되는지 검증한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';

const originalDocumentCreateElement = document.createElement;

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

function createProcessorWithCanvas(canvas: HTMLCanvasElement): any {
  const processor = processImage(new Blob(['input'], { type: 'image/png' }));
  vi.spyOn(processor as any, 'executeProcessing').mockResolvedValue({ canvas });
  return processor;
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
});
