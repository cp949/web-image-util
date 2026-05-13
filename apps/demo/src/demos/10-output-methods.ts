import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '10. 출력 메서드 비교',
  description:
    '동일한 체인(resize cover 240×160)을 toBlob/toDataURL/toFile/toCanvas로 받아 ' +
    '결과 객체의 타입과 활용처를 한눈에 비교한다. toCanvas는 무손실(픽셀 원본), ' +
    '나머지 셋은 JPEG 압축 손실 결과다.',
};

// 공통 리사이즈 파라미터 — 4개 카드 모두 동일한 형상/픽셀 영역을 출력한다.
const W = 240;
const H = 160;
// JPEG 인코딩 파라미터 — toBlob/toDataURL/toFile 3종이 공유.
const JPEG_FORMAT = 'jpeg' as const;
const JPEG_QUALITY = 0.85;

export async function run(target: HTMLElement): Promise<void> {
  const sample = await (await fetch('/samples/photo.jpg')).blob();

  // 상단 안내 한 줄 — 손실/무손실 차이를 페이지 맨 위에서 명시한다.
  const note = document.createElement('div');
  note.textContent = 'toCanvas는 무손실(픽셀 원본), 나머지 셋은 JPEG 압축 결과다.';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 4개 카드를 담을 그리드.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:16px';
  target.append(grid);

  // 카드 1 — toBlob: Blob 결과 → URL.createObjectURL → <img>.
  // resize는 체인당 1회 제약이 있어 카드마다 processImage(...)를 새로 시작한다.
  const blobResult = await processImage(sample)
    .resize({ fit: 'cover', width: W, height: H })
    .toBlob({ format: JPEG_FORMAT, quality: JPEG_QUALITY });
  grid.append(
    imageCard({
      method: 'toBlob',
      comment: '<img src>로 즉시 표시 가능',
      objectURL: URL.createObjectURL(blobResult.blob),
      rows: [
        ['format', String(blobResult.format ?? JPEG_FORMAT)],
        ['size', `${(blobResult.blob.size / 1024).toFixed(1)} KB`],
        ['type', blobResult.blob.type || '(미지정)'],
      ],
    })
  );

  // 카드 2 — toDataURL: 문자열 결과 → <img src=dataURL>.
  // dataURL은 base64로 인코딩되어 같은 바이트 대비 Blob보다 약 33% 크다.
  const dataURLResult = await processImage(sample)
    .resize({ fit: 'cover', width: W, height: H })
    .toDataURL({ format: JPEG_FORMAT, quality: JPEG_QUALITY });
  grid.append(
    imageCard({
      method: 'toDataURL',
      comment: 'JSON/localStorage 포함 가능',
      objectURL: dataURLResult.dataURL,
      rows: [
        ['format', String(dataURLResult.format ?? JPEG_FORMAT)],
        ['length', `${(dataURLResult.dataURL.length / 1024).toFixed(1)} KB`],
        ['prefix', `${dataURLResult.dataURL.slice(0, 22)}...`],
      ],
    })
  );

  // 카드 3 — toFile: File 객체(name 포함) → URL.createObjectURL → <img>.
  // File은 Blob의 서브타입이므로 createObjectURL을 그대로 쓸 수 있다.
  const fileResult = await processImage(sample)
    .resize({ fit: 'cover', width: W, height: H })
    .toFile('photo-output.jpg', { format: JPEG_FORMAT, quality: JPEG_QUALITY });
  grid.append(
    imageCard({
      method: 'toFile',
      comment: 'input[type=file]/FormData 업로드용',
      objectURL: URL.createObjectURL(fileResult.file),
      rows: [
        ['name', fileResult.file.name],
        ['size', `${(fileResult.file.size / 1024).toFixed(1)} KB`],
        ['type', fileResult.file.type || '(미지정)'],
      ],
    })
  );

  // 카드 4 — toCanvas: HTMLCanvasElement 자체를 DOM에 그대로 append한다.
  // 결과 캔버스는 사용자 소유이며 풀로 반환되지 않으므로 직접 append해도 안전하다.
  const canvasResult = await processImage(sample).resize({ fit: 'cover', width: W, height: H }).toCanvas();
  grid.append(
    canvasCard({
      method: 'toCanvas',
      comment: 'Canvas 추가 가공 / 무손실',
      canvas: canvasResult.canvas,
      rows: [
        ['dimensions', `${canvasResult.canvas.width}×${canvasResult.canvas.height}`],
        ['width', String(canvasResult.width)],
        ['height', String(canvasResult.height)],
      ],
    })
  );
}

/**
 * <img> 미디어용 카드.
 *
 * blob URL이든 dataURL이든 동일하게 <img.src>에 주입해 표시한다.
 * blob: 스킴이면 DemoPage 언마운트 시 일괄 revoke된다.
 */
function imageCard(params: {
  method: string;
  comment: string;
  objectURL: string;
  rows: ReadonlyArray<readonly [string, string]>;
}): HTMLElement {
  const wrap = cardShell(params.method);

  const img = new Image();
  img.src = params.objectURL;
  img.alt = params.method;
  img.style.cssText = 'display:block;width:100%;height:auto;border-radius:4px;background:#f5f5f5';

  wrap.append(img, metaTable(params.rows), commentLine(params.comment));
  return wrap;
}

/**
 * <canvas> 미디어용 카드 — 라이브러리가 돌려준 캔버스를 그대로 DOM에 부착한다.
 *
 * 다른 카드와 시각적 폭을 맞추기 위해 CSS width:100%를 적용한다.
 * 내부 픽셀 크기(canvas.width/height)는 W×H 그대로 유지된다.
 */
function canvasCard(params: {
  method: string;
  comment: string;
  canvas: HTMLCanvasElement;
  rows: ReadonlyArray<readonly [string, string]>;
}): HTMLElement {
  const wrap = cardShell(params.method);

  params.canvas.style.cssText = 'display:block;width:100%;height:auto;border-radius:4px;background:#f5f5f5';
  wrap.append(params.canvas, metaTable(params.rows), commentLine(params.comment));
  return wrap;
}

/**
 * 공통 카드 골격 — 외곽 박스 + 굵은 메서드명 헤더.
 */
function cardShell(method: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #e0e0e0;border-radius:8px;background:#fff';

  const header = document.createElement('div');
  header.textContent = method;
  header.style.cssText = 'font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px';
  wrap.append(header);
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
 * 카드 하단 한 줄 코멘트 — 메서드별 핵심 활용처를 한 문장으로 안내한다.
 */
function commentLine(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'font-size:11px;color:#555;border-top:1px dashed #eee;padding-top:6px';
  return el;
}
