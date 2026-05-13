import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';

/**
 * jsdom SVG 회귀 테스트다.
 *
 * 이 파일은 Canvas/Image mock 환경에서 SVG 입력이 처리 파이프라인을 통과하고
 * 결과 크기와 Blob metadata가 유지되는지 확인한다. 실제 픽셀 품질, 텍스트 선명도,
 * 그라디언트 렌더링은 `tests/browser/**`의 실제 브라우저 smoke test가 담당한다.
 */
describe('Node SVG mock 경로 회귀 테스트', () => {
  // 텍스트와 도형이 포함된 SVG fixture다.
  const complexSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="blue"/>
    <text x="50" y="55" text-anchor="middle" font-size="20" fill="white">Test</text>
  </svg>`;

  it('복합 SVG를 큰 크기로 리사이즈해 Blob metadata를 반환한다', async () => {
    const result = await processImage(complexSvg).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
    expect(result.blob.type).toMatch(/^image\/(png|webp)$/);
  });

  it('작은 SVG를 큰 크기로 확대해도 mock Blob을 생성한다', async () => {
    const smallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
      <rect x="10" y="10" width="30" height="30" fill="red"/>
    </svg>`;

    const result = await processImage(smallSvg).resize({ fit: 'cover', width: 2000, height: 2000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
  });

  it('텍스트 SVG 입력도 Node mock 경로에서 처리한다', async () => {
    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <text x="100" y="50" text-anchor="middle" font-size="30" fill="black">Hello World</text>
    </svg>`;

    const result = await processImage(textSvg).resize({ fit: 'cover', width: 800, height: 400 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(500);
  });

  it('그라디언트 SVG 입력도 Node mock 경로에서 처리한다', async () => {
    const gradientSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad1)" />
    </svg>`;

    const result = await processImage(gradientSvg).resize({ fit: 'cover', width: 500, height: 500 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(500);
  });

  it('여러 리사이즈 크기에서 Blob 생성 경로를 유지한다', async () => {
    const sizes = [
      [100, 100],
      [500, 500],
      [1000, 1000],
      [2000, 2000],
    ];

    for (const [width, height] of sizes) {
      const result = await processImage(complexSvg).resize({ fit: 'cover', width, height }).toBlob();

      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
    }
  });

  it('SVG Data URL 입력을 Node mock 경로에서 처리한다', async () => {
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(complexSvg)}`;
    const result = await processImage(dataUrl).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
  });
});
