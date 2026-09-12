/**
 * processImage().box() 체인 end-to-end 검증 (Canvas 입력, jsdom-safe)
 *
 * 출력 크기, 픽셀(node-canvas getImageData), 오류 코드, 체인 위치 무관성을 본다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { ImageProcessError } from '../../../../src/types';
import { createTestCanvas } from '../../../utils/canvas-helper';

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const data = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

describe('box 체인 — 출력 크기', () => {
  it('padding만 하면 출력이 content + padding*2다', async () => {
    const result = await processImage(createTestCanvas(100, 80, 'blue'))
      .box({ padding: 10 })
      .toBlob();

    expect(result.width).toBe(120);
    expect(result.height).toBe(100);
  });

  it('outside border는 크기를 늘리고, inset border는 늘리지 않는다', async () => {
    const outside = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ border: { width: 5, color: '#000' } })
      .toBlob();
    const inset = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ border: { width: 5, color: '#000', inset: true } })
      .toBlob();

    expect([outside.width, outside.height]).toEqual([110, 110]);
    expect([inset.width, inset.height]).toEqual([100, 100]);
  });

  it('radius만 하면 크기는 바뀌지 않는다', async () => {
    const result = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ radius: '50%' })
      .toBlob();

    expect([result.width, result.height]).toEqual([100, 100]);
  });

  it('빈 box는 no-op이다', async () => {
    const result = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({})
      .toBlob();

    expect([result.width, result.height]).toEqual([100, 100]);
  });

  it('box는 resize 앞이든 뒤든 같은 결과를 낸다(체인 위치 무관)', async () => {
    const before = await processImage(createTestCanvas(400, 300, 'blue'))
      .box({ padding: 10 })
      .resize({ fit: 'cover', width: 100, height: 100 })
      .toBlob();
    const after = await processImage(createTestCanvas(400, 300, 'blue'))
      .resize({ fit: 'cover', width: 100, height: 100 })
      .box({ padding: 10 })
      .toBlob();

    // resize 결과(100x100)에 padding 10*2가 더해진다 — 순서와 무관하게 항상 바깥에 적용된다
    expect([before.width, before.height]).toEqual([120, 120]);
    expect([after.width, after.height]).toEqual([120, 120]);
  });

  it('metadata.operations에 box가 포함된다', async () => {
    const result = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ padding: 4 })
      .blur(1)
      .toBlob();

    expect(result.operations).toBe(2);
  });
});

describe('box 체인 — 픽셀', () => {
  it('background는 padding 영역을 채우고 content는 그대로 보인다', async () => {
    const { canvas } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ padding: 10, background: '#ffff00' })
      .toCanvas();

    expect(pixelAt(canvas, 5, 5)).toEqual([255, 255, 0, 255]); // padding 영역 — 노랑
    expect(pixelAt(canvas, 60, 60)).toEqual([0, 0, 255, 255]); // content 영역 — 파랑
  });

  it('radius 밖 모서리는 투명이다', async () => {
    const { canvas } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ radius: 20 })
      .toCanvas();

    expect(pixelAt(canvas, 1, 1)[3]).toBe(0); // 모서리 바깥 — 투명
    expect(pixelAt(canvas, 50, 50)).toEqual([0, 0, 255, 255]); // 중앙 — 파랑, 클립 영향 없음
  });

  it('불투명 border는 링 형태로 보이고 content 위를 덮지 않는다', async () => {
    const { canvas } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ padding: 10, border: { width: 4, color: '#ff0000' } })
      .toCanvas();

    // outer = 100 + 10*2 + 4*2 = 128. border는 바깥 가장자리 4px 밴드.
    expect(pixelAt(canvas, 2, 64)).toEqual([255, 0, 0, 255]); // border 밴드 — 빨강
    expect(pixelAt(canvas, 64, 64)).toEqual([0, 0, 255, 255]); // content 중앙 — 파랑, border 영향 없음
  });

  it('반투명 border는 background와 합성된다', async () => {
    const { canvas } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ padding: 10, background: '#ffffff', border: { width: 4, color: 'rgba(255,0,0,0.5)' } })
      .toCanvas();

    const [r, g, b, a] = pixelAt(canvas, 2, 64);
    // 흰 배경(255,255,255) 위에 50% 빨강을 합성 → (255, 127~128, 127~128) 근방, 완전 불투명
    expect(r).toBe(255);
    expect(g).toBeLessThan(200);
    expect(b).toBeLessThan(200);
    expect(a).toBe(255);
  });

  it('inset border는 padding 0이면 content 위에 겹친다', async () => {
    const { canvas } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ border: { width: 6, color: '#ff0000', inset: true } })
      .toCanvas();

    expect([canvas.width, canvas.height]).toEqual([100, 100]);
    expect(pixelAt(canvas, 2, 50)).toEqual([255, 0, 0, 255]); // 가장자리 — border가 content 위를 덮는다
    expect(pixelAt(canvas, 50, 50)).toEqual([0, 0, 255, 255]); // 중앙 — 파랑
  });
});

describe('box 체인 — 오류와 순서', () => {
  it('두 번째 box()는 OPTION_INVALID다', () => {
    const processor = processImage(createTestCanvas(100, 100, 'blue'));
    processor.box({ padding: 4 });

    expect(() => processor.box({ padding: 8 })).toThrow(ImageProcessError);
    try {
      processor.box({ padding: 8 });
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }
  });

  it('box()와 resize()의 padding/background 동시 지정은 순서와 무관하게 거부된다', () => {
    // box() 먼저, 그 뒤 resize()에 padding — addResize가 동기적으로 던진다.
    expect(() =>
      processImage(createTestCanvas(100, 100, 'blue'))
        .box({ padding: 4 })
        .resize({ fit: 'cover', width: 10, height: 10, padding: 2 })
    ).toThrow(ImageProcessError);
    try {
      processImage(createTestCanvas(100, 100, 'blue'))
        .box({ padding: 4 })
        .resize({ fit: 'cover', width: 10, height: 10, padding: 2 });
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }

    // resize()에 background 먼저, 그 뒤 box() — addBox가 동기적으로 던진다.
    expect(() =>
      processImage(createTestCanvas(100, 100, 'blue'))
        .resize({ fit: 'cover', width: 10, height: 10, background: '#fff' })
        .box({})
    ).toThrow(ImageProcessError);
    try {
      processImage(createTestCanvas(100, 100, 'blue'))
        .resize({ fit: 'cover', width: 10, height: 10, background: '#fff' })
        .box({});
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }
  });

  it('잘못된 옵션은 호출 즉시 던지고 이후 호출은 정상이다', async () => {
    const processor = processImage(createTestCanvas(100, 100, 'blue'));

    expect(() => processor.box({ padding: -1 })).toThrow(ImageProcessError);
    try {
      processor.box({ padding: -1 });
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }

    const result = await processor.box({ padding: 4 }).toBlob();
    expect([result.width, result.height]).toEqual([108, 108]);
  });

  it('별도 인스턴스는 독립적으로 box를 쓸 수 있다', async () => {
    const source = createTestCanvas(100, 100, 'blue');
    const a = await processImage(source).box({ padding: 5 }).toBlob();
    const b = await processImage(source).box({ radius: 10 }).toBlob();

    expect([a.width, a.height]).toEqual([110, 110]);
    expect([b.width, b.height]).toEqual([100, 100]);
  });
});

describe('box 체인 — transform 조합', () => {
  it('transform()과 함께 사용해도 정상 렌더된다', async () => {
    // 100x100 정사각형을 45도 회전(expand 기본값 true) → 프레임은 약 141x141 diamond.
    // 회전된 정사각형은 프레임 네 모서리를 채우지 못하므로, box background가 그 틈을 채운다.
    // radius를 함께 줘서 box의 padding-box clip(needsPaddingBoxClip)이 실제로 걸리게 한다 —
    // drawTransformedImage가 그 clip 안에서 자기 save()/translate/rotate를 쌓는 경로를 검증한다.
    const { canvas } = await processImage(createTestCanvas(100, 100, '#0000ff'))
      .transform({ rotate: 45 })
      .box({ padding: 15, background: '#ffff00', radius: 4 })
      .toCanvas();

    // 프레임(141x141, 위치 15,15) 안쪽 모서리 — 회전으로 비워진 자리를 box 배경(노랑)이 채운다
    expect(pixelAt(canvas, 17, 17)).toEqual([255, 255, 0, 255]);
    // 프레임 중심(약 85,85) — 회전된 소스가 그대로 보인다(파랑)
    expect(pixelAt(canvas, 85, 85)).toEqual([0, 0, 255, 255]);
  });
});

// decisions.md의 "검증 기준" 중 최종 whole-branch 리뷰에서 미테스트로 지적됐던 항목들을 보강한다.
describe('box 체인 — background 조합(decisions.md 보강)', () => {
  it('resize(contain)의 letterbox 위에 box background가 그대로 비친다', async () => {
    // 200x100 소스를 100x100(contain)에 넣으면 가로가 기준이 돼 100x50으로 줄고
    // 세로 위아래 25px씩 letterbox가 생긴다. box는 padding 없이 background만 지정 —
    // 이 letterbox도 "바깥 상자 전체"에 속하므로 box.background가 채운다.
    const { canvas } = await processImage(createTestCanvas(200, 100, 'blue'))
      .resize({ fit: 'contain', width: 100, height: 100 })
      .box({ background: '#ffff00' })
      .toCanvas();

    expect(pixelAt(canvas, 50, 5)).toEqual([255, 255, 0, 255]); // 위쪽 letterbox — 노랑
    expect(pixelAt(canvas, 50, 50)).toEqual([0, 0, 255, 255]); // 이미지 영역 — 파랑
    expect(pixelAt(canvas, 50, 90)).toEqual([255, 255, 0, 255]); // 아래쪽 letterbox — 노랑
  });

  it('소스의 반투명 픽셀이 box background 위에서 합성된다', async () => {
    // 소스 전체를 반투명 파랑(rgba(0,0,255,0.5))으로 채운다 — 불투명 소스만 쓰던 기존 테스트들과 달리
    // drawImage가 실제로 알파 합성을 수행하는 경로(흰 배경 위에 반투명 소스)를 검증한다.
    const { canvas } = await processImage(createTestCanvas(100, 100, 'rgba(0,0,255,0.5)'))
      .box({ background: '#ffffff' })
      .toCanvas();

    const [r, g, b, a] = pixelAt(canvas, 50, 50);
    // 흰 배경(255,255,255) 위에 50% 파랑 소스 → (128, 128, 255) 근방, 완전 불투명
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
    expect(g).toBeGreaterThan(100);
    expect(g).toBeLessThan(160);
    expect(b).toBe(255);
    expect(a).toBe(255);
  });
});

describe('box 체인 — border 매트릭스(decisions.md 보강)', () => {
  it('outside border + padding 0 — border가 content 가장자리에 바로 붙는다', async () => {
    const { canvas, width, height } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ border: { width: 4, color: '#ff0000' } })
      .toCanvas();

    expect([width, height]).toEqual([108, 108]); // 100 + 4*2
    expect(pixelAt(canvas, 1, 54)).toEqual([255, 0, 0, 255]); // 바깥 가장자리 — border
    expect(pixelAt(canvas, 54, 54)).toEqual([0, 0, 255, 255]); // content — 파랑
  });

  it('inset border + padding > 0 — border가 padding 영역 안에 그려지고 content를 덮지 않는다', async () => {
    // padding(10) > border.width(6)라서 inset border 밴드(0~6px)가 padding 영역(0~10px) 안에서
    // 끝난다 — content(10px 이후)까지는 닿지 않는다. padding 0일 때(기존 테스트)는 content 위에
    // 겹쳤던 것과 대비된다.
    const { canvas, width, height } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ padding: 10, background: '#ffffff', border: { width: 6, color: '#ff0000', inset: true } })
      .toCanvas();

    expect([width, height]).toEqual([120, 120]); // inset border는 크기를 늘리지 않고 padding만 반영
    expect(pixelAt(canvas, 2, 60)).toEqual([255, 0, 0, 255]); // border 밴드
    expect(pixelAt(canvas, 8, 60)).toEqual([255, 255, 255, 255]); // border와 content 사이 — padding 배경(흰색)
    expect(pixelAt(canvas, 60, 60)).toEqual([0, 0, 255, 255]); // content — border 영향 없음
  });

  it('반투명 inset border는 그 아래 content와 합성된다', async () => {
    // padding 0이라 inset border 밴드가 content 위에 직접 겹친다(위 outside 테스트와 달리 border가
    // content보다 나중에 그려지므로 합성이 일어난다) — 반투명 색이 실제로 섞이는지 확인한다.
    const { canvas } = await processImage(createTestCanvas(100, 100, 'blue'))
      .box({ border: { width: 6, color: 'rgba(255,0,0,0.5)', inset: true } })
      .toCanvas();

    const [r, g, b, a] = pixelAt(canvas, 2, 50);
    // 파랑 content(0,0,255) 위에 50% 빨강 → (128, 0, 128) 근방, 완전 불투명
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
    expect(g).toBe(0);
    expect(b).toBeGreaterThan(100);
    expect(b).toBeLessThan(160);
    expect(a).toBe(255);
  });
});

describe('box 체인 — deprecated 경로 파리티(decisions.md 보강)', () => {
  it('resize({padding, background})와 box({padding, background})는 같은 픽셀 결과를 낸다', async () => {
    const legacy = await processImage(createTestCanvas(100, 80, 'blue'))
      .resize({ fit: 'cover', width: 50, height: 50, padding: 10, background: '#ffff00' })
      .toCanvas();
    const modern = await processImage(createTestCanvas(100, 80, 'blue'))
      .resize({ fit: 'cover', width: 50, height: 50 })
      .box({ padding: 10, background: '#ffff00' })
      .toCanvas();

    expect([legacy.width, legacy.height]).toEqual([70, 70]);
    expect([modern.width, modern.height]).toEqual([70, 70]);
    expect(pixelAt(legacy.canvas, 5, 5)).toEqual(pixelAt(modern.canvas, 5, 5)); // padding 영역 — 노랑
    expect(pixelAt(legacy.canvas, 35, 35)).toEqual(pixelAt(modern.canvas, 35, 35)); // content 중앙 — 파랑
  });
});
