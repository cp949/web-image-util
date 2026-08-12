import { vi } from 'vitest';

/** result 구현체 테스트에서 img load/error를 동기적으로 제어한다. */
export function createControlledImg(outcome: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img') as HTMLImageElement;
  let assignedSrc = '';
  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      if (outcome === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });
  return img;
}

/**
 * document.createElement를 가로채 img·canvas를 지정한 인스턴스로 바꾼다.
 *
 * 등록하지 않은 태그를 만들려 하면 던져서, 테스트가 의도한 경로만 지나갔음을
 * 보장한다. `createTestCanvas` 등으로 실제 요소가 필요하면 호출 전에 만들어 둔다.
 */
export function stubCreateElement(elements: { img?: HTMLImageElement; canvas?: HTMLCanvasElement }) {
  return vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'img' && elements.img) return elements.img;
    if (tagName === 'canvas' && elements.canvas) return elements.canvas;
    throw new Error(`예상치 못한 태그: ${tagName}`);
  });
}

/** drawImage만 기록하는 canvas mock을 만든다. */
export function createRecordingCanvas(): { canvas: HTMLCanvasElement; drawImage: ReturnType<typeof vi.fn> } {
  const canvas = document.createElement('canvas');
  const drawImage = vi.fn();
  vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  return { canvas, drawImage };
}
