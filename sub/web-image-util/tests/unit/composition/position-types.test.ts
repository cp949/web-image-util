/**
 * PositionCalculator의 좌표 계산 로직을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { Position, PositionCalculator } from '../../../src/composition/position-types';

describe('PositionCalculator.calculatePosition', () => {
  const container = { width: 400, height: 300 };
  const object = { width: 100, height: 50 };
  const margin = { x: 10, y: 10 };

  it('top-left: 마진 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.TOP_LEFT, null, container, object, margin);
    expect(pos).toEqual({ x: 10, y: 10 });
  });

  it('top-center: 수평 중앙 정렬 상단 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.TOP_CENTER, null, container, object, margin);
    expect(pos).toEqual({ x: (400 - 100) / 2, y: 10 });
  });

  it('top-right: 오른쪽 정렬 상단 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.TOP_RIGHT, null, container, object, margin);
    expect(pos).toEqual({ x: 400 - 100 - 10, y: 10 });
  });

  it('middle-left: 수직 중앙 정렬 왼쪽 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.MIDDLE_LEFT, null, container, object, margin);
    expect(pos).toEqual({ x: 10, y: (300 - 50) / 2 });
  });

  it('middle-center: 정중앙 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.MIDDLE_CENTER, null, container, object, margin);
    expect(pos).toEqual({ x: (400 - 100) / 2, y: (300 - 50) / 2 });
  });

  it('middle-right: 수직 중앙 정렬 오른쪽 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.MIDDLE_RIGHT, null, container, object, margin);
    expect(pos).toEqual({ x: 400 - 100 - 10, y: (300 - 50) / 2 });
  });

  it('bottom-left: 왼쪽 정렬 하단 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.BOTTOM_LEFT, null, container, object, margin);
    expect(pos).toEqual({ x: 10, y: 300 - 10 - 50 });
  });

  it('bottom-center: 수평 중앙 정렬 하단 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.BOTTOM_CENTER, null, container, object, margin);
    expect(pos).toEqual({ x: (400 - 100) / 2, y: 300 - 10 - 50 });
  });

  it('bottom-right: 오른쪽 정렬 하단 위치를 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.BOTTOM_RIGHT, null, container, object, margin);
    expect(pos).toEqual({ x: 400 - 100 - 10, y: 300 - 10 - 50 });
  });

  it('custom: customPoint가 있으면 그 좌표를 그대로 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.CUSTOM, { x: 50, y: 75 }, container, object, margin);
    expect(pos).toEqual({ x: 50, y: 75 });
  });

  it('custom: customPoint가 null이면 { x: 0, y: 0 }을 반환한다', () => {
    const pos = PositionCalculator.calculatePosition(Position.CUSTOM, null, container, object, margin);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('margin 인자 생략 시 기본값 { x: 10, y: 10 }이 적용된다', () => {
    const pos = PositionCalculator.calculatePosition(Position.TOP_LEFT, null, container, object);
    expect(pos).toEqual({ x: 10, y: 10 });
  });
});

describe('PositionCalculator.calculateRelativePosition', () => {
  const container = { width: 400, height: 300 };
  const object = { width: 100, height: 50 };

  it('(0, 0)은 왼쪽 상단 { x: 0, y: 0 }을 반환한다', () => {
    const pos = PositionCalculator.calculateRelativePosition(0, 0, container, object);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('(1, 1)은 오른쪽 하단 끝을 반환한다', () => {
    const pos = PositionCalculator.calculateRelativePosition(1, 1, container, object);
    expect(pos).toEqual({ x: 300, y: 250 });
  });

  it('(0.5, 0.5)은 중앙 좌표를 반환한다', () => {
    const pos = PositionCalculator.calculateRelativePosition(0.5, 0.5, container, object);
    expect(pos).toEqual({ x: 150, y: 125 });
  });
});
