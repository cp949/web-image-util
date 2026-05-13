import { describe, expect, it } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import { loadImageElement } from '../../../src/utils/image-loader';

/**
 * jsdom + canvas의 이미지 로딩 경계를 검증한다.
 * src setter를 가로채 자동 트리거를 막고, 테스트에서 직접 이벤트를 발생시킨다.
 */
function createControlledImg(): { img: HTMLImageElement; triggerLoad: () => void; triggerError: () => void } {
  const img = document.createElement('img');
  Object.defineProperty(img, 'src', {
    set: (_val: string) => {
      // 의도적으로 아무 동작도 하지 않는다. 테스트에서 직접 이벤트를 트리거한다.
    },
    get: () => '',
    configurable: true,
  });

  return {
    img,
    triggerLoad: () => img.onload?.(new Event('load')),
    triggerError: () => img.onerror?.(new Event('error')),
  };
}

describe('이미지 요소 로딩 헬퍼', () => {
  it('로드 성공 시 onload와 onerror 핸들러를 모두 해제한다', async () => {
    const { img, triggerLoad } = createControlledImg();
    const promise = loadImageElement(img, 'data:image/png;base64,iVBORw0KGgo=');
    triggerLoad();
    await promise;
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });

  it('로드 실패 시 ImageProcessError를 던지고 핸들러를 해제한다', async () => {
    const { img, triggerError } = createControlledImg();
    const promise = loadImageElement(img, 'invalid');
    triggerError();
    await expect(promise).rejects.toBeInstanceOf(ImageProcessError);
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });

  it('커스텀 errorCode를 사용한다', async () => {
    const { img, triggerError } = createControlledImg();
    const promise = loadImageElement(img, 'invalid', 'SOURCE_LOAD_FAILED');
    triggerError();
    await expect(promise).rejects.toMatchObject({ code: 'SOURCE_LOAD_FAILED' });
  });

  it('기본 errorCode는 IMAGE_LOAD_FAILED다', async () => {
    const { img, triggerError } = createControlledImg();
    const promise = loadImageElement(img, 'invalid');
    triggerError();
    await expect(promise).rejects.toMatchObject({ code: 'IMAGE_LOAD_FAILED' });
  });
});
