import { ImageProcessError, processImage } from '@cp949/web-image-util';

export const meta = {
  title: '13. 에러 처리 카탈로그',
  description: '라이브러리가 던지는 ImageProcessError의 code/message/cause/details를 케이스별로 비교한다.',
};

/**
 * 의도적으로 실패시킬 케이스 정의.
 *
 * label : 카드 헤더에 노출되는 케이스 이름.
 * input : "유발 입력" 라벨에 한 줄로 표시될 사람이 읽을 수 있는 설명.
 * run   : 실제로 호출되어 throw를 유발하는 비동기 함수. 성공하면 "(예상과 달리 성공함)"로 표시된다.
 */
interface ErrorCase {
  readonly label: string;
  readonly input: string;
  readonly run: () => Promise<unknown>;
}

const CASES: ReadonlyArray<ErrorCase> = [
  {
    label: '케이스 1 — 잘못된 입력 (null)',
    input: 'processImage(null)',
    run: async () => {
      // 케이스 1은 타입 위반을 의도적으로 유발하는 케이스이므로
      // 타입 단언 1회를 허용한다 (CLAUDE.md 작업 지침).
      return await processImage(null as never)
        .resize({ fit: 'cover', width: 100, height: 100 })
        .toBlob();
    },
  },
  {
    label: '케이스 2 — 손상된 이미지 바이트',
    input: 'Blob(Uint8Array([0,0,0,0]), image/png)',
    run: async () => {
      // PNG MIME으로 라벨링되었지만 본문은 4바이트의 의미 없는 데이터.
      // 디코딩 단계에서 실패해야 한다.
      const corrupted = new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'image/png' });
      return await processImage(corrupted).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();
    },
  },
  {
    label: '케이스 3 — 손상된 SVG 문자열',
    input: "'<svg>' (닫히지 않음)",
    run: async () => {
      // 닫히지 않은 SVG. 파싱/입력 검증 단계에서 실패해야 한다.
      return await processImage('<svg>').resize({ fit: 'cover', width: 100, height: 100 }).toBlob();
    },
  },
  {
    label: '케이스 4 — 존재하지 않는 URL',
    input: "'/samples/__does-not-exist.jpg'",
    run: async () => {
      // fetch가 404로 응답해 SOURCE_LOAD_FAILED 계열 에러가 던져진다.
      return await processImage('/samples/__does-not-exist.jpg')
        .resize({ fit: 'cover', width: 100, height: 100 })
        .toBlob();
    },
  },
];

export async function run(target: HTMLElement): Promise<void> {
  // 상단 안내 — 데모 의도를 첫 줄에서 명시한다.
  const note = document.createElement('div');
  note.textContent = '라이브러리 ImageProcessError의 코드/메시지/cause를 비교한다. 모든 케이스는 의도된 실패다.';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 카드 그리드 — 좁은 화면에서는 자동으로 한 열로 접힌다.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px';
  target.append(grid);

  // 케이스별 카드를 순차 생성. 각 카드는 자체 try/catch로 격리되어 있다.
  for (const c of CASES) {
    grid.append(await buildCaseCard(c));
  }
}

/**
 * 케이스 한 건을 카드로 만든다.
 *
 * - run()을 try/await로 호출하고, 던져진 에러를 검사해 표를 채운다.
 * - 호출이 동기 throw / 비동기 reject 중 무엇이든 catch가 잡는다.
 * - 성공 시 데모가 의도와 어긋났음을 명시적으로 표시한다 (silently pass 방지).
 */
async function buildCaseCard(c: ErrorCase): Promise<HTMLElement> {
  const wrap = cardShell(c.label);

  // 유발 입력 한 줄 — 입력의 정체를 사람이 읽을 수 있게 보여준다.
  wrap.append(kvLine('유발 입력', c.input));

  try {
    // 케이스 1처럼 동기 throw 가능성도 있으므로 try 안에서 호출 자체를 감싼다.
    await c.run();
    // 던지지 않았다면 카탈로그 의도와 어긋남.
    wrap.append(noticeLine('(예상과 달리 성공함)'));
  } catch (err) {
    appendErrorTable(wrap, err);
  }

  return wrap;
}

