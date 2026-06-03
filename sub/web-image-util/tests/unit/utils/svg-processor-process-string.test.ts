/**
 * SVGProcessor.processSVGString()의 Blob URL 정리, normalize 옵션, 기본 크기 보정 계약을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import { enhanceSvgForBrowser } from '../../../src/utils/svg-compatibility';
import { SVGProcessor } from '../../../src/utils/svg-processor.internal';
import { createControlledImage, SVG_NO_DIMS, SVG_WITH_WH, VALID_SVG } from './svg-processor.helpers';

vi.mock('../../../src/utils/svg-compatibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/svg-compatibility')>();
  return {
    ...actual,
    enhanceSvgForBrowser: vi.fn(actual.enhanceSvgForBrowser),
  };
});

describe('SVGProcessor.processSVGString()', () => {
  const FAKE_BLOB_URL = 'blob:svg-processor-test';

  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(FAKE_BLOB_URL);
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    vi.mocked(enhanceSvgForBrowser).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('성공 경로: URL.createObjectURL이 Blob을 인수로 받아 호출된다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('성공 경로: onload 후 URL.revokeObjectURL이 생성된 URL로 호출된다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(FAKE_BLOB_URL);
  });

  it('실패 경로: onerror 후에도 URL.revokeObjectURL이 반드시 호출된다', async () => {
    const img = createControlledImage('error');
    const createElementSpy = mockImageElement(img);

    try {
      await expect(SVGProcessor.processSVGString(VALID_SVG)).rejects.toBeInstanceOf(ImageProcessError);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(FAKE_BLOB_URL);
  });

  it('실패 경로: ImageProcessError 코드가 SVG_LOAD_FAILED이다', async () => {
    const img = createControlledImage('error');
    const createElementSpy = mockImageElement(img);

    try {
      await expect(SVGProcessor.processSVGString(VALID_SVG)).rejects.toMatchObject({
        code: 'SVG_LOAD_FAILED',
      });
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('crossOrigin 옵션을 img.crossOrigin에 설정한다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG, { crossOrigin: 'anonymous' });
    } finally {
      createElementSpy.mockRestore();
    }

    expect(img.crossOrigin).toBe('anonymous');
  });

  it('crossOrigin 옵션 없으면 img.crossOrigin을 변경하지 않는다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(img.crossOrigin).toBeFalsy();
  });

  it('normalize 옵션이 false이면 원본 SVG 문자열을 그대로 Blob으로 변환한다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG, { normalize: false });
    } finally {
      createElementSpy.mockRestore();
    }

    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toBe(VALID_SVG);
  });

  it('normalize: true(기본)이면 enhanceSvgForBrowser를 원본 SVG로 호출한다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(vi.mocked(enhanceSvgForBrowser)).toHaveBeenCalledWith(VALID_SVG);
  });

  it('normalize: false이면 enhanceSvgForBrowser를 호출하지 않는다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG, { normalize: false });
    } finally {
      createElementSpy.mockRestore();
    }

    expect(vi.mocked(enhanceSvgForBrowser)).not.toHaveBeenCalled();
  });

  it('img.src에 createObjectURL 결과 URL이 할당된다', async () => {
    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(VALID_SVG);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(img.src).toBe(FAKE_BLOB_URL);
  });

  it('크기 없는 SVG에 defaultWidth·defaultHeight가 주어지면 Blob에 그 크기가 반영된다', async () => {
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_NO_DIMS);

    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(SVG_NO_DIMS, { defaultWidth: 120, defaultHeight: 80 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toContain('width="120"');
    expect(blobText).toContain('height="80"');
  });

  it('createObjectURL이 일반 예외를 던지면 SVG_PROCESSING_FAILED 코드로 wrap한다', async () => {
    createObjectURLSpy.mockImplementation(() => {
      throw new Error('Blob URL 생성 실패');
    });

    await expect(SVGProcessor.processSVGString(VALID_SVG)).rejects.toMatchObject({
      code: 'SVG_PROCESSING_FAILED',
    });
  });

  it('크기 있는 SVG에 defaultWidth·defaultHeight를 주어도 원래 크기가 유지된다', async () => {
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_WITH_WH);

    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(SVG_WITH_WH, { defaultWidth: 500, defaultHeight: 600 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).not.toContain('width="500"');
    expect(blobText).not.toContain('height="600"');
    expect(blobText).toContain('width="100"');
  });

  it('defaultWidth만 주면 height는 300으로 폴백된다', async () => {
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_NO_DIMS);

    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(SVG_NO_DIMS, { defaultWidth: 150 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toContain('width="150"');
    expect(blobText).toContain('height="300"');
  });

  it('defaultHeight만 주면 width는 300으로 폴백된다', async () => {
    vi.mocked(enhanceSvgForBrowser).mockReturnValueOnce(SVG_NO_DIMS);

    const img = createControlledImage('load');
    const createElementSpy = mockImageElement(img);

    try {
      await SVGProcessor.processSVGString(SVG_NO_DIMS, { defaultHeight: 90 });
    } finally {
      createElementSpy.mockRestore();
    }

    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const blobText = await blob.text();
    expect(blobText).toContain('width="300"');
    expect(blobText).toContain('height="90"');
  });
});

function mockImageElement(img: HTMLImageElement) {
  return vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'img') return img;
    throw new Error(`예상치 못한 createElement 호출: ${tagName}`);
  });
}
