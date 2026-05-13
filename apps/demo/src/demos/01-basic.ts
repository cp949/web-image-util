import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '빠른 시작',
  description: '체이닝 한 줄로 리사이즈와 포맷 변환을 동시에 처리한다.',
};

export async function run(target: HTMLElement): Promise<void> {
  // 1) 입력 준비 — 어떤 입력 타입이든 받는다 (Blob, URL, File, HTMLImageElement, SVG 문자열, ...).
  const sample = await (await fetch('/samples/photo.jpg')).blob();

  // 2) 라이브러리 사용 — 이게 전부.
  const result = await processImage(sample)
    .resize({ fit: 'cover', width: 300, height: 200 })
    .toBlob({ format: 'webp', quality: 0.9 });

  // 3) 결과 표시.
  const img = new Image();
  img.src = URL.createObjectURL(result.blob);
  img.alt = '결과';
  target.append(img);
}
