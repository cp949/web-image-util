/**
 * TextWatermark의 텍스트 합성 로직을 검증한다.
 *
 * addToCanvas, addMultipleToCanvas, addRepeatingPattern이 입력 옵션을 받아 같은 Canvas에 그리고
 * 반환하는지를 확인한다. 실제 픽셀 품질은 Node mock에서 보장되지 않으므로 호출 성공과 반환값
 * 동일성까지만 단정한다.
 */

import { describe, expect, it } from 'vitest';
import { Position } from '../../../src/composition/position-types';
import { TextWatermark } from '../../../src/composition/text-watermark';
import { createTestCanvas } from '../../utils/canvas-helper';
import { baseStyle } from './watermark-helpers';

describe('TextWatermark', () => {
  it('addToCanvas: 텍스트를 그리고 같은 Canvas를 반환한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addToCanvas(canvas, {
      text: '© 2024',
      position: Position.BOTTOM_RIGHT,
      style: baseStyle,
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: rotation이 있으면 회전 변환을 적용한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addToCanvas(canvas, {
      text: '회전 텍스트',
      position: Position.MIDDLE_CENTER,
      style: baseStyle,
      rotation: 45,
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: shadow·strokeColor 스타일을 적용한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addToCanvas(canvas, {
      text: '아웃라인',
      position: Position.TOP_LEFT,
      style: {
        ...baseStyle,
        strokeColor: '#ffffff',
        strokeWidth: 2,
        shadow: { color: 'rgba(0,0,0,0.5)', offsetX: 1, offsetY: 1, blur: 3 },
      },
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: customPosition을 사용하면 해당 좌표로 그린다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addToCanvas(canvas, {
      text: '커스텀',
      position: Position.CUSTOM,
      customPosition: { x: 50, y: 80 },
      style: baseStyle,
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: margin을 명시하면 위치 계산에 반영된다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addToCanvas(canvas, {
      text: '마진 테스트',
      position: Position.TOP_RIGHT,
      style: baseStyle,
      margin: { x: 20, y: 20 },
    });
    expect(result).toBe(canvas);
  });

  it('addMultipleToCanvas: 여러 워터마크를 순차 적용하고 같은 Canvas를 반환한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addMultipleToCanvas(canvas, [
      { text: '첫 번째', position: Position.TOP_LEFT, style: baseStyle },
      { text: '두 번째', position: Position.BOTTOM_RIGHT, style: baseStyle },
    ]);
    expect(result).toBe(canvas);
  });

  it('addRepeatingPattern: 패턴 워터마크를 그리고 같은 Canvas를 반환한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addRepeatingPattern(canvas, {
      text: '기밀',
      position: Position.MIDDLE_CENTER,
      style: { ...baseStyle, opacity: 0.1 },
      rotation: -45,
      spacing: { x: 150, y: 100 },
    });
    expect(result).toBe(canvas);
  });

  it('addRepeatingPattern: stagger=true 옵션을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = TextWatermark.addRepeatingPattern(canvas, {
      text: 'DRAFT',
      position: Position.MIDDLE_CENTER,
      style: baseStyle,
      spacing: { x: 200, y: 120 },
      stagger: true,
    });
    expect(result).toBe(canvas);
  });
});
