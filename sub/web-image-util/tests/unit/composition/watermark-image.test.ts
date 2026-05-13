/**
 * ImageWatermark의 이미지 합성 로직을 검증한다.
 *
 * addToCanvas, addWithAdaptiveSize, addRepeatingPattern이 이미지 입력과 옵션을 받아 같은 Canvas에
 * 그리고 반환하는지를 확인한다. Node mock에서는 실제 그리기 결과를 보장하지 않으므로 호출 성공과
 * 반환값 동일성까지만 단정한다.
 */

import { describe, expect, it } from 'vitest';
import { ImageWatermark } from '../../../src/composition/image-watermark';
import { Position } from '../../../src/composition/position-types';
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

  it('addToCanvas: customPosition을 사용하면 해당 좌표로 그린다', () => {
    const canvas = createTestCanvas(400, 300);
    const result = ImageWatermark.addToCanvas(canvas, {
      watermarkImage: createTestImage(),
      position: Position.CUSTOM,
      customPosition: { x: 100, y: 80 },
    });
    expect(result).toBe(canvas);
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
