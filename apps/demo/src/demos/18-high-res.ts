import { HighResolutionProcessor } from '@cp949/web-image-util/advanced';

export const meta = {
  title: '18. HighResolutionProcessor (advanced)',
  description:
    '메인 processImage().resize() 체인은 항상 단일 drawImage()로 렌더링한다. 큰 축소 배율이나 대용량 이미지에서 ' +
    '타일 분할·단계적 축소 전략이 필요하면 /advanced의 HighResolutionProcessor를 명시적으로 써야 한다 — opt-in 표면이며 ' +
    '메인 체인은 이를 호출하지 않는다.',
};

const TARGET = { width: 400, height: 250 };

export async function run(target: HTMLElement): Promise<void> {
  // landscape.jpg: 2560x1600. scaleRatio = max(2560/400, 1600/250) = 6.4 > 4 → 고해상도 경로 진입.
  const img = await loadImageElement('/samples/landscape.jpg');

  const section1 = document.createElement('div');
  section1.style.cssText = 'margin-bottom:20px';
  target.append(section1);
  await renderValidate(section1, img);

  const section2 = document.createElement('div');
  section2.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:20px';
  target.append(section2);
  for (const priority of ['fast', 'balanced', 'quality'] as const) {
    section2.append(await runResize(img, priority));
  }

  const section3 = document.createElement('div');
  target.append(section3);
  await renderBatch(section3, img);
}

async function renderValidate(container: HTMLElement, img: HTMLImageElement): Promise<void> {
  const v = HighResolutionProcessor.validate(img, TARGET.width, TARGET.height);
  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0;font-size:12px;background:#f7f7f7;border-radius:4px;padding:8px;white-space:pre-wrap';
  pre.textContent =
    `validate(img, ${TARGET.width}, ${TARGET.height})\n` +
    `canProcess: ${v.canProcess}\n` +
    `recommendedStrategy: ${v.recommendedStrategy}\n` +
    `estimatedTime: ${v.estimatedTime}ms\n` +
    `warnings: ${v.warnings.length ? v.warnings.join('; ') : '(없음)'}`;
  container.append(pre);
}

async function runResize(img: HTMLImageElement, priority: 'fast' | 'balanced' | 'quality'): Promise<HTMLElement> {
  const result = await HighResolutionProcessor.resize(img, TARGET.width, TARGET.height, { priority });

  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid #e0e0e0;border-radius:8px;padding:12px;background:#fff';

  const title = document.createElement('div');
  title.textContent = `priority: '${priority}'`;
  title.style.cssText = 'font-family:monospace;font-weight:600;margin-bottom:6px';

  result.canvas.style.cssText = 'display:block;max-width:100%;border:1px solid #e0e0e0;margin-bottom:6px';

  const info = document.createElement('pre');
  info.style.cssText = 'margin:0;font-size:11px;color:#555;white-space:pre-wrap';
  info.textContent =
    `strategy: ${result.strategy}\n` +
    `processingTime: ${result.processingTime.toFixed(1)}ms\n` +
    `memoryPeakUsageMB: ${result.memoryPeakUsageMB.toFixed(1)}MB\n` +
    `memoryOptimized: ${result.memoryOptimized}` +
    (result.userMessage ? `\nuserMessage: ${result.userMessage}` : '');

  card.append(title, result.canvas, info);
  return card;
}

async function renderBatch(container: HTMLElement, img: HTMLImageElement): Promise<void> {
  const label = document.createElement('div');
  label.textContent = 'batchResize(items, width, height, options) — 항목별 오버라이드 + 진행 콜백';
  label.style.cssText = 'font-weight:600;margin-bottom:8px';
  container.append(label);

  const log: string[] = [];
  const results = await HighResolutionProcessor.batchResize(
    [
      { img, name: 'full' },
      { img, width: 200, height: 125, name: 'small-override' },
    ],
    TARGET.width,
    TARGET.height,
    {
      priority: 'balanced',
      onProgress: (completed, total, name) => log.push(`progress ${completed}/${total} (${name})`),
    }
  );

  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0;font-size:12px;background:#f7f7f7;border-radius:4px;padding:8px;white-space:pre-wrap';
  pre.textContent =
    log.join('\n') +
    '\n\n' +
    results.map((r, i) => `[${i}] strategy: ${r.strategy}, ${r.canvas.width}x${r.canvas.height}`).join('\n');
  container.append(pre);
}

/** HTMLImageElement 입력 준비 — Image 객체를 만들어 decode가 끝난 후 반환한다. */
async function loadImageElement(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}
