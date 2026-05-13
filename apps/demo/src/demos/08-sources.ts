import { blobToDataURL, type ImageSource, processImage } from '@cp949/web-image-util';

export const meta = {
  title: '08. 입력 소스 갤러리',
  description:
    'ImageSource 7가지(Blob, File, URL, Data URL, SVG XML, ArrayBuffer, HTMLImageElement)를 ' +
    '동일한 resize+toBlob 파이프로 처리해 processImage()의 다형성을 한눈에 보여준다.',
};

// 공통 리사이즈/출력 파라미터 — 7개 카드 모두 동일한 파이프를 통과한다.
const W = 200;
const H = 150;
const OUTPUT_FORMAT = 'webp' as const;
const OUTPUT_QUALITY = 0.85;

// 동일 photo.jpg를 재사용하는 카드(1/2/4/6/7)와 별도 SVG fetch가 필요한 카드(5)로 나뉜다.
const PHOTO_URL = '/samples/photo.jpg';
const SVG_URL = '/samples/svg-icon-small.svg';

// 카드 식별 라벨 — 입력 타입 7종을 고정 순서로 노출한다.
type CardLabel = 'Blob' | 'File' | 'URL string' | 'Data URL' | 'SVG XML' | 'ArrayBuffer' | 'HTMLImageElement';

/**
 * 카드 변환 결과 — 성공/실패를 discriminated union으로 표현한다.
 *
 * footer는 카드 푸터 한 줄(입력 크기 → 결과 크기 형태)을 미리 만들어 둔다.
 */
type CardOutcome =
  | {
      status: 'ok';
      label: CardLabel;
      blob: Blob;
      footer: string;
    }
  | {
      status: 'error';
      label: CardLabel;
      message: string;
    };

export async function run(target: HTMLElement): Promise<void> {
  // 상단 안내 한 줄 — 카드 7개가 같은 결과(200×150 WebP)를 만든다는 점을 명시한다.
  const note = document.createElement('div');
  note.textContent = '동일한 파이프(resize cover 200×150 → WebP q=0.85)에 7가지 입력을 흘려보낸 결과를 비교한다.';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 7개 카드를 담을 그리드.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:16px';
  target.append(grid);

  // 입력 재료 준비 — photo.jpg는 한 번만 fetch해 1/2/4/6/7 카드가 공유한다.
  // 입력 준비 단계 실패도 카드별 에러로 격리하기 위해 페이지 전체를 try/catch로 막지 않는다.
  let photoBlob: Blob | undefined;
  let photoArrayBuffer: ArrayBuffer | undefined;
  let photoDataURL: string | undefined;
  let photoImage: HTMLImageElement | undefined;
  let photoPrepError: string | undefined;

  try {
    photoBlob = await (await fetch(PHOTO_URL)).blob();
    photoArrayBuffer = await photoBlob.arrayBuffer();
    // 라이브러리 메인 export의 blobToDataURL을 사용해 data:image/jpeg;base64,... 문자열을 만든다.
    photoDataURL = await blobToDataURL(photoBlob);
    photoImage = await loadImageElement(PHOTO_URL);
  } catch (err) {
    photoPrepError = err instanceof Error ? err.message : String(err);
  }

  // SVG XML은 별도 텍스트로 fetch한다(이미지 디코드가 아니라 문자열 그대로 사용).
  let svgText: string | undefined;
  let svgPrepError: string | undefined;
  try {
    svgText = await (await fetch(SVG_URL)).text();
  } catch (err) {
    svgPrepError = err instanceof Error ? err.message : String(err);
  }

  // 7개 카드를 정의된 순서로 변환한다. 입력 준비가 실패한 카드는 해당 에러를 그대로 보고한다.
  const outcomes: CardOutcome[] = [];

  outcomes.push(
    await convertCard('Blob', photoBlob, photoPrepError, (blob) => footerSize('Blob', blob.size, undefined))
  );

  outcomes.push(
    await convertCard(
      'File',
      photoBlob ? new File([photoBlob], 'photo.jpg', { type: 'image/jpeg' }) : undefined,
      photoPrepError,
      (file) => footerSize('File', file.size, file.name)
    )
  );

  outcomes.push(await convertCard('URL string', PHOTO_URL, undefined, () => footerLength('URL', PHOTO_URL.length)));

  outcomes.push(
    await convertCard('Data URL', photoDataURL, photoPrepError, (value) => footerLengthBytes('Data URL', value.length))
  );

  outcomes.push(await convertCard('SVG XML', svgText, svgPrepError, (value) => footerLength('SVG XML', value.length)));

  outcomes.push(
    await convertCard('ArrayBuffer', photoArrayBuffer, photoPrepError, (buffer) =>
      footerSize('ArrayBuffer', buffer.byteLength, undefined)
    )
  );

  outcomes.push(
    await convertCard('HTMLImageElement', photoImage, photoPrepError, (image) =>
      footerDimensions(image.naturalWidth, image.naturalHeight)
    )
  );

  // 카드 DOM을 정의된 순서대로 그리드에 부착한다.
  for (const outcome of outcomes) {
    grid.append(renderCard(outcome));
  }
}

/**
 * 단일 카드 변환 — 입력이 준비됐으면 공통 파이프를 실행하고, 아니면 준비 단계 에러를 보고한다.
 *
 * `prepError`가 있으면 입력은 undefined로 들어오므로 즉시 에러 카드를 만든다.
 * 변환은 카드마다 새 체인을 시작한다(resize는 체인당 1회 제약).
 */
