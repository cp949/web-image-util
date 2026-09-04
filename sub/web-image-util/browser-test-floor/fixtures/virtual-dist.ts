import { processImage } from '../../dist/index.js';

declare global {
  interface Window {
    __CHROME83_FLOOR_RESULT__?: {
      resizeWidth: number;
      resizeHeight: number;
      resizeBlobSize: number;
      svgFormat: string | undefined;
      svgBlobSize: number;
    };
    __CHROME83_FLOOR_ERROR__?: string;
  }
}

const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

async function run(): Promise<void> {
  const pngBlob = base64ToBlob(PNG_1X1_BASE64, 'image/png');
  const resizeResult = await processImage(pngBlob).resize({ fit: 'cover', width: 4, height: 4 }).toBlob();
  const svgResult = await processImage(SVG_SOURCE).toBlob();

  window.__CHROME83_FLOOR_RESULT__ = {
    resizeWidth: resizeResult.width,
    resizeHeight: resizeResult.height,
    resizeBlobSize: resizeResult.blob.size,
    svgFormat: svgResult.format,
    svgBlobSize: svgResult.blob.size,
  };
}

run().catch((error: unknown) => {
  window.__CHROME83_FLOOR_ERROR__ = error instanceof Error ? error.message : String(error);
});
