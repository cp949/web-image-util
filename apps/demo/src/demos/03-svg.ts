import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: 'SVG 처리',
  description:
    'SVG 파일·인라인 SVG 문자열을 어떤 크기로 렌더링해도 픽셀이 깨지지 않는다. ' +
    'Canvas raster 라이브러리와의 가장 큰 차별점이다.',
};

// 인라인 SVG도 입력으로 그대로 받는다.
const inlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="44" fill="#1976d2"/>
  <text x="50" y="62" text-anchor="middle" fill="white" font-size="44" font-family="sans-serif">A</text>
</svg>`;

export async function run(target: HTMLElement): Promise<void> {
  // 1) 91x114 작은 SVG 파일을 1200x1200 PNG로 확대 — 픽셀 깨짐 없음.
  const upscaled = await processImage('/samples/svg-icon-small.svg')
    .resize({ fit: 'contain', width: 1200, height: 1200, background: '#ffffff' })
    .toBlob({ format: 'png' });

  // 2) 인라인 SVG 문자열을 그대로 입력.
  const inlinePng = await processImage(inlineSvg)
    .resize({ fit: 'cover', width: 400, height: 400 })
    .toBlob({ format: 'png' });

  target.append(
    section('1) 작은 SVG 파일 → 1200×1200 PNG 확대', upscaled.blob, 360),
    section('2) 인라인 SVG 문자열 → 400×400 PNG', inlinePng.blob, 400)
  );
}

function section(title: string, blob: Blob, displayWidth: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:20px';
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-weight:600;margin-bottom:8px';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = `display:block;width:${displayWidth}px;border:1px solid #e0e0e0`;
  wrap.append(h, img);
  return wrap;
}
