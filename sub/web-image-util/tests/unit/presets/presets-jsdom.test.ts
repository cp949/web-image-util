/**
 * 프리셋 API 검증 중 Canvas 입력만 사용해 jsdom에서 안전한 케이스를 모은다.
 *
 * 분리 기준:
 * - Blob 입력 흐름은 jsdom의 Blob URL 이미지 로딩 제약 때문에 이 파일에서 다루지 않는다.
 * - webp 포맷을 단정하는 케이스는 jsdom + canvas 패키지의 webp 미지원(PNG fallback) 때문에 빠진다.
 *   실제 브라우저 포맷 경로는 browser 스모크에서 검증한다.
 */

import { createCanvas as createNodeCanvas, loadImage } from 'canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAvatar, createSocialImage, createThumbnail } from '../../../src/presets';
import type { ImageProcessError } from '../../../src/types';
import { createTestCanvas } from '../../utils/canvas-helper';

/** 왼쪽 절반은 빨강, 오른쪽 절반은 파랑인 캔버스 — 가로 방향 gravity/focal-point 확인용 */
function createHorizontalSplitCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(width / 2, 0, width / 2, height);
  return canvas;
}

/**
 * 결과 Blob을 node-canvas로 직접 디코드해 픽셀을 검사한다.
 * ResultBlob.toCanvas()는 Blob URL 이미지 로딩을 요구해 jsdom에서 쓸 수 없다.
 */
async function decodeBlobPixels(blob: Blob, width: number, height: number) {
  const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
  const canvas = createNodeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return ctx;
}