async function convertCard<TInput extends ImageSource>(
  label: CardLabel,
  input: TInput | undefined,
  prepError: string | undefined,
  toFooter: (input: TInput, resultSize: number) => string
): Promise<CardOutcome> {
  if (input === undefined) {
    return {
      status: 'error',
      label,
      message: prepError ?? '입력을 준비하지 못했습니다.',
    };
  }
  try {
    // 카드별 입력 타입(TInput)은 ImageSource union의 한 갈래로 제약되어 있어 별도 캐스팅 없이 그대로 전달한다.
    const source: ImageSource = input;
    const result = await processImage(source)
      .resize({ fit: 'cover', width: W, height: H })
      .toBlob({ format: OUTPUT_FORMAT, quality: OUTPUT_QUALITY });

    const footerLeft = toFooter(input, result.blob.size);
    const footer = `${footerLeft} → WebP ${formatBytes(result.blob.size)}`;
    return { status: 'ok', label, blob: result.blob, footer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', label, message };
  }
}

/**
 * 결과 카드 — 헤더(라벨) + 결과 이미지 + 푸터(입력 크기 → 출력 크기).
 *
 * blob URL은 DemoPage 언마운트 시 일괄 revoke된다.
 */
function renderCard(outcome: CardOutcome): HTMLElement {
  if (outcome.status === 'error') {
    return errorCard(outcome.label, outcome.message);
  }
  return imageCard(outcome.label, outcome.blob, outcome.footer);
}

/**
 * 정상 결과 카드.
 */
function imageCard(label: CardLabel, blob: Blob, footer: string): HTMLElement {
  const wrap = cardShell(label);

  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.alt = label;
  img.width = W;
  img.height = H;
  img.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:4px;background:#f5f5f5';
  wrap.append(img);

  wrap.append(footerLine(footer));
  return wrap;
}

/**
 * 에러 카드 — 입력 준비 또는 변환이 실패한 카드만 빨간 톤으로 표시한다.
 */
function errorCard(label: CardLabel, message: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #f5c2c7;border-radius:8px;background:#fff5f5';

  const header = document.createElement('div');
  header.textContent = label;
  header.style.cssText = 'font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px';

  const err = document.createElement('div');
  err.textContent = `변환 실패: ${message}`;
  err.style.cssText = 'font-size:12px;color:#b42318;word-break:break-word';

  wrap.append(header, err);
  return wrap;
}

/**
 * 공통 카드 골격 — 외곽 박스 + 굵은 라벨 헤더.
 */
function cardShell(label: CardLabel): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #e0e0e0;border-radius:8px;background:#fff';

  const header = document.createElement('div');
  header.textContent = label;
  header.style.cssText = 'font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px';
  wrap.append(header);
  return wrap;
}

/**
 * 카드 푸터 한 줄 — 입력/출력 크기 비교 텍스트를 단조 폰트로 표시한다.
 */
function footerLine(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText =
    'font-size:11px;color:#555;border-top:1px dashed #eee;padding-top:6px;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all';
  return el;
}

/**
 * HTMLImageElement 입력 준비 — Image 객체를 만들어 decode가 끝난 후 반환한다.
 *
 * decode는 onload보다 안전한 비동기 디코딩 완료 보장 API다.
 */
async function loadImageElement(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/**
 * 입력 크기 푸터 — 바이트 단위로 가지고 있는 입력(Blob/File/ArrayBuffer)을 사람이 읽기 쉬운 단위로 변환.
 *
 * fileName이 있으면 라벨 뒤에 파일명을 덧붙인다(File 카드 전용).
 */
function footerSize(label: string, byteLength: number, fileName: string | undefined): string {
  const sizeText = formatBytes(byteLength);
  return fileName ? `${label} ${fileName} ${sizeText}` : `${label} ${sizeText}`;
}

/**
 * 문자열 길이 푸터 — URL/SVG XML처럼 문자 수가 자연스러운 입력에 사용한다.
 */
function footerLength(label: string, length: number): string {
  return `${label} ${length}자`;
}

/**
 * Data URL 길이 푸터 — 문자열이 매우 길어지므로 KB 단위(문자 수 기준)로 환산해 표시한다.
 */
function footerLengthBytes(label: string, length: number): string {
  return `${label} ${(length / 1024).toFixed(1)} KB(문자)`;
}

/**
 * HTMLImageElement 푸터 — naturalWidth × naturalHeight를 그대로 노출한다.
 *
 * Image 입력은 바이트 정보가 없으므로 디코드된 픽셀 치수를 보여준다.
 */
function footerDimensions(width: number, height: number): string {
  return `Image ${width}×${height}px`;
}

/**
 * 바이트 수를 사람이 읽기 쉬운 단위 문자열로 변환한다(1KB 미만은 B, 1MB 미만은 KB, 그 외 MB).
 */
function formatBytes(byteLength: number): string {
  if (byteLength < 1024) {
    return `${byteLength} B`;
  }
  if (byteLength < 1024 * 1024) {
    return `${(byteLength / 1024).toFixed(1)} KB`;
  }
  return `${(byteLength / (1024 * 1024)).toFixed(2)} MB`;
}
