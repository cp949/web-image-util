import { ImageProcessError, processImage } from '@cp949/web-image-util';

export const meta = {
  title: '17. 픽셀 예산 (maxInputPixels / maxOutputPixels)',
  description:
    'maxInputPixels/maxOutputPixels(opt-in, 기본 무제한)로 디코드된 입력 픽셀 수와 최종 출력 canvas 픽셀 수에 ' +
    '상한을 걸 수 있다. 초과하면 PIXEL_BUDGET_EXCEEDED로 거부되며 details.direction(input/output)과 ' +
    'details.stage(입력만, header/decoded)로 원인을 구분할 수 있다.',
};

export async function run(target: HTMLElement): Promise<void> {
  // landscape.jpg는 2560x1600 = 약 410만 픽셀.
  const sample = await (await fetch('/samples/landscape.jpg')).blob();

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px';
  target.append(grid);

  // 성공 케이스 — 입력·출력 모두 한도 이내.
  grid.append(
    await buildCard('정상 통과', 'maxInputPixels: 10_000_000, maxOutputPixels: 1_000_000, resize 260x260', async () => {
      const result = await processImage(sample, { maxInputPixels: 10_000_000, maxOutputPixels: 1_000_000 })
        .resize({ fit: 'cover', width: 260, height: 260 })
        .toBlob();
      return `성공 — Blob ${result.blob.size.toLocaleString()} bytes`;
    })
  );

  // 실패 케이스 — 출력 픽셀 수 초과. 입력은 통과하고 최종 layout 계산 이후 거부된다.
  grid.append(
    await buildCard('출력 픽셀 예산 초과', 'maxOutputPixels: 1_000_000, resize 2000x2000(=4,000,000)', async () => {
      await processImage(sample, { maxOutputPixels: 1_000_000 })
        .resize({ fit: 'cover', width: 2000, height: 2000 })
        .toBlob();
      return '(예상과 달리 성공함)';
    })
  );

  // 실패 케이스 — 입력 픽셀 수 초과. JPEG는 헤더 사전검사 대상이 아니라 디코드 직후(stage: 'decoded')에 거부된다.
  grid.append(
    await buildCard('입력 픽셀 예산 초과', 'maxInputPixels: 1_000_000 (실제 입력은 약 4,096,000)', async () => {
      await processImage(sample, { maxInputPixels: 1_000_000 })
        .resize({ fit: 'cover', width: 260, height: 260 })
        .toBlob();
      return '(예상과 달리 성공함)';
    })
  );
}

async function buildCard(label: string, call: string, task: () => Promise<string>): Promise<HTMLElement> {
  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #e0e0e0;border-radius:8px;padding:12px;background:#fff';

  const title = document.createElement('div');
  title.textContent = label;
  title.style.cssText = 'font-weight:600;margin-bottom:4px';

  const callLine = document.createElement('div');
  callLine.textContent = call;
  callLine.style.cssText = 'font-family:monospace;font-size:12px;color:#555;margin-bottom:8px';

  const result = document.createElement('pre');
  result.style.cssText = 'margin:0;font-size:12px;white-space:pre-wrap;word-break:break-all';

  try {
    const message = await task();
    result.textContent = message;
    result.style.color = '#0a6b2c';
  } catch (error) {
    if (error instanceof ImageProcessError && error.code === 'PIXEL_BUDGET_EXCEEDED') {
      const d = error.details as { direction?: string; actualPixels?: number; maxPixels?: number; stage?: string };
      result.textContent =
        `code: ${error.code}\n` +
        `details.direction: ${d.direction}\n` +
        `details.stage: ${d.stage ?? '(output에는 없음)'}\n` +
        `details.actualPixels: ${d.actualPixels?.toLocaleString()}\n` +
        `details.maxPixels: ${d.maxPixels?.toLocaleString()}`;
    } else {
      result.textContent = `예상치 못한 에러: ${String(error)}`;
    }
    result.style.color = '#b00';
  }

  card.append(title, callLine, result);
  return card;
}
