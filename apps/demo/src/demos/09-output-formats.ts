import type { OutputFormat, OutputOptions } from '@cp949/web-image-util';
import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '09. 출력 포맷 비교',
  description:
    '같은 리사이즈 결과(contain 600×400)를 4개 포맷(WebP/JPEG@0.9/JPEG@0.6/PNG)으로 출력해 ' +
    '용량과 폴백 동작을 비교한다. 브라우저가 요청 포맷을 지원하지 않으면 fallbackFormat이 적용되며, ' +
    '실제 반환 포맷이 요청과 다르면 카드에 별도로 표기한다.',
};

// 공통 리사이즈 파라미터 — 4개 카드 모두 동일한 형상/픽셀 영역을 출력한다.
const W = 600;
const H = 400;

// 카드 정의 — 라벨, 요청 옵션, 코멘트를 한 곳에 모아 카드 간 순서를 명확히 한다.
interface CardSpec {
  /** 카드 헤더 라벨(요청 포맷 + quality). */
  label: string;
  /** 요청한 포맷 — 실제 반환 포맷과 비교할 때 사용한다. */
  requestedFormat: OutputFormat;
  /** toBlob에 그대로 전달할 옵션. */
  options: OutputOptions;
  /** 카드 하단 한 줄 코멘트 — 포맷 특성을 짧게 안내한다. */
  comment: string;
}

const CARDS: ReadonlyArray<CardSpec> = [
  {
    label: 'WebP q=0.85',
    requestedFormat: 'webp',
    options: { format: 'webp', quality: 0.85 },
    comment: '고압축 손실 포맷 — 미지원 시 fallbackFormat(기본 png)로 폴백',
  },
  {
    label: 'JPEG q=0.9',
    requestedFormat: 'jpeg',
    options: { format: 'jpeg', quality: 0.9 },
    comment: '사진 친화 손실 포맷 — 고화질 설정',
  },
  {
    label: 'JPEG q=0.6',
    requestedFormat: 'jpeg',
    options: { format: 'jpeg', quality: 0.6 },
    comment: '사진 친화 손실 포맷 — 저화질·고압축 설정',
  },
  {
    label: 'PNG',
    requestedFormat: 'png',
    options: { format: 'png' },
    comment: '무손실 포맷 — quality 무시, 알파 보존',
  },
];

/**
 * 카드 변환 결과 — 성공/실패 모두 표현할 수 있게 discriminated union으로 둔다.
 */
type CardOutcome =
  | {
      status: 'ok';
      spec: CardSpec;
      blob: Blob;
      actualFormat: OutputFormat | undefined;
    }
  | {
      status: 'error';
      spec: CardSpec;
      message: string;
    };

export async function run(target: HTMLElement): Promise<void> {
  // 샘플은 한 번만 fetch해 Blob을 모든 카드가 공유한다(중복 네트워크 호출 회피).
  const sample = await (await fetch('/samples/landscape.jpg')).blob();

  // 상단 안내 한 줄 — 요청/실제 포맷이 다를 수 있다는 점을 페이지 위에서 명시한다.
  const note = document.createElement('div');
  note.textContent = '브라우저가 요청 포맷을 지원하지 않으면 실제 반환 포맷이 달라질 수 있다.';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 4개 카드를 담을 그리드.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:16px';
  target.append(grid);

  // 카드별 변환을 병렬 실행한다. resize는 체인당 1회 제약이 있어 카드마다 새 체인을 시작한다.
  // 개별 변환 실패가 다른 카드를 막지 않도록 try/catch로 셀 단위 격리한다.
  const outcomes = await Promise.all(CARDS.map((spec) => convertOne(sample, spec)));

  // Smallest 배지 — 성공한 카드 중 blob.size 최솟값을 찾고, 동률이면 첫 번째에 부착한다.
  let smallestIndex = -1;
  let smallestSize = Number.POSITIVE_INFINITY;
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.status === 'ok' && outcome.blob.size < smallestSize) {
      smallestSize = outcome.blob.size;
      smallestIndex = i;
    }
  }

  // 카드 DOM을 순서대로 그리드에 부착한다.
  for (let i = 0; i < outcomes.length; i++) {
    grid.append(renderCard(outcomes[i], i === smallestIndex));
  }
}

/**
 * 단일 카드 변환 — 동일한 resize 체인을 카드별로 새로 시작해 출력 포맷만 바꾼다.
 *
 * resize 1회 제약을 지키기 위해 카드마다 processImage(...)를 새로 호출한다.
 * fetch는 호출자에서 한 번만 수행하고 같은 Blob을 재사용한다.
 */
