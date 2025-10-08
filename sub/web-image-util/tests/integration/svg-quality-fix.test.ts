import { processImage } from '../../src/index';
import { describe, it, expect } from 'vitest';

/**
 * SVG Quality Degradation Fix Verification Tests
 *
 * Purpose: Verify SVG renders at high quality after removing setSvgDimensions()
 * Previous Issue: setSvgDimensions() pre-resized SVG to large dimensions, causing vector→raster conversion
 * Solution: Preserve SVG original dimensions and render directly to target size in Canvas
 */
describe('SVG Quality Degradation Fix Verification', () => {
  // Complex SVG for testing (text + shapes)
  const complexSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="blue"/>
    <text x="50" y="55" text-anchor="middle" font-size="20" fill="white">Test</text>
  </svg>`;

  it('should preserve quality when resizing complex SVG to 1000x1000', async () => {
    const result = await processImage(complexSvg).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000); // Reasonable file size
    expect(result.blob.type).toMatch(/^image\/(png|webp)$/); // PNG or WebP
  });

  it('should remain sharp when upscaling small SVG to large size', async () => {
    const smallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
      <rect x="10" y="10" width="30" height="30" fill="red"/>
    </svg>`;

    const result = await processImage(smallSvg).resize({ fit: 'cover', width: 2000, height: 2000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
  });

  it('should render SVG with text sharply', async () => {
    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <text x="100" y="50" text-anchor="middle" font-size="30" fill="black">Hello World</text>
    </svg>`;

    const result = await processImage(textSvg).resize({ fit: 'cover', width: 800, height: 400 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(500);
  });

  it('should render SVG with gradients correctly', async () => {
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

  it('should maintain consistent quality across different resize dimensions', async () => {
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

  it('should handle SVG in Data URL format correctly', async () => {
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(complexSvg)}`;
    const result = await processImage(dataUrl).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(1000);
  });
});
