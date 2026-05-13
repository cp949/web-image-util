import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '체이닝 + Blur',
  description:
    '체이닝 메서드(resize, blur, ...)는 즉시 그리지 않고 누적되며, ' +
    'toBlob() 등 출력 메서드에서 단 1회만 Canvas로 렌더링된다. ' +
    'resize()는 한 체인에서 한 번만 호출 가능하며 TypeScript 타입이 컴파일 타임에 강제한다.',
};

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/photo.jpg')).blob();

  // 체이닝 — Canvas는 toBlob() 호출 시 1회만 그려진다.
  const blurred = await processImage(sample)
    .resize({ fit: 'cover', width: 600, height: 400 })
    .blur(3)
    .toBlob({ format: 'jpeg', quality: 0.85 });

  // 비교용 원본 리사이즈본.
  const original = await processImage(sample)
    .resize({ fit: 'cover', width: 600, height: 400 })
    .toBlob({ format: 'jpeg', quality: 0.85 });

  target.append(card('Before (resize만)', original.blob), card('After (resize + blur(3))', blurred.blob));
}

function card(label: string, blob: Blob): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:16px';
  const h = document.createElement('div');
  h.textContent = label;
  h.style.cssText = 'font-weight:600;margin-bottom:6px';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = 'display:block;max-width:100%;border:1px solid #e0e0e0';
  wrap.append(h, img);
  return wrap;
}
