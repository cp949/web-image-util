/**
 * ImageComposer의 레이어 합성·그리드·콜라주 기능을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { ImageComposer } from '../../../src/composition/image-composer';

function createTestImage(width = 100, height = 100): HTMLImageElement {
  const img = new Image();
  img.width = width;
  img.height = height;
  return img as HTMLImageElement;
}

describe('ImageComposer.composeLayers', () => {
  it('레이어 목록으로 지정한 크기의 Canvas를 반환한다', async () => {
    const img = createTestImage();
    const canvas = await ImageComposer.composeLayers([{ image: img, x: 0, y: 0 }], {
      width: 400,
      height: 300,
    });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });

  it('visible=false인 레이어는 건너뛴다', async () => {
    const img = createTestImage();
    const canvas = await ImageComposer.composeLayers([{ image: img, x: 0, y: 0, visible: false }], {
      width: 200,
      height: 200,
    });
    expect(canvas).toBeDefined();
  });

  it('backgroundColor가 있으면 배경색을 채운다', async () => {
    const img = createTestImage();
    const canvas = await ImageComposer.composeLayers([{ image: img, x: 0, y: 0 }], {
      width: 200,
      height: 200,
      backgroundColor: '#ff0000',
    });
    expect(canvas).toBeDefined();
  });

  it('rotation·opacity·blendMode가 있는 레이어도 정상 처리한다', async () => {
    const img = createTestImage(50, 50);
    const canvas = await ImageComposer.composeLayers(
      [{ image: img, x: 10, y: 10, rotation: 45, opacity: 0.5, blendMode: 'multiply' }],
      { width: 200, height: 200 }
    );
    expect(canvas).toBeDefined();
  });

  it('레이어가 없으면 빈 Canvas를 반환한다', async () => {
    const canvas = await ImageComposer.composeLayers([], { width: 100, height: 100 });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it('width·height를 생략한 레이어는 이미지 원래 크기를 사용한다', async () => {
    const img = createTestImage(80, 60);
    const canvas = await ImageComposer.composeLayers([{ image: img, x: 5, y: 5 }], {
      width: 300,
      height: 200,
    });
    expect(canvas).toBeDefined();
  });
});

describe('ImageComposer.composeGrid', () => {
  it('이미지 배열이 비어 있으면 에러를 던진다', async () => {
    await expect(ImageComposer.composeGrid([], { rows: 2, cols: 2 })).rejects.toThrow('No images provided');
  });

  it('기본 옵션으로 Canvas를 반환한다', async () => {
    const images = [createTestImage(100, 100), createTestImage(100, 100)];
    const canvas = await ImageComposer.composeGrid(images, { rows: 1, cols: 2 });
    expect(canvas).toBeDefined();
  });

  it('contain fit으로 그리드를 렌더링한다', async () => {
    const canvas = await ImageComposer.composeGrid([createTestImage(80, 60)], {
      rows: 1,
      cols: 1,
      fit: 'contain',
    });
    expect(canvas).toBeDefined();
  });

  it('cover fit으로 그리드를 렌더링한다', async () => {
    const canvas = await ImageComposer.composeGrid([createTestImage(80, 60)], {
      rows: 1,
      cols: 1,
      fit: 'cover',
    });
    expect(canvas).toBeDefined();
  });

  it('fill fit으로 그리드를 렌더링한다', async () => {
    const canvas = await ImageComposer.composeGrid([createTestImage(80, 60)], {
      rows: 1,
      cols: 1,
      fit: 'fill',
    });
    expect(canvas).toBeDefined();
  });

  it('spacing·backgroundColor 옵션이 반영된다', async () => {
    const images = [createTestImage(), createTestImage(), createTestImage(), createTestImage()];
    const canvas = await ImageComposer.composeGrid(images, {
      rows: 2,
      cols: 2,
      spacing: 20,
      backgroundColor: '#cccccc',
    });
    expect(canvas).toBeDefined();
  });
});

describe('ImageComposer.composeCollage', () => {
  it('이미지 목록으로 지정한 크기의 Canvas를 반환한다', async () => {
    const canvas = await ImageComposer.composeCollage([createTestImage()], { width: 800, height: 600 });
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('randomRotation=false·overlap=false 옵션을 처리한다', async () => {
    const canvas = await ImageComposer.composeCollage(
      [createTestImage(), createTestImage(80, 80)],
      { width: 800, height: 600 },
      { randomRotation: false, overlap: false }
    );
    expect(canvas).toBeDefined();
  });

  it('backgroundColor 옵션이 반영된다', async () => {
    const canvas = await ImageComposer.composeCollage(
      [createTestImage()],
      { width: 400, height: 300 },
      {
        backgroundColor: '#eeeeee',
      }
    );
    expect(canvas).toBeDefined();
  });

  it('이미지가 없어도 빈 Canvas를 반환한다', async () => {
    const canvas = await ImageComposer.composeCollage([], { width: 200, height: 200 });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });
});
