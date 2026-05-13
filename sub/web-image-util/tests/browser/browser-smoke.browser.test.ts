import { describe, expect, it } from 'vitest';
import { processImage } from '../../src';
import { mimeTypeToOutputFormat } from '../../src/utils/format-utils';

function createFixtureCanvas(width = 64, height = 48): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas context is unavailable');
  }

  context.fillStyle = '#f43f5e';
  context.fillRect(0, 0, width / 2, height);
  context.fillStyle = '#22c55e';
  context.fillRect(width / 2, 0, width / 2, height);
  context.fillStyle = '#2563eb';
  context.fillRect(0, height / 2, width, height / 2);

  return canvas;
}

function expectBlobMetadataMatchesActualMime(result: { blob: Blob; format?: string }): void {
  const actualFormat = mimeTypeToOutputFormat(result.blob.type);

  expect(actualFormat).toBeDefined();
  expect(result.format).toBe(actualFormat);
}

function expectPixelColor(
  pixel: Uint8ClampedArray | undefined,
  expected: { red: number; green: number; blue: number }
): void {
  expect(pixel).toBeDefined();
  expect(pixel?.[0]).toBe(expected.red);
  expect(pixel?.[1]).toBe(expected.green);
  expect(pixel?.[2]).toBe(expected.blue);
  expect(pixel?.[3]).toBe(255);
}

async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(`Canvas failed to create ${type} Blob`));
      }
    }, type);
  });
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const fixture = await blobToImageFixture(blob);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = fixture.image.naturalWidth;
    canvas.height = fixture.image.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas context is unavailable');
    }

    context.drawImage(fixture.image, 0, 0);

    return canvas;
  } finally {
    fixture.cleanup();
  }
}

async function expectFixtureColorSamples(
  blob: Blob,
  samples: { red: [number, number]; green: [number, number]; blue: [number, number] }
): Promise<void> {
  const canvas = await blobToCanvas(blob);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas context is unavailable');
  }

  const [redX, redY] = samples.red;
  const [greenX, greenY] = samples.green;
  const [blueX, blueY] = samples.blue;
  const redPixel = context.getImageData(redX, redY, 1, 1).data;
  const greenPixel = context.getImageData(greenX, greenY, 1, 1).data;
  const bluePixel = context.getImageData(blueX, blueY, 1, 1).data;

  expectPixelColor(redPixel, { red: 244, green: 63, blue: 94 });
  expectPixelColor(greenPixel, { red: 34, green: 197, blue: 94 });
  expectPixelColor(bluePixel, { red: 37, green: 99, blue: 235 });
}

function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