/**
 * 에러 객체를 카드 안의 key-value 표 + cause/details 영역으로 펼친다.
 *
 * ImageProcessError 인스턴스가 아니면 code를 "(N/A)"로 표시한다.
 */
function appendErrorTable(parent: HTMLElement, err: unknown): void {
  const isLibErr = err instanceof ImageProcessError;
  const name = err instanceof Error ? err.name : '(non-Error)';
  const code = isLibErr ? err.code : '(N/A)';
  const message = err instanceof Error ? err.message : String(err);

  // 핵심 3종 (name / code / message) — 항상 표시한다.
  const table = document.createElement('div');
  table.style.cssText =
    'display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:12px;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#333;' +
    'border-top:1px dashed #eee;padding-top:8px';

  for (const [k, v] of [
    ['name', name],
    ['code', code],
    ['message', message],
  ] as ReadonlyArray<readonly [string, string]>) {
    const kEl = document.createElement('div');
    kEl.textContent = k;
    kEl.style.cssText = 'color:#666';
    const vEl = document.createElement('div');
    vEl.textContent = v;
    vEl.style.cssText = 'word-break:break-word';
    table.append(kEl, vEl);
  }
  parent.append(table);

  // cause.message — 있을 때만 한 줄로 표시.
  const cause = isLibErr ? err.cause : err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  if (cause !== undefined && cause !== null) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause);
    parent.append(kvLine('cause.message', causeMsg));
  }

  // details — 있을 때만 JSON 펴서 <pre>로.
  if (isLibErr && err.details !== undefined && err.details !== null) {
    parent.append(detailsBlock(err.details));
  }
}

/**
 * 한 줄짜리 key-value 표시 컴포넌트.
 *
 * "유발 입력"이나 "cause.message"처럼 짧은 부가 정보에 사용한다.
 */
function kvLine(key: string, value: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:12px;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#333';
  const k = document.createElement('div');
  k.textContent = key;
  k.style.cssText = 'color:#666';
  const v = document.createElement('div');
  v.textContent = value;
  v.style.cssText = 'word-break:break-word';
  wrap.append(k, v);
  return wrap;
}

/**
 * details 영역 — JSON.stringify(value, null, 2) 결과를 <pre>.textContent로 안전 주입.
 *
 * 순환 참조 등으로 직렬화가 실패할 수도 있으므로 fallback 경로를 둔다.
 */
function detailsBlock(details: unknown): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'border-top:1px dashed #eee;padding-top:8px;display:flex;flex-direction:column;gap:4px';

  const header = document.createElement('div');
  header.textContent = 'details';
  header.style.cssText = 'font-size:11px;font-weight:600;color:#555';
  wrap.append(header);

  let text: string;
  try {
    text = JSON.stringify(details, null, 2);
    // JSON.stringify는 함수/undefined를 만나면 undefined를 반환할 수 있다.
    if (text === undefined) {
      text = String(details);
    }
  } catch {
    text = '(직렬화 실패)';
  }

  const pre = document.createElement('pre');
  pre.textContent = text;
  pre.style.cssText =
    'margin:0;font-size:11px;line-height:1.4;color:#222;background:#f7f7f7;border-radius:4px;padding:6px 8px;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;' +
    'max-height:180px;overflow:auto';
  wrap.append(pre);
  return wrap;
}

/**
 * 카드 안에서 사용자에게 보이는 안내 한 줄 — 예상과 달리 성공한 케이스 표시 등에 사용.
 */
function noticeLine(message: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = 'font-size:12px;color:#b42318;border-top:1px dashed #eee;padding-top:8px';
  return el;
}

/**
 * 공통 카드 골격 — 외곽 박스 + 굵은 헤더.
 *
 * 12-advanced-svg와 시각적으로 일관성을 유지한다.
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
