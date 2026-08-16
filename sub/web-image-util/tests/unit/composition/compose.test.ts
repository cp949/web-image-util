/**
 * composeImages(spec) 행동 테스트
 *
 * spec 입력 → 반환 canvas 픽셀 / drawImage 호출 시퀀스만 검증한다.
 * 내부 레이아웃 계산·그리기 프리미티브는 이 표면을 통해서만 커버한다.
 *
 * collage 난수는 항상 주입해 결정적으로 재현한다(소비 순서는 계약이 아니므로
 * 시드 결정성·기하 결과만 단언하고 소비 횟수는 단언하지 않는다).
 */

import { describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src';
import { composeImages } from '../../../src/composition/compose';
import { createTestCanvas, getCanvasPixelData } from '../../utils/canvas-helper';

/** node-canvas가 drawImage 소스로 수락하는 색 지정 Canvas를 만든다. */
function createColorSource(width: number, height: number, color: string): HTMLImageElement {
  const canvas = createTestCanvas(width, height, color);
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

/** collage 결과를 결정적으로 재현할 수 있는 시드 고정 PRNG를 만든다. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 실제 그리기 없이 drawImage 인자를 수집한다.
 * 픽셀 단언 테스트와 같은 테스트에서는 사용하지 않는다.
 */
function collectDrawImageArgs(): { observed: unknown[][]; restore: () => void } {
  const tempCtx = document.createElement('canvas').getContext('2d')!;
  const observed: unknown[][] = [];
  const spy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation((...args: unknown[]) => {
    observed.push(args);
  });
  return { observed, restore: () => spy.mockRestore() };
}

/** 결정성 비교를 위해 Canvas 전체 픽셀을 바이트 배열로 읽는다. */
function getImageBytes(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
}

// ============================================================================
// layers spec
// ============================================================================

describe('composeImages — layers', () => {
  it('지정한 크기의 canvas를 반환하고 배경색을 채운다', async () => {
    const canvas = await composeImages({
      type: 'layers',
      width: 40,
      height: 30,
      background: '#ff0000',
      layers: [],
    });

    expect(canvas.width).toBe(40);
    expect(canvas.height).toBe(30);
    const px = getCanvasPixelData(canvas, 1, 1);
    expect([px.r, px.g, px.b, px.a]).toEqual([255, 0, 0, 255]);
  });

  it('background 생략 시 배경은 투명하다', async () => {
    const canvas = await composeImages({ type: 'layers', width: 10, height: 10, layers: [] });
    expect(getCanvasPixelData(canvas, 5, 5).a).toBe(0);
  });

  it('레이어는 배열 순서대로 그려진다 — 뒤 원소가 위를 덮는다', async () => {
    const red = createColorSource(20, 20, 'red');
    const blue = createColorSource(20, 20, 'blue');

    const canvas = await composeImages({
      type: 'layers',
      width: 20,
      height: 20,
      layers: [
        { image: red, x: 0, y: 0 },
        { image: blue, x: 0, y: 0 },
      ],
    });

    const px = getCanvasPixelData(canvas, 10, 10);
    expect([px.r, px.g, px.b]).toEqual([0, 0, 255]);
  });

  it('visible=false 레이어는 그려지지 않는다', async () => {
    const red = createColorSource(20, 20, 'red');
    const blue = createColorSource(20, 20, 'blue');

    const canvas = await composeImages({
      type: 'layers',
      width: 20,
      height: 20,
      layers: [
        { image: red, x: 0, y: 0 },
        { image: blue, x: 0, y: 0, visible: false },
      ],
    });

    const px = getCanvasPixelData(canvas, 10, 10);
    expect([px.r, px.g, px.b]).toEqual([255, 0, 0]);
  });

  it('opacity=0 레이어는 완전 투명으로 그려진다 — 1로 대체되지 않는다', async () => {
    const red = createColorSource(20, 20, 'red');
    const blue = createColorSource(20, 20, 'blue');

    const canvas = await composeImages({
      type: 'layers',
      width: 20,
      height: 20,
      layers: [
        { image: red, x: 0, y: 0 },
        { image: blue, x: 0, y: 0, opacity: 0 },
      ],
    });

    // opacity 0 이 1 로 바뀌던 기존 결함의 회귀 — 아래 red 가 그대로 보여야 한다
    const px = getCanvasPixelData(canvas, 10, 10);
    expect([px.r, px.g, px.b]).toEqual([255, 0, 0]);
  });

  it('width/height 생략 시 소스 원본 크기로 그린다', async () => {
    const img = createColorSource(80, 60, 'red');
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({
        type: 'layers',
        width: 200,
        height: 200,
        layers: [{ image: img, x: 5, y: 7 }],
      });

      expect(observed).toHaveLength(1);
      expect(observed[0].slice(1)).toEqual([5, 7, 80, 60]);
    } finally {
      restore();
    }
  });

  it('canvas 크기가 무효하면 INVALID_DIMENSIONS를 던진다', async () => {
    const spec = { type: 'layers', width: 0, height: 10, layers: [] } as const;
    await expect(composeImages(spec)).rejects.toThrow(ImageProcessError);
    await expect(composeImages(spec)).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    await expect(composeImages({ type: 'layers', width: 10, height: Number.NaN, layers: [] })).rejects.toMatchObject({
      code: 'INVALID_DIMENSIONS',
    });
  });

  it('레이어 width에 0 이하를 지정하면 OPTION_INVALID를 던진다 — 원본 크기로 조용히 대체하지 않는다', async () => {
    const img = createColorSource(20, 20, 'red');
    await expect(
      composeImages({ type: 'layers', width: 50, height: 50, layers: [{ image: img, x: 0, y: 0, width: 0 }] })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });

  it('opacity가 0..1 범위 밖이면 OPTION_INVALID를 던진다', async () => {
    const img = createColorSource(20, 20, 'red');
    await expect(
      composeImages({ type: 'layers', width: 50, height: 50, layers: [{ image: img, x: 0, y: 0, opacity: 1.5 }] })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });

  it('layers opacity 무효값의 details에는 minimum이 없다', async () => {
    const img = createColorSource(20, 20, 'red');
    const error = await composeImages({
      type: 'layers',
      width: 50,
      height: 50,
      layers: [{ image: img, x: 0, y: 0, opacity: 1.5 }],
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ImageProcessError);
    expect((error as ImageProcessError).details).toEqual({ option: 'layers[0].opacity' });
  });

  it('레이어 height에 0 이하를 지정하면 OPTION_INVALID를 던진다', async () => {
    const img = createColorSource(20, 20, 'red');
    await expect(
      composeImages({ type: 'layers', width: 50, height: 50, layers: [{ image: img, x: 0, y: 0, height: -1 }] })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });

  it('레이어 x/y·rotation이 비유한값이면 OPTION_INVALID를 던진다 — 침묵 소멸 방지', async () => {
    const img = createColorSource(20, 20, 'red');
    await expect(
      composeImages({ type: 'layers', width: 50, height: 50, layers: [{ image: img, x: Number.NaN, y: 0 }] })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
    await expect(
      composeImages({
        type: 'layers',
        width: 50,
        height: 50,
        layers: [{ image: img, x: 0, y: 0, rotation: Number.POSITIVE_INFINITY }],
      })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });
});

// ============================================================================
// grid spec
// ============================================================================

describe('composeImages — grid', () => {
  it('images가 비어 있으면 INVALID_SOURCE를 던진다', async () => {
    await expect(composeImages({ type: 'grid', images: [] })).rejects.toThrow(ImageProcessError);
    await expect(composeImages({ type: 'grid', images: [] })).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('columns 기본값은 ⌈√n⌉이고 행 수·canvas 크기가 파생된다', async () => {
    // 5장 → columns 3, rows 2. cell 100x100, spacing 10
    const images = Array.from({ length: 5 }, () => createColorSource(100, 100, 'red'));
    const canvas = await composeImages({ type: 'grid', images });

    expect(canvas.width).toBe(3 * 100 + 4 * 10);
    expect(canvas.height).toBe(2 * 100 + 3 * 10);
  });

  it('columns를 지정하면 행 수가 파생되어 이미지가 잘리지 않는다', async () => {
    // 5장, columns 2 → rows 3 — 전부 그려진다
    const images = Array.from({ length: 5 }, () => createColorSource(50, 50, 'red'));
    const { observed, restore } = collectDrawImageArgs();

    try {
      const canvas = await composeImages({ type: 'grid', images, columns: 2 });
      expect(observed).toHaveLength(5);
      expect(canvas.height).toBe(3 * 50 + 4 * 10);
    } finally {
      restore();
    }
  });

  it('행 우선 순서로 셀 좌표에 배치한다', async () => {
    // 4장 2x2, cell 50x50, spacing 10, fill — 좌표 = spacing + col*(cell+spacing)
    const images = Array.from({ length: 4 }, () => createColorSource(50, 50, 'red'));
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({ type: 'grid', images, columns: 2, fit: 'fill' });
      const rects = observed.map((args) => args.slice(1));
      expect(rects).toEqual([
        [10, 10, 50, 50],
        [70, 10, 50, 50],
        [10, 70, 50, 50],
        [70, 70, 50, 50],
      ]);
    } finally {
      restore();
    }
  });

  it('contain fit은 종횡비를 유지하고 셀 중앙에 배치한다', async () => {
    // 200x100 이미지 + 100x100 이미지 → cell 200x100. 100x100 은 contain 시 100x100 그대로 중앙 (x+50)
    const wide = createColorSource(200, 100, 'red');
    const square = createColorSource(100, 100, 'blue');
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({ type: 'grid', images: [wide, square], columns: 2, spacing: 0 });
      expect(observed[0].slice(1)).toEqual([0, 0, 200, 100]);
      // square: scale = min(200/100, 100/100) = 1 → 100x100, 셀 시작 x=200 + 중앙 offset 50
      expect(observed[1].slice(1)).toEqual([250, 0, 100, 100]);
    } finally {
      restore();
    }
  });

  it('cover fit은 셀 밖으로 넘치는 부분을 클리핑한다 — spacing 영역은 배경색을 유지한다', async () => {
    // A(200x100)·B(100x200) → cell 200x200. cover 시 A 는 400x200 으로 확대되어
    // 클리핑이 없으면 셀 사이 spacing(x:220..240)을 침범한다.
    const a = createColorSource(200, 100, 'red');
    const b = createColorSource(100, 200, 'red');

    const canvas = await composeImages({
      type: 'grid',
      images: [a, b],
      columns: 2,
      spacing: 20,
      fit: 'cover',
      background: '#ffffff',
    });

    const px = getCanvasPixelData(canvas, 230, 100);
    expect([px.r, px.g, px.b]).toEqual([255, 255, 255]);
  });

  it('columns·spacing 무효값은 OPTION_INVALID를 던진다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    await expect(composeImages({ type: 'grid', images, columns: 0 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
    await expect(composeImages({ type: 'grid', images, columns: 1.5 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
    await expect(composeImages({ type: 'grid', images, spacing: -1 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
  });

  it('columns 무효값의 details에 option과 minimum이 실린다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    await expect(composeImages({ type: 'grid', images, columns: 0 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'columns', minimum: 1 },
    });
  });

  it('숫자가 아닌 런타임 spacing 값도 OPTION_INVALID로 거부한다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    await expect(
      composeImages({ type: 'grid', images, spacing: Symbol('spacing') as unknown as number })
    ).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'spacing', minimum: 0 },
    });
  });

  it('columns=1, spacing=0은 하한 경계값이라도 통과한다', async () => {
    const images = [createColorSource(50, 50, '#ff0000'), createColorSource(50, 50, '#00ff00')];
    const canvas = await composeImages({ type: 'grid', images, columns: 1, spacing: 0 });
    // columns=1 → 두 이미지가 한 열로 쌓인다, spacing=0 → 여백 없이 붙는다
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(100);
  });

  it('fit 무효값은 canvas를 만들기 전에 OPTION_INVALID를 던진다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    await expect(composeImages({ type: 'grid', images, fit: 'stretch' as unknown as 'contain' })).rejects.toMatchObject(
      {
        code: 'OPTION_INVALID',
      }
    );
  });

  it('배경색 기본값은 흰색이다 — spacing 영역이 흰색 불투명', async () => {
    const canvas = await composeImages({ type: 'grid', images: [createColorSource(30, 30, 'red')] });
    const px = getCanvasPixelData(canvas, 1, 1);
    expect([px.r, px.g, px.b, px.a]).toEqual([255, 255, 255, 255]);
  });
});

// ============================================================================
// collage spec
// ============================================================================

describe('composeImages — collage', () => {
  it('지정한 크기의 canvas를 반환하고 빈 images는 배경만 채운다', async () => {
    const canvas = await composeImages({ type: 'collage', images: [], width: 60, height: 40 });

    expect(canvas.width).toBe(60);
    expect(canvas.height).toBe(40);
    const px = getCanvasPixelData(canvas, 30, 20);
    expect([px.r, px.g, px.b]).toEqual([255, 255, 255]);
  });

  it('동일 spec + 동일 시드 난수는 동일한 픽셀을 만든다', async () => {
    const makeSpec = () => ({
      type: 'collage' as const,
      images: [createColorSource(100, 100, 'red'), createColorSource(100, 100, 'blue')],
      width: 120,
      height: 90,
      random: mulberry32(42),
    });

    const first = await composeImages(makeSpec());
    const second = await composeImages(makeSpec());

    expect(getImageBytes(first)).toEqual(getImageBytes(second));
  });

  it('scaleRange가 단일값이면 배치 크기가 원본×배율로 고정된다', async () => {
    const img = createColorSource(100, 80, 'red');
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({
        type: 'collage',
        images: [img],
        width: 400,
        height: 300,
        scaleRange: [0.5, 0.5],
        maxRotation: 0,
        random: mulberry32(1),
      });

      expect(observed).toHaveLength(1);
      const [, , , w, h] = observed[0] as [unknown, number, number, number, number];
      expect(w).toBe(50);
      expect(h).toBe(40);
    } finally {
      restore();
    }
  });

  it('allowOverlap=false면 배치 영역이 서로 겹치지 않는다', async () => {
    const images = Array.from({ length: 3 }, () => createColorSource(100, 100, 'red'));
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({
        type: 'collage',
        images,
        width: 800,
        height: 600,
        scaleRange: [0.2, 0.2],
        maxRotation: 0,
        allowOverlap: false,
        random: mulberry32(7),
      });

      const rects = observed.map((args) => {
        const [, x, y, w, h] = args as [unknown, number, number, number, number];
        return { x, y, w, h };
      });
      expect(rects).toHaveLength(3);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlaps).toBe(false);
        }
      }
    } finally {
      restore();
    }
  });

  it('allowOverlap=false에서 겹치는 후보는 버리고 다음 후보를 채택한다', async () => {
    // 이 테스트는 현재 구현의 난수 소비 순서(이미지마다 scale 1회 → 시도마다 x·y 각 1회)를
    // 사용한다 — 소비 순서는 공개 계약이 아니므로 배치 알고리즘 변경 시 이 시퀀스를 갱신한다.
    const images = [createColorSource(100, 100, 'red'), createColorSource(100, 100, 'blue')];
    const seq = [
      0, // 1번 이미지 scale → 0.5
      0,
      0, // 1번 이미지 배치 (0, 0) — rect (0,0,50,50)
      0, // 2번 이미지 scale → 0.5
      0.1,
      0.1, // 2번 이미지 1차 후보 (15, 15) — 1번과 겹침 → 재시도해야 한다
      0.9,
      0.9, // 2번 이미지 2차 후보 (135, 135) — 채택
    ];
    let cursor = 0;
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({
        type: 'collage',
        images,
        width: 200,
        height: 200,
        scaleRange: [0.5, 0.5],
        maxRotation: 0,
        allowOverlap: false,
        random: () => seq[cursor++] ?? 0.5,
      });

      expect(observed).toHaveLength(2);
      // 겹침 회피가 없다면 1차 후보 (15, 15)가 그대로 채택되어 실패한다
      expect(observed[1].slice(1)).toEqual([135, 135, 50, 50]);
    } finally {
      restore();
    }
  });

  it('allowOverlap=false여도 공간이 부족하면 겹침을 허용하고 전부 그린다 — 최선 노력', async () => {
    // 40x40 canvas 에 20x20 다섯 개 — 비겹침 배치가 사실상 불가능한 밀도
    const images = Array.from({ length: 5 }, () => createColorSource(100, 100, 'red'));
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({
        type: 'collage',
        images,
        width: 40,
        height: 40,
        scaleRange: [0.2, 0.2],
        maxRotation: 0,
        allowOverlap: false,
        maxPlacementAttempts: 5,
        random: mulberry32(3),
      });

      expect(observed).toHaveLength(5);
    } finally {
      restore();
    }
  });

  it('스케일된 이미지가 canvas보다 크면 canvas 안에 맞게 클램프한다', async () => {
    const img = createColorSource(400, 400, 'red');
    const { observed, restore } = collectDrawImageArgs();

    try {
      await composeImages({
        type: 'collage',
        images: [img],
        width: 100,
        height: 100,
        scaleRange: [0.5, 0.5],
        maxRotation: 0,
        random: mulberry32(1),
      });

      const [, x, y, w, h] = observed[0] as [unknown, number, number, number, number];
      expect(w).toBeLessThanOrEqual(100);
      expect(h).toBeLessThanOrEqual(100);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    } finally {
      restore();
    }
  });

  it('collage 옵션 무효값은 OPTION_INVALID를 던진다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    const base = { type: 'collage', images, width: 100, height: 100 } as const;

    await expect(composeImages({ ...base, scaleRange: [0.5, 0.2] })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
    await expect(composeImages({ ...base, maxPlacementAttempts: 0 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
    await expect(composeImages({ ...base, maxRotation: -1 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
  });

  it('maxRotation=0, maxPlacementAttempts=1은 하한 경계값이라도 통과한다', async () => {
    const images = [createColorSource(20, 20, '#0000ff')];
    const canvas = await composeImages({
      type: 'collage',
      images,
      width: 100,
      height: 100,
      maxRotation: 0,
      maxPlacementAttempts: 1,
      random: () => 0.5,
    });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it('random 옵션이 함수가 아니면 canvas를 만들기 전에 OPTION_INVALID를 던진다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    await expect(
      composeImages({
        type: 'collage',
        images,
        width: 100,
        height: 100,
        random: 0.5 as unknown as () => number,
      })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });

  it('random 반환값이 [0, 1) 밖이면 canvas를 만들기 전에 OPTION_INVALID를 던진다', async () => {
    const images = [createColorSource(10, 10, 'red')];
    await expect(
      composeImages({
        type: 'collage',
        images,
        width: 100,
        height: 100,
        random: () => Number.NaN,
      })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });

  it('canvas 크기가 무효하면 INVALID_DIMENSIONS를 던진다', async () => {
    await expect(composeImages({ type: 'collage', images: [], width: -5, height: 100 })).rejects.toMatchObject({
      code: 'INVALID_DIMENSIONS',
    });
  });
});
