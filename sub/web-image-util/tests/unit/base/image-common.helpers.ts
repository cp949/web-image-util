import { type MockInstance, vi } from 'vitest';

// 테스트용 작은 SVG fixture.
export const SIMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

export const createImageBlob = (type: string, content: BlobPart[] = []) => new Blob(content, { type });

type CapturedAnchor = {
  anchor: HTMLAnchorElement | null;
  clickSpy: MockInstance | null;
};

/** document.createElement('a') 호출에서 생성된 anchor와 click spy를 캡처한다. */
export function spyCreateAnchor(): CapturedAnchor {
  const captured: CapturedAnchor = { anchor: null, clickSpy: null };
  const realCreate = document.createElement.bind(document);

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreate(tag);
    if (tag === 'a') {
      captured.anchor = el as HTMLAnchorElement;
      captured.clickSpy = vi.spyOn(captured.anchor, 'click').mockImplementation(() => {});
    }
    return el;
  });

  return captured;
}

/**
 * src 할당 시 동기적으로 load/error 이벤트를 발생시키는 제어 img를 만든다.
 * 할당된 src는 getter로 노출해 어떤 URL이 전달됐는지 검증할 수 있다.
 */
export function createControlledImg(outcome: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img') as HTMLImageElement;
  let assignedSrc = '';
  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      // urlToElement는 onload/onerror를 src 할당 전에 등록하므로 동기 트리거가 안전하다.
      if (outcome === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });
  return img;
}

/** document.createElement('img') 호출만 제어 img로 가로채고 나머지는 원본을 사용한다. */
export function spyCreateImg(controlledImg: HTMLImageElement): MockInstance {
  const realCreate = document.createElement.bind(document);
  return vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'img') return controlledImg as unknown as HTMLElement;
    return realCreate(tag as keyof HTMLElementTagNameMap);
  });
}
