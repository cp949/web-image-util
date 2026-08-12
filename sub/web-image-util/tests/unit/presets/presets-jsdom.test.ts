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
import { createTestCanvas } from '../../utils/canvas-helper';

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
