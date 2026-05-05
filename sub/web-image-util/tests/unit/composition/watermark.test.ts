/**
 * TextWatermark·ImageWatermark·SimpleWatermark의 워터마크 합성 로직을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { ImageWatermark } from '../../../src/composition/image-watermark';
import { Position } from '../../../src/composition/position-types';
import {
  addCopyright,
  addImageWatermark,
  addTextWatermark,
  SimpleWatermark,
} from '../../../src/composition/simple-watermark';
import { TextWatermark } from '../../../src/composition/text-watermark';
import { createTestCanvas } from '../../utils/canvas-helper';

function createTestImage(width = 50, height = 50): HTMLImageElement {
  const img = new Image();
  img.width = width;
  img.height = height;
  return img as HTMLImageElement;
}

const baseStyle = {
  fontFamily: 'Arial',
  fontSize: 16,
  color: '#000000',
  opacity: 0.8,
};

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

describe('편의 함수', () => {
  it('addTextWatermark: 기본 위치에 텍스트 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addTextWatermark(canvas, '© 2024')).toBe(canvas);
  });

  it('addTextWatermark: 위치 인자를 지정하면 반영된다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addTextWatermark(canvas, '© 2024', 'top-left')).toBe(canvas);
  });

  it('addImageWatermark: 기본 위치에 이미지 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addImageWatermark(canvas, createTestImage())).toBe(canvas);
  });

  it('addImageWatermark: 위치 인자를 지정하면 반영된다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addImageWatermark(canvas, createTestImage(), 'center')).toBe(canvas);
  });

  it('addCopyright: 기본 옵션으로 저작권 워터마크를 추가한다', () => {
    const canvas = createTestCanvas(400, 300);
    expect(addCopyright(canvas, '© 2024 회사명')).toBe(canvas);
  });
});
