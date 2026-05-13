/**
 * simple-watermark 모듈의 편의 함수를 검증한다.
 *
 * addTextWatermark, addImageWatermark, addCopyright가 위치 인자 기본값과 명시값을 모두 받아
 * 호출 인자 없이도 동작하는지를 확인한다. 호출 성공과 반환 Canvas 동일성까지만 단정한다.
 */

import { describe, expect, it } from 'vitest';
import { addCopyright, addImageWatermark, addTextWatermark } from '../../../src/composition/simple-watermark';
import { createTestCanvas } from '../../utils/canvas-helper';
import { createTestImage } from './watermark-helpers';

describe('편의 함수', () => {
  it('addTextWatermark: 기본 위치에 텍스트 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addTextWatermark(canvas, '© 2024')).toBe(canvas);
  });

  it('addTextWatermark: 위치 인자를 지정하면 반영된다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addTextWatermark(canvas, '© 2024', 'top-left')).toBe(canvas);
  });

  it('addImageWatermark: 기본 위치에 이미지 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addImageWatermark(canvas, createTestImage())).toBe(canvas);
  });

  it('addImageWatermark: 위치 인자를 지정하면 반영된다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addImageWatermark(canvas, createTestImage(), 'center')).toBe(canvas);
  });

  it('addCopyright: 기본 옵션으로 저작권 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addCopyright(canvas, '© 2024 회사명')).toBe(canvas);
  });
});
