/**
 * ImageComposer 레이아웃 helper의 순수 계산을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateFitSize,
  calculateGridMetrics,
  rectanglesOverlap,
} from '../../../src/composition/image-composer-layout.internal';

describe('image-composer-layout', () => {
  it('contain fit은 비율을 유지하고 셀 중앙에 배치한다', () => {
    expect(calculateFitSize(100, 50, 200, 200, 'contain')).toEqual({
      x: 0,
      y: 50,
      width: 200,
      height: 100,
    });
  });

  it('cover fit은 비율을 유지하며 셀을 덮도록 음수 오프셋을 허용한다', () => {
    expect(calculateFitSize(100, 50, 200, 200, 'cover')).toEqual({
      x: -100,
      y: 0,
      width: 400,
      height: 200,
    });
  });

  it('fill fit은 셀 크기를 그대로 사용한다', () => {
    expect(calculateFitSize(100, 50, 200, 160, 'fill')).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 160,
    });
  });

  it('grid metrics는 가장 큰 이미지 크기와 spacing으로 캔버스 크기를 계산한다', () => {
    expect(
      calculateGridMetrics(
        [
          { width: 80, height: 40 },
          { width: 120, height: 60 },
        ],
        { rows: 2, cols: 2, spacing: 10 }
      )
    ).toEqual({
      maxImages: 2,
      cellWidth: 120,
      cellHeight: 60,
      canvasWidth: 270,
      canvasHeight: 150,
    });
  });

  it('사각형이 겹치면 true, 가장자리만 닿으면 false를 반환한다', () => {
    expect(rectanglesOverlap({ x: 10, y: 10, width: 20, height: 20 }, [{ x: 25, y: 25, width: 20, height: 20 }])).toBe(
      true
    );
    expect(rectanglesOverlap({ x: 10, y: 10, width: 20, height: 20 }, [{ x: 30, y: 10, width: 20, height: 20 }])).toBe(
      false
    );
  });
});
