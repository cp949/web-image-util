import { processImage, type ResizeFit } from '@cp949/web-image-util';

export const meta = {
  title: 'Fit 모드 비교',
  description: '같은 입력·같은 목표 크기로 5개 fit 모드를 시각적으로 비교한다.',
};

const FITS: ResizeFit[] = ['cover', 'contain', 'fill', 'maxFit', 'minFit'];
const TARGET = { width: 300, height: 200 };

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/landscape.jpg')).blob();

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px';
  target.append(grid);

  for (const fit of FITS) {
    const result = await processImage(sample)
      .resize({ fit, ...TARGET, background: '#f0f0f0' })
      .toBlob();
    grid.append(makeCard(fit, result.blob));
  }
}

function makeCard(label: string, blob: Blob): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #e0e0e0;border-radius:4px;padding:8px';
  const title = document.createElement('div');
  title.textContent = `fit: ${label}`;
  title.style.cssText = 'font-family:monospace;font-size:13px;margin-bottom:6px';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = 'display:block;background:#fafafa';
  card.append(title, img);
  return card;
}
