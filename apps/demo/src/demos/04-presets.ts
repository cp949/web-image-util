import { createAvatar, createThumbnail } from '@cp949/web-image-util/presets';

export const meta = {
  title: 'Presets',
  description: '자주 쓰는 패턴은 프리셋 함수 한 줄로 끝난다. presets 서브패스에서 import.',
};

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/photo.jpg')).blob();

  // 한 줄로 아바타 (정사각형, PNG, 고품질)
  const avatar = await createAvatar(sample, { size: 128 });

  // 한 줄로 썸네일 (WebP, cover fit, 품질 0.8)
  const thumb = await createThumbnail(sample, { size: { width: 300, height: 200 } });

  target.append(
    card('createAvatar(source, { size: 128 })', avatar.blob),
    card('createThumbnail(source, { size: { width: 300, height: 200 } })', thumb.blob)
  );
}

function card(label: string, blob: Blob): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-block;margin-right:24px;vertical-align:top';
  const h = document.createElement('div');
  h.textContent = label;
  h.style.cssText = 'font-family:monospace;font-size:12px;margin-bottom:6px';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = 'display:block;border:1px solid #e0e0e0';
  wrap.append(h, img);
  return wrap;
}
