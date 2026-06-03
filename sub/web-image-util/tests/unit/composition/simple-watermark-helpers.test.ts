/**
 * SimpleWatermark 내부 옵션 변환 헬퍼를 검증한다.
 *
 * 공개 API는 유지하되 위치, 스타일, 크기, blendMode 변환을 순수 함수로 분리해
 * SimpleWatermark 클래스가 orchestration만 담당하도록 만든다.
 */

import { describe, expect, it } from 'vitest';
import { Position } from '../../../src/composition/position-types';
import {
  convertSimplePosition,
  mapSimpleBlendMode,
  resolveSimpleImageScale,
  resolveSimpleTextSize,
  resolveSimpleTextStyle,
} from '../../../src/composition/simple-watermark-helpers.internal';
import { createTestCanvas } from '../../utils/canvas-helper';
import { createTestImage } from './watermark-helpers';

describe('simple-watermark 내부 헬퍼', () => {
  it('convertSimplePosition: 사용자 친화 위치 값을 내부 Position으로 변환한다', () => {
    expect(convertSimplePosition('top-left')).toBe(Position.TOP_LEFT);
    expect(convertSimplePosition('center')).toBe(Position.MIDDLE_CENTER);
    expect(convertSimplePosition('bottom-right')).toBe(Position.BOTTOM_RIGHT);
  });

  it('resolveSimpleTextStyle: preset 스타일과 size를 TextStyle로 해석한다', () => {
    expect(resolveSimpleTextStyle('bold-white', 'large')).toEqual({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ffffff',
    });

    expect(resolveSimpleTextSize('small')).toBe(12);
    expect(resolveSimpleTextSize(18)).toBe(18);
  });

  it('resolveSimpleTextStyle: 커스텀 스타일은 size로 fontSize만 덮어쓴다', () => {
    const style = { fontFamily: 'serif', fontSize: 20, color: '#ff0000' };

    expect(resolveSimpleTextStyle(style, 18)).toEqual({
      fontFamily: 'serif',
      fontSize: 18,
      color: '#ff0000',
    });
    expect(style.fontSize).toBe(20);
  });

  it('resolveSimpleImageScale: preset size를 canvas 대비 image scale로 변환한다', () => {
    const canvas = createTestCanvas(400, 300);
    const image = createTestImage(50, 100);

    expect(resolveSimpleImageScale('small', canvas, image)).toBe(0.15);
    expect(resolveSimpleImageScale('medium', canvas, image)).toBe(0.3);
    expect(resolveSimpleImageScale('large', canvas, image)).toBe(0.6);
    expect(resolveSimpleImageScale(0.25, canvas, image)).toBe(0.25);
  });

  it('mapSimpleBlendMode: 간단한 blendMode 값을 Canvas 합성 모드로 변환한다', () => {
    expect(mapSimpleBlendMode('normal')).toBe('source-over');
    expect(mapSimpleBlendMode('multiply')).toBe('multiply');
    expect(mapSimpleBlendMode('overlay')).toBe('overlay');
    expect(mapSimpleBlendMode('soft-light')).toBe('soft-light');
  });
});
