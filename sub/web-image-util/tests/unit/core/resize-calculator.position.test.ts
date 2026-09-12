/**
 * calculateFinalLayout의 position(gravity/focal-point) 처리를 검증하는 단위 테스트다.
 *
 * gravity 9방향의 정확한 오프셋, focal-point의 경계값·클램프, contain의 margin 분배를 확인한다.
 */

import { describe, expect, it } from 'vitest';
import { calculateFinalLayout } from '../../../src/core/resize-calculator.internal';
import type { ResizeGravity } from '../../../src/types/resize-config';

describe('calculateFinalLayout - position', () => {
  describe('position 생략 시 회귀 없음', () => {
    it('cover에서 기존 중앙 정렬과 동일하다', () => {
      const withPosition = calculateFinalLayout(200, 100, { fit: 'cover', width: 100, height: 100 });
      expect(withPosition.position).toEqual({ x: -50, y: 0 });
    });

    it('contain에서 기존 중앙 정렬과 동일하다', () => {
      const result = calculateFinalLayout(100, 50, { fit: 'contain', width: 200, height: 200 });
      expect(result.position).toEqual({ x: 0, y: 50 });
    });
  });

  describe('cover — gravity 9방향 (가로로만 잘리는 이미지)', () => {
    // 200x100 원본을 100x100 cover: scale=1, imageSize=200x100. 가로만 100px 초과.
    const cases: Array<[ResizeGravity, { x: number; y: number }]> = [
      ['top-left', { x: 0, y: 0 }],
      ['top-center', { x: -50, y: 0 }],
      ['top-right', { x: -100, y: 0 }],
      ['center-left', { x: 0, y: 0 }],
      ['center', { x: -50, y: 0 }],
      ['center-right', { x: -100, y: 0 }],
      ['bottom-left', { x: 0, y: 0 }],
      ['bottom-center', { x: -50, y: 0 }],
      ['bottom-right', { x: -100, y: 0 }],
    ];

    it.each(cases)('%s → %o', (position, expected) => {
      const result = calculateFinalLayout(200, 100, { fit: 'cover', width: 100, height: 100, position });
      expect(result.position).toEqual(expected);
    });
  });

  describe('cover — gravity 9방향 (세로로만 잘리는 이미지)', () => {
    // 100x200 원본을 100x100 cover: scale=1, imageSize=100x200. 세로만 100px 초과.
    const cases: Array<[ResizeGravity, { x: number; y: number }]> = [
      ['top-left', { x: 0, y: 0 }],
      ['top-center', { x: 0, y: 0 }],
      ['top-right', { x: 0, y: 0 }],
      ['center-left', { x: 0, y: -50 }],
      ['center', { x: 0, y: -50 }],
      ['center-right', { x: 0, y: -50 }],
      ['bottom-left', { x: 0, y: -100 }],
      ['bottom-center', { x: 0, y: -100 }],
      ['bottom-right', { x: 0, y: -100 }],
    ];

    it.each(cases)('%s → %o', (position, expected) => {
      const result = calculateFinalLayout(100, 200, { fit: 'cover', width: 100, height: 100, position });
      expect(result.position).toEqual(expected);
    });
  });

  describe('contain — gravity로 margin을 분배한다', () => {
    // 100x50 원본을 200x200 contain: scale=2, imageSize=200x100. 세로 여백 100px.
    const cases: Array<[ResizeGravity, { x: number; y: number }]> = [
      ['top-left', { x: 0, y: 0 }],
      ['top-center', { x: 0, y: 0 }],
      ['top-right', { x: 0, y: 0 }],
      ['center', { x: 0, y: 50 }],
      ['bottom-left', { x: 0, y: 100 }],
      ['bottom-center', { x: 0, y: 100 }],
      ['bottom-right', { x: 0, y: 100 }],
    ];

    it.each(cases)('%s → %o', (position, expected) => {
      const result = calculateFinalLayout(100, 50, { fit: 'contain', width: 200, height: 200, position });
      expect(result.position).toEqual(expected);
    });
  });

  describe('cover — focal-point (가로축)', () => {
    // 1000x500 원본을 500x500 cover: scale=1, imageSize=1000x500. 가로 500px 초과, 세로는 0.
    it.each([
      [0.5, -250],
      [0.35, -100],
      [0.2, 0], // 클램프: 왼쪽 끝
      [0, 0], // 클램프: 왼쪽 끝
      [0.8, -500], // 클램프: 오른쪽 끝
      [1, -500], // 클램프: 오른쪽 끝
    ])('focal x=%s → x=%d', (fx, expectedX) => {
      const result = calculateFinalLayout(1000, 500, {
        fit: 'cover',
        width: 500,
        height: 500,
        position: { x: fx, y: 0.5 },
      });
      expect(result.position.x).toBe(expectedX);
      expect(result.position.y).toBe(0); // 세로는 초과분이 없어 focal-point와 무관하게 0
    });
  });

  describe('cover — focal-point (세로축)', () => {
    // 500x1000 원본을 500x500 cover: scale=1, imageSize=500x1000. 세로 500px 초과, 가로는 0.
    it.each([
      [0.5, -250],
      [0.3, -50],
    ])('focal y=%s → y=%d', (fy, expectedY) => {
      const result = calculateFinalLayout(500, 1000, {
        fit: 'cover',
        width: 500,
        height: 500,
        position: { x: 0.5, y: fy },
      });
      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(expectedY);
    });
  });

  describe('cover — focal-point epsilon 클램프', () => {
    // 1000x500 원본을 500x500 cover: focal x=-1e-7/1+1e-7은 검증은 통과하지만
    // 계산 시점에 0/1로 잘려 x=0/x=-500과 같은 결과를 낸다.
    it.each([
      [-1e-7, 0],
      [1 + 1e-7, -500],
    ])('focal x=%s는 clamp되어 x=%d와 같다', (fx, expectedX) => {
      const result = calculateFinalLayout(1000, 500, {
        fit: 'cover',
        width: 500,
        height: 500,
        position: { x: fx, y: 0.5 },
      });
      expect(result.position.x).toBe(expectedX);
    });
  });

  describe('position과 다른 옵션을 함께 쓴다', () => {
    it('contain + withoutEnlargement + gravity: 확대 제한과 정렬이 함께 동작한다', () => {
      // 50x50 → contain 200x100, withoutEnlargement: true → 확대 제한으로 scale=1, imageSize 50x50
      const result = calculateFinalLayout(50, 50, {
        fit: 'contain',
        width: 200,
        height: 100,
        withoutEnlargement: true,
        position: 'bottom-right',
      });

      expect(result.imageSize).toEqual({ width: 50, height: 50 });
      expect(result.position).toEqual({ x: 150, y: 50 });
    });
  });

  describe('검증을 우회한 gravity 값에 대한 방어선', () => {
    it('GRAVITY_ALIGNMENT에 없는 값이 들어오면 raw TypeError 대신 OPTION_INVALID를 던진다', () => {
      // calculateFinalLayout은 렌더 시점 진입점이라 validateResizeConfig를 거치지 않는다 —
      // addResize가 검증한 뒤 config를 복사해 저장하므로 정상 경로에서는 도달하지 않지만,
      // 그 불변식이 깨지는 경우까지 대비해 조회 실패를 깨끗한 에러로 바꾼다.
      const config = { fit: 'cover', width: 100, height: 100, position: 'middle' } as never;
      expect(() => calculateFinalLayout(200, 100, config)).toThrow(
        expect.objectContaining({ code: 'OPTION_INVALID', details: expect.objectContaining({ option: 'position' }) })
      );
    });
  });
});