describe('프리셋 이미지 생성 (Canvas 입력, jsdom-safe)', () => {
  it('객체 size 썸네일은 height 생략 시 width를 높이로 사용한다', async () => {
    const source = createTestCanvas(400, 300, 'blue');

    const result = await createThumbnail(source, {
      size: { width: 128 },
      format: 'png',
      fit: 'contain',
      background: 'transparent',
    });

    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });

  it('아바타는 기본값으로 64px 정사각형 PNG를 만든다', async () => {
    const source = createTestCanvas(320, 240, 'green');

    const result = await createAvatar(source);

    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });

  it('아바타는 fit 옵션을 반영한다 — contain이면 소스 비율이 유지되어 여백이 투명하다', async () => {
    // 2:1 가로형 소스를 64x64 contain으로 줄이면 상하 여백(letterbox)이 생긴다.
    // cover가 적용되면 소스가 정사각형을 꽉 채워 여백 없이 전부 불투명해진다.
    const source = createTestCanvas(400, 200, 'red');

    const result = await createAvatar(source, { size: 64, fit: 'contain', background: 'transparent' });

    const ctx = await decodeBlobPixels(result.blob, 64, 64);
    // 상단 모서리: contain이면 투명 배경
    expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(0);
    // 중앙: 소스 이미지 픽셀(불투명 red)
    const center = ctx.getImageData(32, 32, 1, 1).data;
    expect(center[3]).toBe(255);
    expect(center[0]).toBeGreaterThan(200);
  });

  it('소셜 이미지는 customSize가 있으면 플랫폼 기본 크기보다 우선한다', async () => {
    const source = createTestCanvas(640, 480, 'orange');

    const result = await createSocialImage(source, {
      platform: 'instagram',
      customSize: { width: 320, height: 180 },
      format: 'png',
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(180);
    expect(result.blob.type).toBe('image/png');
    expect(result.format).toBe('png');
  });

  it('소셜 이미지는 customSize가 없으면 플랫폼 기본 크기를 적용한다', async () => {
    const source = createTestCanvas(800, 600, 'purple');

    // instagram 기본 크기 1080x1080 (정사각형)
    const result = await createSocialImage(source, {
      platform: 'instagram',
      format: 'png',
    });

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
    expect(result.format).toBe('png');
  });

  it('썸네일은 webp 미지원 환경에서 jpeg 포맷으로 폴백한다', async () => {
    const source = createTestCanvas(200, 200, 'red');
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    // getOptimalFormat은 1x1 캔버스에 image/webp로 toBlob을 시도한다.
    // webp만 null로 만들어 fallback(jpeg) 경로를 강제한다. 실제 출력(jpeg)은 원본 동작을 유지한다.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      quality?: number
    ) {
      if (type === 'image/webp') {
        callback(null);
        return;
      }
      return originalToBlob.call(this, callback, type, quality);
    });

    // format 옵션을 주지 않으면 getOptimalFormat 결과(jpeg)가 사용된다.
    const result = await createThumbnail(source, { size: 64 });

    expect(result.format).toBe('jpeg');
    expect(result.blob.type).toBe('image/jpeg');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe('프리셋 position(gravity/focal-point) 연동', () => {
  it('createThumbnail은 gravity 문자열을 cover crop에 반영한다', async () => {
    const source = createHorizontalSplitCanvas(200, 100);

    const topLeft = await createThumbnail(source, { size: 100, fit: 'cover', position: 'top-left', format: 'png' });
    const topLeftCtx = await decodeBlobPixels(topLeft.blob, 100, 100);
    expect([...topLeftCtx.getImageData(90, 50, 1, 1).data]).toEqual([255, 0, 0, 255]);

    const topRight = await createThumbnail(source, {
      size: 100,
      fit: 'cover',
      position: 'top-right',
      format: 'png',
    });
    const topRightCtx = await decodeBlobPixels(topRight.blob, 100, 100);
    expect([...topRightCtx.getImageData(10, 50, 1, 1).data]).toEqual([0, 0, 255, 255]);
  });

  it('createThumbnail은 focal-point 객체를 cover crop에 반영한다', async () => {
    const source = createHorizontalSplitCanvas(200, 100);

    const result = await createThumbnail(source, {
      size: 100,
      fit: 'cover',
      position: { x: 0.9, y: 0.5 },
      format: 'png',
    });

    const ctx = await decodeBlobPixels(result.blob, 100, 100);
    // focal-point x=0.9는 크롭 창을 오른쪽 끝(파랑)으로 완전히 밀어붙인다.
    // position 생략 시(중앙 정렬) x=10은 원본 왼쪽(빨강)이 보이므로, 이 지점이 반영 여부를 가른다.
    expect([...ctx.getImageData(10, 50, 1, 1).data]).toEqual([0, 0, 255, 255]);
    expect([...ctx.getImageData(90, 50, 1, 1).data]).toEqual([0, 0, 255, 255]);
  });

  it('createThumbnail은 contain + focal-point 객체를 OPTION_INVALID로 거부한다', async () => {
    const source = createHorizontalSplitCanvas(200, 100);

    await expect(
      createThumbnail(source, { size: 50, fit: 'contain', position: { x: 0.5, y: 0.5 } })
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' } satisfies Partial<ImageProcessError>);
  });

  it('createAvatar는 gravity 문자열을 cover crop에 반영한다', async () => {
    const source = createHorizontalSplitCanvas(200, 100);

    const topLeft = await createAvatar(source, {
      size: 100,
      fit: 'cover',
      position: 'top-left',
      background: 'transparent',
      format: 'png',
    });
    const ctx = await decodeBlobPixels(topLeft.blob, 100, 100);
    expect([...ctx.getImageData(90, 50, 1, 1).data]).toEqual([255, 0, 0, 255]);
  });

  it("createAvatar는 fit:'fill'과 position을 함께 쓰면 OPTION_INVALID다", async () => {
    const source = createHorizontalSplitCanvas(200, 100);

    await expect(createAvatar(source, { size: 100, fit: 'fill', position: 'top-left' })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    } satisfies Partial<ImageProcessError>);
  });
});

describe('프리셋 radius(box 원형 마스크) 연동', () => {
  it('createAvatar는 radius로 모서리를 투명하게 자른다', async () => {
    const source = createTestCanvas(200, 200, 'green');

    const result = await createAvatar(source, { size: 100, radius: '50%' });

    const ctx = await decodeBlobPixels(result.blob, 100, 100);
    // 원형 마스크 밖(모서리)은 투명
    expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(0);
    // 원 안쪽(중앙)은 불투명 소스 색
    expect(ctx.getImageData(50, 50, 1, 1).data[3]).toBe(255);
  });

  it('radius를 생략하면 사각형 모서리가 그대로 불투명하게 남는다', async () => {
    const source = createTestCanvas(200, 200, 'green');

    const result = await createAvatar(source, { size: 100 });

    const ctx = await decodeBlobPixels(result.blob, 100, 100);
    expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(255);
  });

  it("createAvatar는 format:'webp' + radius 조합에서도 라운드 클리핑을 적용한다", async () => {
    const source = createTestCanvas(200, 200, 'green');

    const result = await createAvatar(source, { size: 100, radius: '50%', format: 'webp' });

    const ctx = await decodeBlobPixels(result.blob, 100, 100);
    expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(0);
  });
});
