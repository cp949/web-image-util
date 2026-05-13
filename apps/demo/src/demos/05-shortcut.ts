import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: 'Shortcut API',
  description: '자주 쓰는 리사이즈 패턴을 짧게 표현하는 .shortcut.* 메서드 모음.',
};

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/photo.jpg')).blob();

  // coverBox: 비율 유지하면서 박스를 가득 채움(잘림 허용).
  const cover = await processImage(sample).shortcut.coverBox(400, 400).toBlob();

  // containBox: 비율 유지하면서 박스 안에 전부 들어옴(여백 허용).
  const contain = await processImage(sample).shortcut.containBox(400, 400, { background: '#f0f0f0' }).toBlob();

  // maxWidth: 지정한 너비보다 클 때만 축소.
  const maxW = await processImage(sample).shortcut.maxWidth(200).toBlob();

  // scale: 비율로 줄이기/늘리기.
  const scaled = await processImage(sample).shortcut.scale(0.5).toBlob();

  target.append(
    card('.shortcut.coverBox(400, 400)', cover.blob),
    card('.shortcut.containBox(400, 400, { background })', contain.blob),
    card('.shortcut.maxWidth(200)', maxW.blob),
    card('.shortcut.scale(0.5)', scaled.blob)
  );
}

function card(label: string, blob: Blob): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-block;margin:0 16px 16px 0;vertical-align:top';
  const h = document.createElement('div');
  h.textContent = label;
  h.style.cssText = 'font-family:monospace;font-size:12px;margin-bottom:6px';
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.style.cssText = 'display:block;border:1px solid #e0e0e0';
  wrap.append(h, img);
  return wrap;
}
