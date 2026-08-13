/**
 * TextWatermark의 텍스트 합성 로직을 검증한다.
 *
 * addToCanvas, addMultipleToCanvas, addRepeatingPattern이 입력 옵션을 받아 같은 Canvas에 그리고
 * 반환하는지를 확인한다. 실제 픽셀 품질은 Node mock에서 보장되지 않으므로 호출 성공과 반환값
 * 동일성까지만 단정한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { Position } from '../../../src/composition/position-types';
import { TextWatermark } from '../../../src/composition/text-watermark';
import { ImageProcessError } from '../../../src/errors.internal';
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

  it('addToCanvas: 텍스트 영역 중심을 기준으로 회전한다', () => {
    const canvas = createTestCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    // 폰트 메트릭은 실행 환경에 따라 달라지므로 폭을 고정해 중심 계산을 결정적으로 만든다
    vi.spyOn(ctx, 'measureText').mockReturnValue({ width: 80 } as TextMetrics);
    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');

    TextWatermark.addToCanvas(canvas, {
      text: '회전 텍스트',
      position: Position.CUSTOM,
      customPosition: { x: 100, y: 60 },
      style: { ...baseStyle, fontSize: 20 },
      rotation: 90,
    });

    // 중심 = (100 + 80/2, 60 + 20/2) = (140, 70)
    expect(translateSpy).toHaveBeenNthCalledWith(1, 140, 70);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(translateSpy).toHaveBeenNthCalledWith(2, -140, -70);
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

  it('addToCanvas: 2D context를 얻지 못하면 ImageProcessError를 던진다', () => {
    const canvas = createTestCanvas(400, 300);
    canvas.getContext = () => null;

    expect(() =>
      TextWatermark.addToCanvas(canvas, {
        text: '실패',
        position: Position.TOP_LEFT,
        style: baseStyle,
      })
    ).toThrow(ImageProcessError);

    try {
      TextWatermark.addToCanvas(canvas, {
        text: '실패',
        position: Position.TOP_LEFT,
        style: baseStyle,
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'CANVAS_CONTEXT_FAILED' });
    }
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

  it('addRepeatingPattern: 2D context를 얻지 못하면 ImageProcessError를 던진다', () => {
    const canvas = createTestCanvas(400, 300);
    canvas.getContext = () => null;

    expect(() =>
      TextWatermark.addRepeatingPattern(canvas, {
        text: '실패',
        position: Position.MIDDLE_CENTER,
        style: baseStyle,
        spacing: { x: 150, y: 100 },
      })
    ).toThrow(ImageProcessError);
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
