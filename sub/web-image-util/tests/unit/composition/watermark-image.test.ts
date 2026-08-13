/**
 * ImageWatermark의 이미지 합성 로직을 검증한다.
 *
 * addToCanvas, addWithAdaptiveSize, addRepeatingPattern이 이미지 입력과 옵션을 받아 같은 Canvas에
 * 그리고 반환하는지를 확인한다. Node mock에서는 실제 그리기 결과를 보장하지 않으므로 호출 성공과
 * 반환값 동일성까지만 단정한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { ImageWatermark } from '../../../src/composition/image-watermark';
import { Position } from '../../../src/composition/position-types';
import { ImageProcessError } from '../../../src/errors.internal';
import { createTestCanvas } from '../../utils/canvas-helper';
import { createTestImage } from './watermark-helpers';

describe('ImageWatermark', () => {
  it('addToCanvas: 이미지 워터마크를 적용하고 같은 Canvas를 반환한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addToCanvas(canvas, {
      watermarkImage: createTestImage(),
      position: Position.BOTTOM_RIGHT,
      scale: 0.3,
      opacity: 0.7,
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: rotation이 있으면 회전 변환을 적용한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addToCanvas(canvas, {
      watermarkImage: createTestImage(),
      position: Position.MIDDLE_CENTER,
      rotation: 30,
      blendMode: 'multiply',
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: 워터마크 영역 중심을 기준으로 회전한다', () => {
    const canvas = createTestCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');

    ImageWatermark.addToCanvas(canvas, {
      watermarkImage: createTestImage(40, 20),
      position: Position.CUSTOM,
      customPosition: { x: 100, y: 60 },
      rotation: 90,
    });

    // 중심 = (100 + 40/2, 60 + 20/2) = (120, 70)
    expect(translateSpy).toHaveBeenNthCalledWith(1, 120, 70);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(translateSpy).toHaveBeenNthCalledWith(2, -120, -70);
  });

  it('addToCanvas: customPosition을 사용하면 해당 좌표로 그린다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addToCanvas(canvas, {
      watermarkImage: createTestImage(),
      position: Position.CUSTOM,
      customPosition: { x: 100, y: 80 },
    });
    expect(result).toBe(canvas);
  });

  it('addToCanvas: 2D context를 얻지 못하면 ImageProcessError를 던진다', () => {
    const canvas = createTestCanvas(400, 300);
    canvas.getContext = () => null;

    expect(() =>
      ImageWatermark.addToCanvas(canvas, {
        watermarkImage: createTestImage(),
        position: Position.TOP_LEFT,
      })
    ).toThrow(ImageProcessError);

    try {
      ImageWatermark.addToCanvas(canvas, {
        watermarkImage: createTestImage(),
        position: Position.TOP_LEFT,
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'CANVAS_CONTEXT_FAILED' });
    }
  });

  it('addWithAdaptiveSize: 컨테이너 크기 비율로 스케일을 계산한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addWithAdaptiveSize(canvas, {
      watermarkImage: createTestImage(200, 200),
      position: Position.BOTTOM_RIGHT,
      maxWidthPercent: 0.2,
      maxHeightPercent: 0.2,
    });
    expect(result).toBe(canvas);
  });

  it('addWithAdaptiveSize: 기본 비율(20%)을 적용한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addWithAdaptiveSize(canvas, {
      watermarkImage: createTestImage(100, 50),
      position: Position.BOTTOM_LEFT,
    });
    expect(result).toBe(canvas);
  });

  it('addRepeatingPattern: 이미지 반복 패턴을 그린다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addRepeatingPattern(canvas, {
      watermarkImage: createTestImage(20, 20),
      position: Position.MIDDLE_CENTER,
      spacing: { x: 80, y: 80 },
    });
    expect(result).toBe(canvas);
  });

  it('addRepeatingPattern: 2D context를 얻지 못하면 ImageProcessError를 던진다', () => {
    const canvas = createTestCanvas(400, 300);
    canvas.getContext = () => null;

    expect(() =>
      ImageWatermark.addRepeatingPattern(canvas, {
        watermarkImage: createTestImage(20, 20),
        position: Position.MIDDLE_CENTER,
        spacing: { x: 80, y: 80 },
      })
    ).toThrow(ImageProcessError);
  });

  it('addRepeatingPattern: 타일마다 자기 중심을 기준으로 회전한다', () => {
    // spacing을 캔버스보다 크게 잡아 타일이 정확히 1장만 그려지게 한다
    const canvas = createTestCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');

    ImageWatermark.addRepeatingPattern(canvas, {
      watermarkImage: createTestImage(20, 20),
      position: Position.MIDDLE_CENTER,
      spacing: { x: 200, y: 200 },
      rotation: 90,
    });

    // 유일한 타일의 좌상단 = (-20, -20), 중심 = (-10, -10)
    expect(rotateSpy).toHaveBeenCalledTimes(1);
    expect(translateSpy).toHaveBeenNthCalledWith(1, -10, -10);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(translateSpy).toHaveBeenNthCalledWith(2, 10, 10);
  });

  it('addRepeatingPattern: stagger=true·rotation 옵션을 처리한다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addRepeatingPattern(canvas, {
      watermarkImage: createTestImage(20, 20),
      position: Position.MIDDLE_CENTER,
      spacing: { x: 80, y: 80 },
      stagger: true,
      rotation: 15,
    });
    expect(result).toBe(canvas);
  });
});
