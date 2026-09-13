import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '15. Transform (crop / flip / rotate)',
  description:
    'transform()은 crop·flip·rotate를 한 번에 지정한다. 한 체인에서 한 번만, resize() 앞에서만 호출 가능하며 ' +
    '연산 순서는 호출 순서와 무관하게 crop → flip → rotate → resize로 고정된다. 최종 렌더는 여전히 drawImage() 1회다.',
};

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/landscape.jpg')).blob();

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px';
  target.append(grid);

  // 원본 — 비교 기준.
  const original = await processImage(sample).resize({ fit: 'contain', width: 320, height: 240 }).toBlob();
  grid.append(makeCard('원본 (resize만)', original.blob));

  // crop — 원본 픽셀 좌표 기준으로 특정 영역만 잘라낸다.
  const cropped = await processImage(sample)
    .transform({ crop: { x: 600, y: 200, width: 1200, height: 900 } })
    .resize({ fit: 'contain', width: 320, height: 240 })
    .toBlob();
  grid.append(makeCard('transform({ crop: { x:600, y:200, w:1200, h:900 } })', cropped.blob));

  // flip + rotate 90 — 90도 배수는 프레임 크기가 정확히 교환된다.
  const flipRotated = await processImage(sample)
    .transform({ flip: { horizontal: true }, rotate: 90 })
    .resize({ fit: 'contain', width: 320, height: 240 })
    .toBlob();
  grid.append(makeCard('transform({ flip: { horizontal: true }, rotate: 90 })', flipRotated.blob));

  // rotate 15도 + expand:true — 프레임이 커지고 네 모서리가 투명해진다. box()로 배경을 채운다.
  const rotatedExpanded = await processImage(sample)
    .transform({ rotate: { degrees: 15, expand: true } })
    .resize({ fit: 'contain', width: 320, height: 240 })
    .box({ background: '#fff' })
    .toBlob();
  grid.append(
    makeCard('transform({ rotate: { degrees: 15, expand: true } }) + box({ background })', rotatedExpanded.blob)
  );
}

function makeCard(label: string, blob: Blob): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #e0e0e0;border-radius:4px;padding:8px';
  const title = document.createElement('div');
  title.textContent = label;
  title.style.cssText = 'font-family:monospace;font-size:12px;margin-bottom:6px;word-break:break-all';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = 'display:block;background:#fafafa;max-width:100%';
  card.append(title, img);
  return card;
}
