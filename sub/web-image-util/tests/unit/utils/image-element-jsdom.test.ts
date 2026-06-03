import { describe, expect, it } from 'vitest';

import { createImageElement } from '../../../src/utils/image-element';

describe('createImageElement', () => {
  it('크기 인자가 없으면 빈 img 요소를 만든다', () => {
    const img = createImageElement();

    expect(img.tagName).toBe('IMG');
    // 크기를 지정하지 않으면 width/height 속성을 건드리지 않는다.
    expect(img.getAttribute('width')).toBeNull();
    expect(img.getAttribute('height')).toBeNull();
  });

  it('크기 인자를 주면 img의 width/height에 반영한다', () => {
    const img = createImageElement({ width: 320, height: 180 });

    expect(img.tagName).toBe('IMG');
    expect(img.width).toBe(320);
    expect(img.height).toBe(180);
  });

  it('0 크기도 그대로 반영한다', () => {
    const img = createImageElement({ width: 0, height: 0 });

    expect(img.width).toBe(0);
    expect(img.height).toBe(0);
  });
});
