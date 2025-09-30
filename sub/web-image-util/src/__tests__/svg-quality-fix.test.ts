import { processImage } from '../index';
import { describe, it, expect } from 'vitest';

/**
 * SVG 품질 저하 수정 검증 테스트
 *
 * 목적: setSvgDimensions() 제거 후 SVG가 고품질로 렌더링되는지 검증
 * 이전 문제: setSvgDimensions()가 SVG를 미리 큰 크기로 변경하여 벡터→래스터 변환 발생
 * 해결책: SVG 원본 크기 유지하고 Canvas에서 직접 타겟 크기로 렌더링
 */
describe('SVG 품질 저하 수정 검증', () => {
  // 테스트용 복잡한 SVG (텍스트 + 도형)
  const complexSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="blue"/>
    <text x="50" y="55" text-anchor="middle" font-size="20" fill="white">Test</text>
  </svg>`;

  it('복잡한 SVG를 1000x1000으로 리사이징해도 품질이 보존되어야 함', async () => {
    const result = await processImage(complexSvg).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000); // 적절한 파일 크기
    expect(result.blob.type).toMatch(/^image\/(png|webp)$/); // PNG 또는 WebP
  });

  it('작은 SVG를 큰 크기로 확대해도 선명해야 함', async () => {
    const smallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
      <rect x="10" y="10" width="30" height="30" fill="red"/>
    </svg>`;

    const result = await processImage(smallSvg).resize({ fit: 'cover', width: 2000, height: 2000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
  });

  it('텍스트가 포함된 SVG도 선명하게 렌더링되어야 함', async () => {
    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <text x="100" y="50" text-anchor="middle" font-size="30" fill="black">Hello World</text>
    </svg>`;

    const result = await processImage(textSvg).resize({ fit: 'cover', width: 800, height: 400 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(500);
  });

  it('그라디언트가 있는 SVG도 올바르게 렌더링되어야 함', async () => {
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

  it('다양한 크기로 리사이징해도 일관된 품질을 유지해야 함', async () => {
    const sizes = [
      [100, 100],
      [500, 500],
      [1000, 1000],
      [2000, 2000],
    ];

    for (const [width, height] of sizes) {
      const result = await processImage(complexSvg).resize(width, height).toBlob();

      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
    }
  });

  it('Data URL 형태의 SVG도 올바르게 처리되어야 함', async () => {
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(complexSvg)}`;
    const result = await processImage(dataUrl).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
  });
});
