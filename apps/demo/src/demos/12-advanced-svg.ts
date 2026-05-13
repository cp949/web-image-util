import { analyzeSvgComplexity, enhanceSvgForBrowser, extractSvgDimensions, processImage } from '@cp949/web-image-util';

export const meta = {
  title: '12. Advanced: SVG 복잡도/호환성',
  description:
    'SVG별 복잡도 메트릭과 권장 품질 레벨을 분석하고 enhanceSvgForBrowser로 ' + '보강한 결과를 함께 보여준다.',
};

// 미리보기 이미지 크기 — 세 카드의 시각 비중을 일치시키기 위한 값.
const PREVIEW_W = 240;
const PREVIEW_H = 180;

// 분석 대상 SVG 샘플 목록. public/samples/ 하위 정적 파일을 fetch한다.
const SAMPLES: ReadonlyArray<{ readonly file: string; readonly url: string }> = [
  { file: 'svg-icon-small.svg', url: '/samples/svg-icon-small.svg' },
  { file: 'svg-character.svg', url: '/samples/svg-character.svg' },
  { file: 'svg-illustration-wide.svg', url: '/samples/svg-illustration-wide.svg' },
];

export async function run(target: HTMLElement): Promise<void> {
  // 상단 안내 한 줄 — 데모의 의도를 페이지 첫 줄에서 명시한다.
  const note = document.createElement('div');
  note.textContent = 'analyzeSvgComplexity / extractSvgDimensions / enhanceSvgForBrowser 결과를 카드 단위로 비교한다.';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 3개 카드를 담는 그리드 — 좁은 화면에서는 자동으로 한 열로 접힌다.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:16px';
  target.append(grid);

  // 카드 단위 try/catch가 buildSampleCard 내부에 있으므로 Promise.all 자체는 안전하다.
  const cards = await Promise.all(SAMPLES.map((sample) => buildSampleCard(sample.file, sample.url)));
  for (const card of cards) {
    grid.append(card);
  }
}

/**
 * 샘플 단위 카드 — fetch → 분석 → 보강 → 렌더의 한 사이클을 한 카드에 담는다.
 *
 * 카드 단위로 try/catch를 두어 한 SVG가 실패해도 나머지 카드는 영향을 받지 않는다.
 */
async function buildSampleCard(fileName: string, url: string): Promise<HTMLElement> {
  const wrap = cardShell(fileName);

  let svgText: string;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    svgText = await response.text();
  } catch (err) {
    wrap.append(errorLine(`SVG 로드 실패: ${formatError(err)}`));
    return wrap;
  }

  // 치수 정보 — extractSvgDimensions 내부에서 예외가 발생할 가능성에 대비한다.
  try {
    wrap.append(dimensionsHeader(svgText));
  } catch (err) {
    wrap.append(errorLine(`치수 분석 실패: ${formatError(err)}`));
  }

  // 복잡도 분석 — 실패 시 그 영역만 에러 표시하고 나머지는 진행한다.
  try {
    const analysis = analyzeSvgComplexity(svgText);
    wrap.append(metricsTable(analysis));
    wrap.append(reasoningList(analysis.reasoning));
  } catch (err) {
    wrap.append(errorLine(`복잡도 분석 실패: ${formatError(err)}`));
  }

  // 보강 후 렌더 결과 — enhanceSvgForBrowser는 입력 SVG 문자열을 안전하게 변형한다.
  try {
    const enhanced = enhanceSvgForBrowser(svgText);
    const result = await processImage(enhanced)
      .resize({
        fit: 'contain',
        width: PREVIEW_W,
        height: PREVIEW_H,
        background: '#fff',
      })
      .toBlob({ format: 'png' });

    const img = new Image();
    img.src = URL.createObjectURL(result.blob);
    img.alt = `${fileName} 보강 후 렌더`;
    img.width = PREVIEW_W;
    img.height = PREVIEW_H;
    img.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:4px;background:#f5f5f5';
    wrap.append(img);
  } catch (err) {
    wrap.append(errorLine(`보강/렌더 실패: ${formatError(err)}`));
  }

  // 하단 한 줄 코멘트 — 보강의 의미를 한 줄로 정리한다.
  const footer = document.createElement('div');
  footer.textContent = '보강 결과는 Safari/뷰포트 누락 등 환경 차이를 완충한다.';
  footer.style.cssText = 'font-size:11px;color:#666;border-top:1px dashed #eee;padding-top:8px';
  wrap.append(footer);

  return wrap;
}

