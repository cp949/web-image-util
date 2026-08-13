/**
 * TextWatermark의 텍스트 합성 로직을 검증한다.
 *
 * addToCanvas, addMultipleToCanvas, addRepeatingPattern이 입력 옵션을 받아 같은 Canvas에 그리고
 * 반환하는지를 확인한다. 실제 픽셀 품질은 Node mock에서 보장되지 않으므로 호출 성공과 반환값
 * 동일성까지만 단정한다. 다만 addRepeatingPattern의 커버리지 분포는 픽셀 판독으로 직접 단정한다 —
 * 타일 루프 경계가 캔버스를 고르게 덮는지는 반환값 동일성으로 드러나지 않기 때문이다.
 */

import { describe, expect, it, vi } from 'vitest';
import { Position } from '../../../src/composition/position-types';
import { TextWatermark } from '../../../src/composition/text-watermark';
import { ImageProcessError } from '../../../src/errors.internal';
import { createTestCanvas } from '../../utils/canvas-helper';
import { baseStyle } from './watermark-helpers';

/**
 * 사분면별 잉크 픽셀 비율(%)을 [좌상, 우상, 좌하, 우하] 순으로 센다.
 *
 * 흰 배경에 검은 텍스트를 그린 Canvas를 전제로, 빨강 채널이 128 미만인 픽셀을 잉크로 판정한다.
 * 전면 균일 커버가 목적인 패턴 워터마크에서 네 값이 비슷해야 정상이다.
 */
