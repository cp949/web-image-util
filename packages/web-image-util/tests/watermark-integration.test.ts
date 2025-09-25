import { describe, it, expect, beforeAll } from 'vitest';
import { ImageResizer } from '../src/ImageResizer';
import { Position } from '../src/composition/position-types';
import { TextWatermarkOptions, ImageWatermarkOptions } from '../src/index';

// 테스트용 이미지 생성 헬퍼
async function createTestImageBlob(width: number = 200, height: number = 200, color: string = '#4CAF50'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  // 약간의 패턴 추가로 더 현실적인 이미지 만들기
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(20, 20, width - 40, height - 40);
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    });
  });
}

async function createTestImage(width: number = 50, height: number = 50, color: string = '#FF5722'): Promise<HTMLImageElement> {
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

describe('ImageResizer 워터마크 통합', () => {
  let testBlob: Blob;
  let watermarkImage: HTMLImageElement;

  beforeAll(async () => {
    testBlob = await createTestImageBlob();
    watermarkImage = await createTestImage();
  });

  it('텍스트 워터마크와 함께 리사이징할 수 있다', async () => {
    const textWatermark: TextWatermarkOptions = {
      text: '테스트 워터마크',
      position: Position.BOTTOM_RIGHT,
      style: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold',
        shadow: {
          color: 'rgba(0,0,0,0.5)',
          offsetX: 1,
          offsetY: 1,
          blur: 2
        }
      }
    };

    const resizedBlob = await ImageResizer
      .from(testBlob)
      .centerInside({ size: 150 })
      .addTextWatermark(textWatermark)
      .toBlob('jpeg');

    expect(resizedBlob).toBeDefined();
    expect(resizedBlob.size).toBeGreaterThan(0);
    expect(resizedBlob.type).toBe('image/jpeg');
  });

  it('이미지 워터마크와 함께 리사이징할 수 있다', async () => {
    const imageWatermark: ImageWatermarkOptions = {
      watermarkImage: watermarkImage,
      position: Position.TOP_LEFT,
      scale: 0.3,
      opacity: 0.8
    };

    const resizedBlob = await ImageResizer
      .from(testBlob)
      .centerCrop({ size: { width: 100, height: 100 } })
      .addImageWatermark(imageWatermark)
      .toBlob('png');

    expect(resizedBlob).toBeDefined();
    expect(resizedBlob.size).toBeGreaterThan(0);
    expect(resizedBlob.type).toBe('image/png');
  });

  it('여러 워터마크를 동시에 적용할 수 있다', async () => {
    const textWatermark: TextWatermarkOptions = {
      text: '© 2024',
      position: Position.BOTTOM_LEFT,
      style: {
        fontSize: 12,
        color: '#ffffff',
        opacity: 0.9
      }
    };

    const imageWatermark: ImageWatermarkOptions = {
      watermarkImage: watermarkImage,
      position: Position.TOP_RIGHT,
      scale: 0.2,
      opacity: 0.7
    };

    const resizedBlob = await ImageResizer
      .from(testBlob)
      .fit({ size: { width: 120, height: 120 } })
      .addTextWatermark(textWatermark)
      .addImageWatermark(imageWatermark)
      .toBlob('jpeg');

    expect(resizedBlob).toBeDefined();
    expect(resizedBlob.size).toBeGreaterThan(0);
  });

  it('필터와 워터마크를 함께 적용할 수 있다', async () => {
    const textWatermark: TextWatermarkOptions = {
      text: 'FILTERED',
      position: Position.MIDDLE_CENTER,
      style: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold'
      },
      rotation: -15
    };

    const resizedBlob = await ImageResizer
      .from(testBlob)
      .centerInside({ size: 180 })
      .brightness(10)
      .contrast(15)
      .addTextWatermark(textWatermark)
      .toBlob('jpeg');

    expect(resizedBlob).toBeDefined();
    expect(resizedBlob.size).toBeGreaterThan(0);
  });

  it('워터마크 체인을 관리할 수 있다', async () => {
    const resizer = ImageResizer
      .from(testBlob)
      .centerInside({ size: 100 });

    // 워터마크 추가
    resizer.addTextWatermark({
      text: '첫 번째',
      position: Position.TOP_LEFT,
      style: { fontSize: 12, color: '#000' }
    });

    resizer.addTextWatermark({
      text: '두 번째',
      position: Position.TOP_RIGHT,
      style: { fontSize: 12, color: '#000' }
    });

    // 워터마크 목록 확인
    const watermarks = resizer.getWatermarks();
    expect(watermarks).toHaveLength(2);

    // 첫 번째 워터마크가 텍스트 워터마크인지 확인
    expect('text' in watermarks[0]).toBe(true);
    if ('text' in watermarks[0]) {
      expect(watermarks[0].text).toBe('첫 번째');
    }

    // 워터마크 초기화
    resizer.clearWatermarks();
    expect(resizer.getWatermarks()).toHaveLength(0);

    // 워터마크 없이 변환
    const result = await resizer.toBlob('jpeg');
    expect(result).toBeDefined();
  });

  it('DataURL로 워터마크가 포함된 이미지를 변환할 수 있다', async () => {
    const textWatermark: TextWatermarkOptions = {
      text: 'DATA URL TEST',
      position: Position.MIDDLE_CENTER,
      style: {
        fontSize: 14,
        color: '#ff0000',
        fontWeight: 'bold'
      }
    };

    const dataUrl = await ImageResizer
      .from(testBlob)
      .centerInside({ size: 100 })
      .addTextWatermark(textWatermark)
      .toDataUrl('jpeg');

    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(dataUrl.length).toBeGreaterThan(1000); // Base64 데이터가 충분히 있는지 확인
  });

  it('HTMLImageElement로 워터마크가 포함된 이미지를 변환할 수 있다', async () => {
    const imageWatermark: ImageWatermarkOptions = {
      watermarkImage: watermarkImage,
      position: Position.BOTTOM_RIGHT,
      scale: 0.25,
      opacity: 0.8
    };

    const element = await ImageResizer
      .from(testBlob)
      .centerCrop({ size: 80 })
      .addImageWatermark(imageWatermark)
      .toElement('png');

    expect(element).toBeInstanceOf(HTMLImageElement);
    expect(element.width).toBeGreaterThan(0);
    expect(element.height).toBeGreaterThan(0);
  });
});

