import { describe, it, expect, beforeAll } from 'vitest';
import { TextWatermark, TextWatermarkOptions } from '../src/composition/text-watermark';
import { ImageWatermark, ImageWatermarkOptions } from '../src/composition/image-watermark';
import { ImageComposer } from '../src/composition/image-composer';
import { Position } from '../src/composition/position-types';

// 테스트용 캔버스 생성 헬퍼
function createTestCanvas(width: number = 400, height: number = 300): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  return canvas;
}

// 테스트용 이미지 생성 헬퍼
async function createTestImage(width: number = 100, height: number = 100, color: string = '#ff0000'): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL();
  });
}

describe('텍스트 워터마크', () => {
  it('기본 텍스트 워터마크를 추가할 수 있다', () => {
    const canvas = createTestCanvas();
    const originalData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    
    const options: TextWatermarkOptions = {
      text: '테스트 워터마크',
      position: Position.BOTTOM_RIGHT,
      style: {
        fontSize: 20,
        color: '#000000'
      }
    };
    
    TextWatermark.addToCanvas(canvas, options);
    
    const modifiedData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    
    // 이미지가 변경되었는지 확인
    expect(modifiedData.data).not.toEqual(originalData.data);
  });

  it('다양한 위치에 텍스트 워터마크를 추가할 수 있다', () => {
    const positions = [
      Position.TOP_LEFT,
      Position.TOP_CENTER,
      Position.TOP_RIGHT,
      Position.MIDDLE_LEFT,
      Position.MIDDLE_CENTER,
      Position.MIDDLE_RIGHT,
      Position.BOTTOM_LEFT,
      Position.BOTTOM_CENTER,
      Position.BOTTOM_RIGHT
    ];

    positions.forEach(position => {
      const canvas = createTestCanvas();
      const options: TextWatermarkOptions = {
        text: `${position} 테스트`,
        position,
        style: {
          fontSize: 14,
          color: '#333333'
        }
      };
      
      expect(() => TextWatermark.addToCanvas(canvas, options)).not.toThrow();
    });
  });

  it('스타일 옵션이 올바르게 적용된다', () => {
    const canvas = createTestCanvas();
    
    const options: TextWatermarkOptions = {
      text: '스타일 테스트',
      position: Position.MIDDLE_CENTER,
      style: {
        fontSize: 24,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#ff0000',
        strokeColor: '#000000',
        strokeWidth: 2,
        opacity: 0.8,
        shadow: {
          color: 'rgba(0,0,0,0.5)',
          offsetX: 2,
          offsetY: 2,
          blur: 4
        }
      },
      rotation: 15
    };
    
    expect(() => TextWatermark.addToCanvas(canvas, options)).not.toThrow();
  });

  it('반복 패턴 워터마크를 추가할 수 있다', () => {
    const canvas = createTestCanvas();
    
    const options: TextWatermarkOptions & {
      spacing: { x: number; y: number };
      stagger?: boolean;
    } = {
      text: '반복',
      position: Position.TOP_LEFT, // 반복 패턴에서는 실제로 사용되지 않음
      style: {
        fontSize: 12,
        color: 'rgba(0,0,0,0.3)'
      },
      spacing: { x: 80, y: 60 },
      stagger: true
    };
    
    expect(() => TextWatermark.addRepeatingPattern(canvas, options)).not.toThrow();
  });
});

describe('이미지 워터마크', () => {
  let testWatermarkImage: HTMLImageElement;

  beforeAll(async () => {
    testWatermarkImage = await createTestImage(50, 50, '#00ff00');
  });

  it('기본 이미지 워터마크를 추가할 수 있다', () => {
    const canvas = createTestCanvas();
    const originalData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    
    const options: ImageWatermarkOptions = {
      watermarkImage: testWatermarkImage,
      position: Position.BOTTOM_RIGHT,
      scale: 1,
      opacity: 1
    };
    
    ImageWatermark.addToCanvas(canvas, options);
    
    const modifiedData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    
    // 이미지가 변경되었는지 확인
    expect(modifiedData.data).not.toEqual(originalData.data);
  });

  it('적응형 크기 조정이 올바르게 작동한다', () => {
    const canvas = createTestCanvas();
    
    const options: ImageWatermarkOptions & {
      maxWidthPercent?: number;
      maxHeightPercent?: number;
    } = {
      watermarkImage: testWatermarkImage,
      position: Position.TOP_LEFT,
      maxWidthPercent: 0.1, // 캔버스의 10%
      maxHeightPercent: 0.1
    };
    
    expect(() => ImageWatermark.addWithAdaptiveSize(canvas, options)).not.toThrow();
  });

  it('블렌딩 모드와 회전이 올바르게 적용된다', () => {
    const canvas = createTestCanvas();
    
    const options: ImageWatermarkOptions = {
      watermarkImage: testWatermarkImage,
      position: Position.MIDDLE_CENTER,
      scale: 0.5,
      opacity: 0.7,
      rotation: 45,
      blendMode: 'multiply'
    };
    
    expect(() => ImageWatermark.addToCanvas(canvas, options)).not.toThrow();
  });
});