/**
 * 헤더 영역 — 파일명 아래에 width × height (viewBox: x y w h) 형태로 치수를 표시한다.
 *
 * hasExplicitSize가 false면 (no explicit size)를 덧붙여 사용자가 의미를 파악할 수 있게 한다.
 */
function dimensionsHeader(svgText: string): HTMLElement {
  const dims = extractSvgDimensions(svgText);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px';

  const sizeLine = document.createElement('div');
  let text = `${dims.width} × ${dims.height}`;
  if (dims.viewBox) {
    const vb = dims.viewBox;
    text += ` (viewBox: ${vb.x} ${vb.y} ${vb.width} ${vb.height})`;
  }
  if (!dims.hasExplicitSize) {
    text += ' (no explicit size)';
  }
  sizeLine.textContent = text;
  sizeLine.style.cssText =
    'font-size:11px;color:#444;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all';
  wrap.append(sizeLine);

  return wrap;
}

/**
 * 메트릭 표 — analyzeSvgComplexity 결과의 핵심 수치를 key-value 리스트로 표시한다.
 *
 * 모든 텍스트는 textContent로만 주입한다. monospace 12px로 통일해 가독성을 유지한다.
 */
function metricsTable(result: ReturnType<typeof analyzeSvgComplexity>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:12px;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#333;' +
    'border-top:1px dashed #eee;padding-top:8px';

  const rows: ReadonlyArray<readonly [string, string]> = [
    ['복잡도 점수', result.complexityScore.toFixed(2)],
    ['권장 품질 레벨', result.recommendedQuality],
    ['Path 수', String(result.metrics.pathCount)],
    ['그라디언트 수', String(result.metrics.gradientCount)],
    ['필터 수', String(result.metrics.filterCount)],
    ['ClipPath 사용', result.metrics.hasClipPath ? '예' : '아니오'],
    ['Mask 사용', result.metrics.hasMask ? '예' : '아니오'],
    ['전체 요소 수', String(result.metrics.totalElementCount)],
  ];

  for (const [key, value] of rows) {
    const k = document.createElement('div');
    k.textContent = key;
    k.style.cssText = 'color:#666';
    const v = document.createElement('div');
    v.textContent = value;
    v.style.cssText = 'word-break:break-all';
    wrap.append(k, v);
  }

  return wrap;
}

/**
 * 권장 이유 영역 — reasoning 배열에서 최대 3개를 <li>로 보여준다.
 *
 * 비어있는 경우 "(이유 없음)" 한 줄을 안내한다.
 */
function reasoningList(reasoning: ReadonlyArray<string>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px dashed #eee;padding-top:8px';

  const header = document.createElement('div');
  header.textContent = '권장 이유';
  header.style.cssText = 'font-size:11px;font-weight:600;color:#555';
  wrap.append(header);

  const top = reasoning.slice(0, 3);
  if (top.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = '(이유 없음)';
    empty.style.cssText = 'font-size:11px;color:#888';
    wrap.append(empty);
    return wrap;
  }

  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding-left:18px;display:flex;flex-direction:column;gap:2px';
  for (const message of top) {
    const li = document.createElement('li');
    li.textContent = message;
    li.style.cssText = 'font-size:11px;color:#333;word-break:break-word';
    list.append(li);
  }
  wrap.append(list);

  return wrap;
}

/**
 * 공통 카드 골격 — 외곽 박스 + 굵은 헤더.
 *
 * 11-svg-sanitizer 카드 양식과 시각적으로 일관성을 유지한다.
 */
function cardShell(title: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #e0e0e0;' +
    'border-radius:8px;background:#fff';

  const header = document.createElement('div');
  header.textContent = title;
  header.style.cssText = 'font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px';
  wrap.append(header);
  return wrap;
}

/**
 * 카드 내부 에러 한 줄 — 빨간 톤으로 표기하되 카드 경계는 벗어나지 않는다.
 */
function errorLine(message: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = 'font-size:12px;color:#b42318;word-break:break-word';
  return el;
}

/**
 * 에러 객체를 사람이 읽을 수 있는 문자열로 정규화한다.
 */
function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
