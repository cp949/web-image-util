import { processImage } from '@cp949/web-image-util';
import { sanitizeSvgStrictDetailed } from '@cp949/web-image-util/svg-sanitizer';

export const meta = {
  title: '11. SVG 보안 (sanitizer)',
  description:
    'DOMPurify 기반 strict SVG sanitizer가 <script>, 인라인 이벤트 핸들러, ' +
    '외부 리소스 참조, <foreignObject> 등의 위험 요소를 제거하는 과정을 ' +
    '원본/정제 두 카드로 비교한다. 원본 SVG는 DOM에 노드로 삽입되지 않고 ' +
    '항상 텍스트로만 표시되어 데모 자체가 XSS 벡터가 되지 않도록 한다.',
};

// 의도적으로 다양한 위험 요소를 한 SVG에 모아 둔 시연용 입력.
// - <script>: 인라인 스크립트 실행 시도
// - onload/onclick: 인라인 이벤트 핸들러
// - <image href=...>: 외부 리소스 참조(SSRF/추적 픽셀 류 위험)
// - <foreignObject>: 임의 HTML 삽입 벡터
// - <circle>/<rect>: 정상 도형 — 정제 후에도 남아 결과 미리보기에 그려진다.
const RISKY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="200" height="150" onload="window.__hacked = true">
  <script>window.__hacked = true</script>
  <rect width="200" height="150" fill="#fde68a" onclick="alert('xss')" />
  <circle cx="60" cy="75" r="32" fill="#2563eb" />
  <circle cx="140" cy="75" r="32" fill="#dc2626" />
  <image href="https://example.com/evil.png" x="0" y="0" width="40" height="40" />
  <foreignObject x="20" y="100" width="160" height="40">
    <div xmlns="http://www.w3.org/1999/xhtml" onmouseover="alert('xss')">evil html</div>
  </foreignObject>
</svg>`;

// 정제 후 SVG 미리보기 크기 — 두 카드의 시각 비중을 비슷하게 두기 위한 값.
const PREVIEW_W = 240;
const PREVIEW_H = 180;

export async function run(target: HTMLElement): Promise<void> {
  // 상단 안내 한 줄 — 데모의 보안 정책을 페이지 맨 위에서 명시한다.
  const note = document.createElement('div');
  note.textContent = '원본 SVG는 DOM에 삽입하지 않고 텍스트로만 표시하며, 정제 후 SVG만 실제로 렌더링한다.';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 좌우 2열 그리드. 좁은 화면에서는 minmax가 한 열로 접어준다.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px';
  target.append(grid);

  // 좌측 카드 — 원본(위험 SVG): 절대 렌더링하지 않는다.
  grid.append(buildOriginalCard(RISKY_SVG));

  // 우측 카드 — 정제 후: 정제 결과를 렌더링하고 경고 목록을 보여준다.
  grid.append(await buildSanitizedCard(RISKY_SVG));
}

/**
 * 원본 카드 — 위험 SVG 문자열을 텍스트로만 표시한다.
 *
 * <pre>.textContent 경로만 사용하고 innerHTML / insertAdjacentHTML /
 * DOMParser → append 같은 경로는 사용하지 않는다. 데모 자체가 XSS
 * 벡터가 되지 않도록 하는 핵심 안전 정책이다.
 */
function buildOriginalCard(svg: string): HTMLElement {
  const wrap = cardShell('원본 (위험 SVG)');

  const guidance = document.createElement('div');
  guidance.textContent = '보안상 원본은 텍스트로만 표시한다.';
  guidance.style.cssText = 'font-size:12px;color:#b54708';
  wrap.append(guidance);

  wrap.append(svgTextBlock(svg));
  return wrap;
}

/**
 * 정제 후 카드 — sanitizeSvgStrictDetailed 결과 SVG와 경고 목록, 렌더 결과를 함께 보여준다.
 *
 * processImage는 정제된 SVG 문자열만을 입력으로 받아 안전한 PNG 미리보기를 만든다.
 * 변환 실패 시 카드 안에서만 빨간 메시지를 표시하고 다른 영역은 영향받지 않는다.
 */
async function buildSanitizedCard(rawSvg: string): Promise<HTMLElement> {
  const wrap = cardShell('정제 후');

  const guidance = document.createElement('div');
  guidance.textContent = 'sanitizeSvgStrictDetailed로 정제한 결과를 표시·렌더링한다.';
  guidance.style.cssText = 'font-size:12px;color:#0a6b2c';
  wrap.append(guidance);

  // 정제 자체는 거의 실패하지 않지만 방어적으로 try/catch를 둔다.
  let detailed: { svg: string; warnings: string[] };
  try {
    detailed = sanitizeSvgStrictDetailed(rawSvg);
  } catch (err) {
    wrap.append(errorLine(`정제 실패: ${formatError(err)}`));
    return wrap;
  }

  // 정제된 SVG 문자열 — 여기도 textContent로만 표시한다.
  wrap.append(svgTextBlock(detailed.svg));

  // 렌더 결과 — processImage로 PNG 미리보기를 생성한다.
  try {
    const result = await processImage(detailed.svg)
      .resize({
        fit: 'contain',
        width: PREVIEW_W,
        height: PREVIEW_H,
        background: '#fff',
      })
      .toBlob({ format: 'png' });

    const img = new Image();
    img.src = URL.createObjectURL(result.blob);
    img.alt = '정제 후 SVG 렌더 결과';
    img.width = PREVIEW_W;
    img.height = PREVIEW_H;
    img.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:4px;background:#f5f5f5';
    wrap.append(img);
  } catch (err) {
    wrap.append(errorLine(`렌더 실패: ${formatError(err)}`));
  }

  // 경고 목록 — 어떤 정책이 적용됐는지 한눈에 보여주는 핵심 정보다.
  wrap.append(warningsBlock(detailed.warnings));
  return wrap;
}

/**
 * SVG 텍스트 블록 — 항상 textContent로만 주입하는 안전 표시 영역.
 *
 * 스크롤 가능한 monospace pre. 카드 두 곳에서 동일한 형식으로 재사용한다.
 */
function svgTextBlock(svg: string): HTMLElement {
  const pre = document.createElement('pre');
  pre.textContent = svg;
  pre.style.cssText =
    'margin:0;padding:8px;background:#0f172a;color:#e2e8f0;border-radius:4px;' +
    'max-height:220px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-all';
  return pre;
}

/**
 * 경고 목록 영역 — warnings 배열을 <ul><li>로 변환한다.
 *
 * 각 항목 텍스트도 textContent로만 주입한다. 경고가 없으면 한 줄 안내만 표시한다.
 */
function warningsBlock(warnings: ReadonlyArray<string>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px dashed #eee;padding-top:8px';

  const header = document.createElement('div');
  header.textContent = `경고 (${warnings.length})`;
  header.style.cssText = 'font-size:11px;font-weight:600;color:#555';
  wrap.append(header);

  if (warnings.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = '경고 없음';
    empty.style.cssText = 'font-size:11px;color:#888';
    wrap.append(empty);
    return wrap;
  }

  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding-left:18px;display:flex;flex-direction:column;gap:2px';
  for (const message of warnings) {
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
 * 09/10 데모의 카드 양식과 시각적으로 일관성을 유지한다.
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