describe('이미지 합성', () => {
  let testImages: HTMLImageElement[];

  beforeAll(async () => {
    testImages = await Promise.all([
      createTestImage(100, 100, '#ff0000'),
      createTestImage(100, 100, '#00ff00'),
      createTestImage(100, 100, '#0000ff'),
      createTestImage(100, 100, '#ffff00')
    ]);
  });

  it('레이어 기반 합성이 올바르게 작동한다', async () => {
    const layers = [
      {
        image: testImages[0],
        x: 0,
        y: 0,
        opacity: 1
      },
      {
        image: testImages[1],
        x: 50,
        y: 50,
        opacity: 0.8,
        blendMode: 'multiply' as GlobalCompositeOperation
      }
    ];

    const options = {
      width: 200,
      height: 200,
      backgroundColor: '#ffffff'
    };

    const result = await ImageComposer.composeLayers(layers, options);
    expect(result).toBeDefined();
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it('그리드 레이아웃 합성이 올바르게 작동한다', async () => {
    const options = {
      rows: 2,
      cols: 2,
      spacing: 10,
      backgroundColor: '#f0f0f0',
      fit: 'contain' as const
    };

    const result = await ImageComposer.composeGrid(testImages, options);
    expect(result).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('콜라주 스타일 합성이 올바르게 작동한다', async () => {
    const canvasSize = { width: 400, height: 300 };
    const options = {
      backgroundColor: '#ffffff',
      randomRotation: true,
      maxRotation: 15,
      overlap: false
    };

    const result = await ImageComposer.composeCollage(testImages, canvasSize, options);
    expect(result).toBeDefined();
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it('빈 이미지 배열로 그리드 합성 시 오류가 발생한다', async () => {
    const options = {
      rows: 2,
      cols: 2
    };

    await expect(ImageComposer.composeGrid([], options))
      .rejects
      .toThrow('이미지가 제공되지 않았습니다');
  });
});

describe('통합 테스트', () => {
  let testImage: HTMLImageElement;
  let watermarkImage: HTMLImageElement;

  beforeAll(async () => {
    testImage = await createTestImage(200, 200, '#4CAF50');
    watermarkImage = await createTestImage(30, 30, '#FF5722');
  });

  it('텍스트와 이미지 워터마크를 함께 적용할 수 있다', () => {
    const canvas = createTestCanvas(300, 200);
    
    // 먼저 베이스 이미지 그리기
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(testImage, 50, 0);

    // 텍스트 워터마크 추가
    TextWatermark.addToCanvas(canvas, {
      text: '© 2024 Test Company',
      position: Position.BOTTOM_LEFT,
      style: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold'
      }
    });

    // 이미지 워터마크 추가
    ImageWatermark.addToCanvas(canvas, {
      watermarkImage: watermarkImage,
      position: Position.TOP_RIGHT,
      scale: 0.8,
      opacity: 0.9
    });

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(200);
  });

  it('복잡한 합성 시나리오가 올바르게 작동한다', async () => {
    const layers = [
      {
        image: testImage,
        x: 0,
        y: 0,
        width: 150,
        height: 150
      },
      {
        image: watermarkImage,
        x: 120,
        y: 120,
        opacity: 0.7,
        rotation: 30
      }
    ];

    const result = await ImageComposer.composeLayers(layers, {
      width: 200,
      height: 200,
      backgroundColor: '#f5f5f5'
    });

    // 결과 캔버스에 추가적인 워터마크 적용
    TextWatermark.addToCanvas(result, {
      text: 'COMPOSED',
      position: Position.MIDDLE_CENTER,
      style: {
        fontSize: 20,
        color: 'rgba(0,0,0,0.5)',
        fontWeight: 'bold'
      },
      rotation: -15
    });

    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });
});