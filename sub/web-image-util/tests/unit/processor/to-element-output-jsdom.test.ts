/**
 * processor.toElement() 정상 경로 행동 테스트다.
 *
 * HTMLImageElement 반환 형태, URL.createObjectURL 호출 계약,
 * resize/blur 체이닝 도달성을 검증한다.
 * cleanup 동작(핸들러 해제, URL revoke)은 to-element-cleanup.test.ts에서 다룬다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { processImage } from '../../../src/processor';

const originalDocumentCreateElement = document.createElement;

/**
 * controlled canvas를 반환하는 processor를 만든다. executeProcessing을 spy로 대체한다.
 * toElement()는 공개 TypedImageProcessor 인터페이스에 없어 any로 반환한다.
 */
function createProcessorWithCanvas(canvas: HTMLCanvasElement): any {
  const processor = processImage(new Blob(['input'], { type: 'image/png' }));
  vi.spyOn(processor as any, 'executeProcessing').mockResolvedValue({ canvas });
  return processor;
}

/**
 * toBlob이 즉시 주어진 blob을 콜백에 전달하는 canvas를 만든다.
 * jsdom Canvas의 toBlob은 실제 인코딩 결과를 보장하지 않으므로,
 * mock으로 결정적인 Blob을 주입해 테스트를 안정적으로 유지한다.
 */
function createCanvasWithBlob(blob: Blob | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
    callback(blob);
  });
  return canvas;
}

/**
 * src를 설정하는 즉시 onload 또는 onerror를 동기적으로 발행하는 img를 만든다.
 * jsdom Image.src 로딩이 실제로 동작하지 않는 환경에서 비동기 체인을 진행시킨다.
 */
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

describe('toElement() 정상 경로 반환 형태', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:to-element-output-test');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.createElement = originalDocumentCreateElement;
  });

  it('정상 입력에서 HTMLImageElement를 반환한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['png-bytes'], { type: 'image/png' }));
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    let result: HTMLImageElement;
    try {
      result = await createProcessorWithCanvas(canvas).toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(result).toBeInstanceOf(HTMLImageElement);
    expect(result).toBe(img);
  });

  it('반환된 img는 onload 발행 시점에 ObjectURL이 src로 설정되었다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['png-bytes'], { type: 'image/png' }));
    const img = createControlledImage('load');
    // src가 set될 때의 값을 기록한다.
    const capturedSrc: string[] = [];
    const originalDescriptor = Object.getOwnPropertyDescriptor(img, 'src')!;
    const originalSet = originalDescriptor.set!;
    Object.defineProperty(img, 'src', {
      configurable: true,
      get: originalDescriptor.get,
      set: (value: string) => {
        capturedSrc.push(value);
        originalSet.call(img, value);
      },
    });

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    try {
      await createProcessorWithCanvas(canvas).toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    // img.src에 ObjectURL이 설정되었어야 한다.
    expect(capturedSrc).toHaveLength(1);
    expect(capturedSrc[0]).toBe('blob:to-element-output-test');
  });
});

describe('toElement() URL.createObjectURL 호출 계약', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:to-element-output-test');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.createElement = originalDocumentCreateElement;
  });

  it('URL.createObjectURL이 정확히 1회 호출된다', async () => {
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const canvas = createCanvasWithBlob(blob);
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    try {
      await createProcessorWithCanvas(canvas).toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('URL.createObjectURL의 인자는 Blob 인스턴스이고 type이 image/png다', async () => {
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const canvas = createCanvasWithBlob(blob);
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    try {
      await createProcessorWithCanvas(canvas).toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    const calledBlob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(calledBlob).toBeInstanceOf(Blob);
    expect(calledBlob.type).toBe('image/png');
  });

  it('Promise 해결 후 URL.revokeObjectURL이 동일한 ObjectURL로 1회 호출된다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['png-bytes'], { type: 'image/png' }));
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    try {
      await createProcessorWithCanvas(canvas).toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:to-element-output-test');
  });
});

describe('toElement() 체이닝 도달성', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:to-element-chain-test');
    vi.spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.createElement = originalDocumentCreateElement;
  });

  it('resize().toElement() 체이닝이 HTMLImageElement를 반환한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['png-bytes'], { type: 'image/png' }));
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    // resize()를 거쳐 executeProcessing이 호출되는 경로를 spy로 우회한다.
    const blob = new Blob(['input'], { type: 'image/png' });
    const processor: any = processImage(blob).resize({ fit: 'cover', width: 200, height: 200 });
    vi.spyOn(processor, 'executeProcessing').mockResolvedValue({ canvas });

    let result: HTMLImageElement;
    try {
      result = await processor.toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(result).toBeInstanceOf(HTMLImageElement);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('blur().resize().toElement() 체이닝이 HTMLImageElement를 반환한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['png-bytes'], { type: 'image/png' }));
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    const blob = new Blob(['input'], { type: 'image/png' });
    const processor: any = processImage(blob).blur(2).resize({ fit: 'cover', width: 200, height: 200 });
    vi.spyOn(processor, 'executeProcessing').mockResolvedValue({ canvas });

    let result: HTMLImageElement;
    try {
      result = await processor.toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(result).toBeInstanceOf(HTMLImageElement);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('blur().toElement() 체이닝(resize 없음)이 HTMLImageElement를 반환한다', async () => {
    const canvas = createCanvasWithBlob(new Blob(['png-bytes'], { type: 'image/png' }));
    const img = createControlledImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'img') return img;
      throw new Error(`예상치 않은 element 생성: ${tagName}`);
    });

    const blob = new Blob(['input'], { type: 'image/png' });
    const processor: any = processImage(blob).blur(2);
    vi.spyOn(processor, 'executeProcessing').mockResolvedValue({ canvas });

    let result: HTMLImageElement;
    try {
      result = await processor.toElement();
    } finally {
      createElementSpy.mockRestore();
    }

    expect(result).toBeInstanceOf(HTMLImageElement);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });
});
