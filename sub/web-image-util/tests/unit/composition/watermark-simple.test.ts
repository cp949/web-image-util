/**
 * SimpleWatermark의 간소화된 워터마크 API를 검증한다.
 *
 * addText / addImage / addLogo / addCopyright / addPattern이 프리셋 스타일과 SimplePosition,
 * blendMode 같은 옵션 조합을 모두 수용하는지를 확인한다. Node mock 환경에서는 그리기 결과를
 * 보장하지 않으므로 호출이 예외 없이 끝나는지와 반환 Canvas 동일성까지만 단정한다.
 */

import { describe, expect, it } from 'vitest';
import { SimpleWatermark } from '../../../src/composition/simple-watermark';
import { createTestCanvas } from '../../utils/canvas-helper';
import { createTestImage } from './watermark-helpers';

describe('SimpleWatermark', () => {
  it('addText: 기본 옵션으로 텍스트 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addText(canvas, { text: '© 2024' })).toBe(canvas);
  });

  it('addText: 숫자 size를 직접 폰트 크기로 사용한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addText(canvas, { text: '크기 직접 지정', size: 24 })).toBe(canvas);
  });

  it('addText: 커스텀 TextStyle 객체를 허용한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(
      SimpleWatermark.addText(canvas, {
        text: '커스텀 스타일',
        style: { fontFamily: 'serif', fontSize: 20, color: '#ff0000' },
        size: 18,
      })
    ).toBe(canvas);
  });

  it('addText: 모든 PresetTextStyle이 에러 없이 동작한다', () => {
    const canvas = createTestCanvas(400, 300);
    const presets = [
      'default',
      'white-shadow',
      'black-shadow',
      'bold-white',
      'bold-black',
      'outline',
      'subtle',
    ] as const;
    for (const style of presets) {
      expect(() => SimpleWatermark.addText(canvas, { text: '테스트', style })).not.toThrow();
    }
  });

  it('addText: 모든 SimplePosition이 에러 없이 동작한다', () => {
    const canvas = createTestCanvas(400, 300);
    const positions = [
      'top-left',
      'top-center',
      'top-right',
      'center-left',
      'center',
      'center-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ] as const;
    for (const position of positions) {
      expect(() => SimpleWatermark.addText(canvas, { text: '위치', position })).not.toThrow();
    }
  });

  it('addText: rotation·opacity·margin 옵션을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(
      SimpleWatermark.addText(canvas, {
        text: '옵션 테스트',
        rotation: 15,
        opacity: 0.5,
        margin: { x: 20, y: 20 },
      })
    ).toBe(canvas);
  });

  it('addImage: 기본 옵션으로 이미지 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addImage(canvas, { image: createTestImage() })).toBe(canvas);
  });

  it('addImage: 숫자 scale을 직접 사용한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addImage(canvas, { image: createTestImage(), size: 0.3 })).toBe(canvas);
  });

  it('addImage: small·medium·large size를 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    for (const size of ['small', 'medium', 'large'] as const) {
      expect(() => SimpleWatermark.addImage(canvas, { image: createTestImage(), size })).not.toThrow();
    }
  });

  it('addImage: blendMode 옵션을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    for (const blendMode of ['normal', 'multiply', 'overlay', 'soft-light'] as const) {
      expect(() => SimpleWatermark.addImage(canvas, { image: createTestImage(), blendMode })).not.toThrow();
    }
  });

  it('addLogo: 로고 이미지를 적응형 크기로 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addLogo(canvas, createTestImage())).toBe(canvas);
  });

  it('addLogo: position·maxSize·opacity 옵션을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(
      SimpleWatermark.addLogo(canvas, createTestImage(), {
        position: 'bottom-left',
        maxSize: 0.1,
        opacity: 0.6,
      })
    ).toBe(canvas);
  });

  it('addCopyright: 저작권 텍스트 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addCopyright(canvas, '© 2024 테스트')).toBe(canvas);
  });

  it('addCopyright: light·dark·outline 스타일을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    for (const style of ['light', 'dark', 'outline'] as const) {
      expect(() => SimpleWatermark.addCopyright(canvas, '© 2024', { style })).not.toThrow();
    }
  });

  it('addPattern: 반복 패턴 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(SimpleWatermark.addPattern(canvas, 'CONFIDENTIAL')).toBe(canvas);
  });

  it('addPattern: spacing·opacity·rotation·stagger 옵션을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(
      SimpleWatermark.addPattern(canvas, 'DRAFT', {
        spacing: 150,
        opacity: 0.05,
        rotation: -30,
        stagger: false,
      })
    ).toBe(canvas);
  });
});
