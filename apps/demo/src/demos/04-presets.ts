import { createAvatar, createThumbnail } from '@cp949/web-image-util/presets';

export const meta = {
  title: 'Presets',
  description: '자주 쓰는 패턴은 프리셋 함수 한 줄로 끝난다. presets 서브패스에서 import.',
};

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/landscape.jpg')).blob();

  // 한 줄로 아바타 (정사각형, PNG, 고품질)
  const avatar = await createAvatar(sample, { size: 128 });

  // radius: '50%' — avatar는 항상 정사각형이라 완전한 원이 된다. box()를 따로 호출하지 않는다.
  const roundAvatar = await createAvatar(sample, { size: 128, radius: '50%' });

  // 한 줄로 썸네일 (WebP, cover fit, 품질 0.8)
  const thumb = await createThumbnail(sample, { size: { width: 300, height: 200 } });

  // position — resize()의 position과 같은 타입을 그대로 받는다. 중앙 대신 위쪽을 남긴다.
  const thumbTop = await createThumbnail(sample, { size: { width: 300, height: 200 }, position: 'top-center' });

  target.append(
    card('createAvatar(source, { size: 128 })', avatar.blob),
    card("createAvatar(source, { size: 128, radius: '50%' })", roundAvatar.blob),
    card('createThumbnail(source, { size: { width: 300, height: 200 } })', thumb.blob),
    card("createThumbnail(source, { size: {...}, position: 'top-center' })", thumbTop.blob)
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