function quadrantInkRatios(canvas: HTMLCanvasElement): [number, number, number, number] {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot get canvas context');
  }

  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const ink = [0, 0, 0, 0];
  const total = [0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const quadrant = (y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1);
      total[quadrant]++;
      if (data[(y * width + x) * 4] < 128) {
        ink[quadrant]++;
      }
    }
  }

  return ink.map((count, i) => (count / total[i]) * 100) as [number, number, number, number];
}

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

  it('addToCanvas: 호출자 Canvas의 컨텍스트 상태를 원래대로 되돌린다', () => {
    const canvas = createTestCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    ctx.font = '10px monospace';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#123456';
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'start';
    const before = {
      font: ctx.font,
      globalAlpha: ctx.globalAlpha,
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
      textBaseline: ctx.textBaseline,
      textAlign: ctx.textAlign,
    };

    TextWatermark.addToCanvas(canvas, {
      text: '워터마크',
      position: Position.TOP_LEFT,
      style: {
        ...baseStyle,
        fontSize: 32,
        color: '#ff0000',
        opacity: 0.3,
        strokeColor: '#00ff00',
        strokeWidth: 4,
      },
    });

    expect({
      font: ctx.font,
      globalAlpha: ctx.globalAlpha,
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
      textBaseline: ctx.textBaseline,
      textAlign: ctx.textAlign,
    }).toEqual(before);
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

  it('addRepeatingPattern: 호출자 Canvas의 컨텍스트 상태를 원래대로 되돌린다', () => {
    const canvas = createTestCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    ctx.font = '10px monospace';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#123456';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'start';
    const before = {
      font: ctx.font,
      globalAlpha: ctx.globalAlpha,
      fillStyle: ctx.fillStyle,
      textBaseline: ctx.textBaseline,
      textAlign: ctx.textAlign,
    };

    TextWatermark.addRepeatingPattern(canvas, {
      text: '기밀',
      position: Position.MIDDLE_CENTER,
      style: { ...baseStyle, fontSize: 28, color: '#ff0000', opacity: 0.1 },
      rotation: -45,
      spacing: { x: 150, y: 100 },
    });

    expect({
      font: ctx.font,
      globalAlpha: ctx.globalAlpha,
      fillStyle: ctx.fillStyle,
      textBaseline: ctx.textBaseline,
      textAlign: ctx.textAlign,
    }).toEqual(before);
  });

  // 회전 각도를 여러 개 도는 이유는 역회전 bounding box의 부호 실수를 잡기 위해서다.
  // 한 각도만 보면 sin/cos 부호가 뒤집혀도 우연히 통과할 수 있다.
  it.each([-45, 30, 90, 135])('addRepeatingPattern: rotation=%i에서 사분면 커버리지가 고르다', (rotation) => {
    const canvas = createTestCanvas(800, 600, '#ffffff');

    TextWatermark.addRepeatingPattern(canvas, {
      text: 'CONFIDENTIAL',
      position: Position.MIDDLE_CENTER,
      style: { ...baseStyle, fontSize: 28, color: '#000000', opacity: 1 },
      rotation,
      spacing: { x: 200, y: 200 },
    });

    const ratios = quadrantInkRatios(canvas);
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);

    // 사분면 잉크 비율의 최소/최대 비가 0.7 이상이면 고르게 덮은 것으로 본다.
    // 루프 경계가 회전 전 좌표계를 따르면 이 비율이 0.5 아래로 떨어진다.
    expect(min).toBeGreaterThan(0);
    expect(min / max).toBeGreaterThanOrEqual(0.7);
  });

  it('addRepeatingPattern: rotation이 0이면 타일 배치가 캔버스 좌표 그대로다', () => {
    const canvas = createTestCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const textWidth = 40;
    vi.spyOn(ctx, 'measureText').mockReturnValue({ width: textWidth } as TextMetrics);
    const fillText = vi.spyOn(ctx, 'fillText');

    const spacing = { x: 120, y: 160 };
    TextWatermark.addRepeatingPattern(canvas, {
      text: '기밀',
      position: Position.MIDDLE_CENTER,
      style: { ...baseStyle, fontSize: 20 },
      spacing,
    });

    // 경계에 정확히 도달하는 간격을 사용해 `<`를 `<=`로 바꾸는 회귀도 잡는다.
    expect(fillText.mock.calls.map(([, x, y]) => [x, y])).toEqual([
      [-40, 0],
      [80, 0],
      [200, 0],
      [320, 0],
      [-40, 160],
      [80, 160],
      [200, 160],
      [320, 160],
    ]);
  });

  it('addRepeatingPattern: spacing이 유한 양수가 아니면 OPTION_INVALID를 던진다', () => {
    const canvas = createTestCanvas(400, 300);
    const invalidSpacings: Array<[{ x: number; y: number }, 'spacing.x' | 'spacing.y']> = [
      [{ x: 0, y: 100 }, 'spacing.x'],
      [{ x: 150, y: 0 }, 'spacing.y'],
      [{ x: -10, y: 100 }, 'spacing.x'],
      [{ x: 150, y: Number.NaN }, 'spacing.y'],
      [{ x: Number.POSITIVE_INFINITY, y: 100 }, 'spacing.x'],
    ];

    for (const [spacing, option] of invalidSpacings) {
      const addPattern = () =>
        TextWatermark.addRepeatingPattern(canvas, {
          text: '기밀',
          position: Position.MIDDLE_CENTER,
          style: baseStyle,
          spacing,
        });

      expect(addPattern).toThrow(ImageProcessError);
      expect(addPattern).toThrowError(
        expect.objectContaining({ code: 'OPTION_INVALID', details: { option, minimum: 0 } })
      );
    }
  });

  it('addRepeatingPattern: stagger=true면 둘째 행부터 반 간격씩 어긋난다', () => {
    const canvas = createTestCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    vi.spyOn(ctx, 'measureText').mockReturnValue({ width: 40 } as TextMetrics);
    const fillText = vi.spyOn(ctx, 'fillText');

    const result = TextWatermark.addRepeatingPattern(canvas, {
      text: 'DRAFT',
      position: Position.MIDDLE_CENTER,
      style: { ...baseStyle, fontSize: 20 },
      spacing: { x: 120, y: 160 },
      stagger: true,
    });

    expect(result).toBe(canvas);
    expect(fillText.mock.calls.map(([, x, y]) => [x, y])).toEqual([
      [-40, 0],
      [80, 0],
      [200, 0],
      [320, 0],
      [20, 160],
      [140, 160],
      [260, 160],
      [380, 160],
    ]);
  });
});
