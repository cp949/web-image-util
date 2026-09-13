import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '16. 배치 (position)',
  description:
    'resize()의 cover/contain은 기본적으로 중앙 정렬이다. position으로 9방향 gravity 또는(cover만) ' +
    '0~1 정규화 focal-point를 지정해 어느 영역을 남길지 바꿀 수 있다.',
};

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/landscape.jpg')).blob();
  const TARGET = { width: 260, height: 260 };

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px';
  target.append(grid);

  const cases: Array<{ label: string; run: () => Promise<Blob> }> = [
    {
      label: 'cover, position 생략 (기본 중앙 정렬)',
      run: async () =>
        (
          await processImage(sample)
            .resize({ fit: 'cover', ...TARGET })
            .toBlob()
        ).blob,
    },
    {
      label: "cover, position: 'top-center'",
      run: async () =>
        (
          await processImage(sample)
            .resize({ fit: 'cover', ...TARGET, position: 'top-center' })
            .toBlob()
        ).blob,
    },
    {
      label: 'cover, position: { x: 0.15, y: 0.5 } (focal-point)',
      run: async () =>
        (
          await processImage(sample)
            .resize({ fit: 'cover', ...TARGET, position: { x: 0.15, y: 0.5 } })
            .toBlob()
        ).blob,
    },
    {
      label: "contain, position: 'bottom-right' + box(background)",
      run: async () =>
        (
          await processImage(sample)
            .resize({ fit: 'contain', ...TARGET, position: 'bottom-right' })
            .box({ background: '#f0f0f0' })
            .toBlob()
        ).blob,
    },
  ];

  for (const c of cases) {
    grid.append(makeCard(c.label, await c.run()));
  }
}

function makeCard(label: string, blob: Blob): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #e0e0e0;border-radius:4px;padding:8px';
  const title = document.createElement('div');
  title.textContent = label;
  title.style.cssText = 'font-family:monospace;font-size:12px;margin-bottom:6px;word-break:break-all';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = 'display:block;background:#fafafa';
  card.append(title, img);
  return card;
}