async function blobToImageFixture(blob: Blob): Promise<{ image: HTMLImageElement; cleanup: () => void }> {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image element failed to load fixture Blob'));
    };
    image.src = objectUrl;
  });

  return {
    image,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

describe('브라우저 스모크 테스트', () => {
  it('실제 Canvas 입력을 PNG Blob으로 리사이즈한다', async () => {
    const result = await processImage(createFixtureCanvas())
      .resize({ fit: 'fill', width: 32, height: 24 })
      .toBlob({ format: 'png' });

    expect(result.width).toBe(32);
    expect(result.height).toBe(24);
    expect(result.blob.type).toBe('image/png');
    expectBlobMetadataMatchesActualMime(result);
    expect(result.blob.size).toBeGreaterThan(0);
    await expectFixtureColorSamples(result.blob, { red: [8, 6], green: [24, 6], blue: [16, 18] });
  });

  it('실제 브라우저 Canvas 출력 MIME을 PNG/JPEG/WebP 포맷별로 확인한다', async () => {
    const cases = [
      { format: 'png' as const, mimeType: 'image/png' },
      { format: 'jpeg' as const, mimeType: 'image/jpeg' },
      { format: 'webp' as const, mimeType: 'image/webp' },
    ];

    for (const testCase of cases) {
      const result = await processImage(createFixtureCanvas())
        .resize({ fit: 'fill', width: 24, height: 18 })
        .toBlob({ format: testCase.format });

      expect(result.blob.type).toBe(testCase.mimeType);
      expect(result.format).toBe(testCase.format);
      expectBlobMetadataMatchesActualMime(result);
      expect(result.blob.size).toBeGreaterThan(0);
    }
  });

  it('Data URL 입력을 실제 브라우저 Image 경로로 처리한다', async () => {
    const dataURL = await canvasToDataURL(createFixtureCanvas());

    const result = await processImage(dataURL)
      .resize({ fit: 'contain', width: 40, height: 30 })
      .toBlob({ format: 'png' });

    expect(result.width).toBe(40);
    expect(result.height).toBe(30);
    expect(result.blob.type).toBe('image/png');
    expectBlobMetadataMatchesActualMime(result);
    await expectFixtureColorSamples(result.blob, { red: [10, 7], green: [30, 7], blue: [20, 22] });
  });

  it('Blob 입력을 실제 브라우저 Image 경로로 처리한다', async () => {
    const sourceBlob = await canvasToBlob(createFixtureCanvas());

    const result = await processImage(sourceBlob)
      .resize({ fit: 'cover', width: 20, height: 20 })
      .toBlob({ format: 'png' });

    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    expect(result.blob.type).toBe('image/png');
    expectBlobMetadataMatchesActualMime(result);
    await expectFixtureColorSamples(result.blob, { red: [5, 5], green: [15, 5], blue: [10, 15] });
  });

  it('HTMLImageElement 입력을 실제 브라우저에서 처리한다', async () => {
    const sourceBlob = await canvasToBlob(createFixtureCanvas());
    const fixture = await blobToImageFixture(sourceBlob);

    try {
      const result = await processImage(fixture.image)
        .resize({ fit: 'maxFit', width: 32, height: 32 })
        .toBlob({ format: 'png' });

      expect(result.width).toBe(32);
      expect(result.height).toBe(24);
      expect(result.originalSize).toEqual({ width: 64, height: 48 });
      expect(result.blob.type).toBe('image/png');
      expectBlobMetadataMatchesActualMime(result);
      await expectFixtureColorSamples(result.blob, { red: [8, 6], green: [24, 6], blue: [16, 18] });
    } finally {
      fixture.cleanup();
    }
  });

  it('SVG 문자열 입력을 실제 브라우저에서 렌더링한다', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40">
        <rect width="80" height="40" fill="#ffffff"/>
        <circle cx="20" cy="20" r="14" fill="#ef4444"/>
        <rect x="42" y="8" width="26" height="24" fill="#22c55e"/>
      </svg>
    `;

    const result = await processImage(svg).resize({ fit: 'fill', width: 40, height: 20 }).toCanvas();
    const context = result.canvas.getContext('2d');
    expect(context).not.toBeNull();

    const leftPixel = context?.getImageData(10, 10, 1, 1).data;
    const rightPixel = context?.getImageData(28, 10, 1, 1).data;

    expect(result.width).toBe(40);
    expect(result.height).toBe(20);
    expect(leftPixel?.[0]).toBeGreaterThan(leftPixel?.[1] ?? 255);
    expect(leftPixel?.[0]).toBeGreaterThan(leftPixel?.[2] ?? 255);
    expect(rightPixel?.[1]).toBeGreaterThan(rightPixel?.[0] ?? 255);
    expect(rightPixel?.[1]).toBeGreaterThan(rightPixel?.[2] ?? 255);
  });

  it('SVG Data URL 입력을 실제 브라우저에서 렌더링한다', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40">
        <rect width="80" height="40" fill="#ffffff"/>
        <rect x="0" y="0" width="40" height="40" fill="#f97316"/>
        <rect x="40" y="0" width="40" height="40" fill="#0ea5e9"/>
      </svg>
    `;
    const dataURL = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    const result = await processImage(dataURL).resize({ fit: 'fill', width: 40, height: 20 }).toCanvas();
    const context = result.canvas.getContext('2d');
    expect(context).not.toBeNull();

    const leftPixel = context?.getImageData(10, 10, 1, 1).data;
    const rightPixel = context?.getImageData(30, 10, 1, 1).data;

    expect(result.width).toBe(40);
    expect(result.height).toBe(20);
    expect(leftPixel?.[0]).toBeGreaterThan(leftPixel?.[2] ?? 255);
    expect(leftPixel?.[1]).toBeGreaterThan(leftPixel?.[2] ?? 255);
    expect(rightPixel?.[2]).toBeGreaterThan(rightPixel?.[0] ?? 255);
    expect(rightPixel?.[2]).toBeGreaterThan(rightPixel?.[1] ?? 255);
  });

  it('브라우저 출력 MIME과 결과 format metadata를 일치시킨다', async () => {
    const result = await processImage(createFixtureCanvas())
      .resize({ fit: 'fill', width: 16, height: 16 })
      .toBlob({ format: 'avif', fallbackFormat: 'png' });

    expect(['image/avif', 'image/png']).toContain(result.blob.type);
    expectBlobMetadataMatchesActualMime(result);
  });
});

describe('브라우저 성능 스모크 테스트', () => {
  it('대표 리사이즈가 브라우저 예산 안에 끝난다', async () => {
    const source = createFixtureCanvas(800, 600);
    const startTime = performance.now();

    const result = await processImage(source).resize({ fit: 'contain', width: 200, height: 150 }).toBlob();

    expect(performance.now() - startTime).toBeLessThan(1000);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('리사이즈와 blur 체인이 브라우저 예산 안에 끝난다', async () => {
    const source = createFixtureCanvas(640, 480);
    const startTime = performance.now();

    const result = await processImage(source).resize({ fit: 'cover', width: 320, height: 240 }).blur(3).toBlob();

    expect(performance.now() - startTime).toBeLessThan(1500);
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('작은 병렬 배치가 브라우저 예산 안에 끝난다', async () => {
    const source = createFixtureCanvas(400, 300);
    const startTime = performance.now();
    const jobs = Array.from({ length: 6 }, () =>
      processImage(source).resize({ fit: 'cover', width: 160, height: 120 }).toBlob()
    );

    const results = await Promise.all(jobs);

    expect(performance.now() - startTime).toBeLessThan(3000);
    expect(results).toHaveLength(6);
    for (const result of results) {
      expect(result.width).toBe(160);
      expect(result.height).toBe(120);
      expect(result.blob.size).toBeGreaterThan(0);
    }
  });
});