async function convertOne(sample: Blob, spec: CardSpec): Promise<CardOutcome> {
  try {
    const result = await processImage(sample)
      .resize({ fit: 'contain', width: W, height: H, background: '#fff' })
      .toBlob(spec.options);
    return {
      status: 'ok',
      spec,
      blob: result.blob,
      actualFormat: result.format,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', spec, message };
  }
}

/**
 * 카드 DOM 생성 — 성공 시 이미지/메타/코멘트, 실패 시 에러 메시지를 표시한다.
 *
 * isSmallest가 true이면 헤더 옆에 "Smallest" 텍스트 배지를 부착한다.
 */
function renderCard(outcome: CardOutcome, isSmallest: boolean): HTMLElement {
  if (outcome.status === 'error') {
    return errorCard(outcome.spec, outcome.message);
  }
  return imageCard(outcome, isSmallest);
}

/**
 * 정상 결과 카드.
 *
 * 헤더에 라벨과 (옵션) Smallest 배지를 둔다.
 * 라벨 아래 실제 반환 포맷이 요청과 다르면 "→ 실제: WEBP" 형태로 추가 줄을 띄운다.
 */
function imageCard(outcome: Extract<CardOutcome, { status: 'ok' }>, isSmallest: boolean): HTMLElement {
  const { spec, blob, actualFormat } = outcome;
  const wrap = cardShell();

  // 헤더 줄: 라벨 + Smallest 배지.
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px';
  const title = document.createElement('div');
  title.textContent = spec.label;
  title.style.cssText = 'font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px';
  header.append(title);
  if (isSmallest) {
    header.append(smallestBadge());
  }
  wrap.append(header);

  // 실제 반환 포맷이 요청과 다르면 한 줄 더 안내한다(폴백 시각화).
  const normalizedRequested = normalizeFormat(spec.requestedFormat);
  const normalizedActual = actualFormat ? normalizeFormat(actualFormat) : undefined;
  if (normalizedActual && normalizedActual !== normalizedRequested) {
    const fallbackLine = document.createElement('div');
    fallbackLine.textContent = `→ 실제: ${normalizedActual.toUpperCase()}`;
    fallbackLine.style.cssText = 'font-size:11px;color:#b54708';
    wrap.append(fallbackLine);
  }

  // 미리보기 이미지 — 4개 모두 600×400 동일 픽셀 크기로 인코딩됨.
  // 카드 안에서는 max-width:100%로 카드 폭에 맞춰 축소 표시한다.
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.alt = spec.label;
  img.width = W;
  img.height = H;
  img.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:4px;background:#f5f5f5';
  wrap.append(img);

  // 메타 표 — 용량/MIME/실제 포맷.
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['size', `${(blob.size / 1024).toFixed(1)} KB`],
    ['type', blob.type || '(미지정)'],
    ['format', normalizedActual ? normalizedActual.toUpperCase() : '(미지정)'],
  ];
  wrap.append(metaTable(rows));
  wrap.append(commentLine(spec.comment));
  return wrap;
}

/**
 * 에러 카드 — 변환이 실패한 카드만 빨간 톤으로 표시한다.
 */
function errorCard(spec: CardSpec, message: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #f5c2c7;border-radius:8px;background:#fff5f5';

  const title = document.createElement('div');
  title.textContent = spec.label;
  title.style.cssText = 'font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px';

  const err = document.createElement('div');
  err.textContent = `변환 실패: ${message}`;
  err.style.cssText = 'font-size:12px;color:#b42318;word-break:break-word';

  wrap.append(title, err);
  return wrap;
}

/**
 * Smallest 텍스트 배지 — emoji 없이 텍스트만 사용한다.
 */
function smallestBadge(): HTMLElement {
  const badge = document.createElement('span');
  badge.textContent = 'Smallest';
  badge.style.cssText =
    'display:inline-block;padding:2px 8px;font-size:11px;font-weight:600;color:#0a6b2c;' +
    'background:#dcfce7;border:1px solid #86efac;border-radius:999px;';
  return badge;
}

/**
 * 공통 카드 골격 — 외곽 박스만 정의하고 헤더는 호출자가 직접 붙인다.
 */
function cardShell(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #e0e0e0;border-radius:8px;background:#fff';
  return wrap;
}

/**
 * 메타 키/값 표 — 작은 단조 폰트로 좌측 라벨, 우측 값을 나열한다.
 */
function metaTable(rows: ReadonlyArray<readonly [string, string]>): HTMLElement {
  const table = document.createElement('div');
  table.style.cssText =
    'display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:11px;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#333';

  for (const [label, value] of rows) {
    const k = document.createElement('div');
    k.textContent = label;
    k.style.cssText = 'color:#888';
    const v = document.createElement('div');
    v.textContent = value;
    v.style.cssText = 'word-break:break-all';
    table.append(k, v);
  }
  return table;
}

/**
 * 카드 하단 한 줄 코멘트 — 포맷별 특성을 한 문장으로 안내한다.
 */
function commentLine(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'font-size:11px;color:#555;border-top:1px dashed #eee;padding-top:6px';
  return el;
}

/**
 * 'jpg'와 'jpeg'를 같은 값으로 취급해 폴백 표시가 잘못 뜨지 않도록 정규화한다.
 */
function normalizeFormat(format: OutputFormat): OutputFormat {
  return format === 'jpg' ? 'jpeg' : format;
}
