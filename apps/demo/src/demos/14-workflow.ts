import type { OutputFormat } from '@cp949/web-image-util';
import { processImage } from '@cp949/web-image-util';

export const meta = {
  title: '14. 실전 워크플로',
  description:
    '파일 업로드 또는 샘플 선택 → resize(maxFit) → 포맷·품질 선택 → 미리보기 → 다운로드까지 ' +
    '라이브러리를 실제 앱에 통합하는 엔드 투 엔드 흐름을 한 페이지에서 시연한다.',
};

/**
 * 컨트롤 묶음 — setupControls가 생성한 DOM 핸들을 한 곳에 모은다.
 *
 * reprocess / renderResult / 다운로드 핸들러가 공통으로 참조한다.
 */
interface Controls {
  /** 가로 픽셀 슬라이더 (maxFit width). */
  readonly widthInput: HTMLInputElement;
  /** 가로 픽셀 라벨 — 슬라이더 옆에서 즉시 갱신된다. */
  readonly widthLabel: HTMLElement;
  /** 출력 포맷 선택 (webp/jpeg/png). */
  readonly formatSelect: HTMLSelectElement;
  /** 품질 슬라이더 — PNG일 때는 disabled. */
  readonly qualityInput: HTMLInputElement;
  /** 품질 라벨. */
  readonly qualityLabel: HTMLElement;
  /** 결과 미리보기 이미지. */
  readonly previewImg: HTMLImageElement;
  /** 결과 메타 한 줄("FORMAT, WxH, NN.N KB, ETC"). */
  readonly previewMeta: HTMLElement;
  /** 상태/에러 메시지 영역. */
  readonly status: HTMLElement;
  /** 다운로드 버튼. */
  readonly downloadButton: HTMLButtonElement;
}

// 모듈 단위 상태 — 단일 인스턴스 데모이므로 클로저 변수로 둔다.
let currentInput: Blob | null = null;
let currentResult: { blob: Blob; format: OutputFormat; width: number; height: number } | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentObjectURL: string | null = null;

export async function run(target: HTMLElement): Promise<void> {
  // 페이지 재진입 시 잔존 상태 초기화 — DemoPage가 매번 새 target을 주지만 모듈 변수는 살아있다.
  currentInput = null;
  currentResult = null;
  debounceTimer = null;
  currentObjectURL = null;

  const controls = setupControls(target);

  // 파일 입력 — 선택 즉시 currentInput 갱신 후 reprocess.
  // 디바운싱은 적용하지 않는다(슬라이더와 달리 의도적 1회 액션).
  const fileInput = target.querySelector<HTMLInputElement>('input[type="file"]');
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    currentInput = file;
    void reprocess(controls);
  });

  // 샘플 버튼 — fetch → Blob → reprocess.
  target.querySelectorAll<HTMLButtonElement>('button[data-sample]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.sample;
      if (!url) return;
      try {
        currentInput = await buildSample(url);
        await reprocess(controls);
      } catch (err) {
        showError(controls, `샘플 로드 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  });

  // 슬라이더/셀렉트 변경 — 라벨은 즉시 갱신, 처리는 150ms 디바운스.
  controls.widthInput.addEventListener('input', () => {
    controls.widthLabel.textContent = `가로(px): ${controls.widthInput.value}`;
    scheduleReprocess(controls);
  });
  controls.qualityInput.addEventListener('input', () => {
    controls.qualityLabel.textContent = `품질: ${Number(controls.qualityInput.value).toFixed(2)}`;
    scheduleReprocess(controls);
  });
  controls.formatSelect.addEventListener('change', () => {
    // PNG는 quality 무시 — UX적으로 비활성화한다.
    controls.qualityInput.disabled = controls.formatSelect.value === 'png';
    scheduleReprocess(controls);
  });

  // 다운로드 버튼 — currentResult가 있을 때만 활성.
  controls.downloadButton.addEventListener('click', () => {
    if (!currentResult) return;
    triggerDownload(currentResult.blob, currentResult.format);
  });
}

/**
 * UI 골격 생성 — 4개 카드(입력/컨트롤/미리보기/액션)를 위→아래 한 컬럼으로 쌓는다.
 */
function setupControls(target: HTMLElement): Controls {
  // 안내 한 줄.
  const note = document.createElement('div');
  note.textContent = '이미지를 선택하거나 샘플 버튼을 누르세요';
  note.style.cssText = 'font-size:12px;color:#555;margin-bottom:12px';
  target.append(note);

  // 카드 컨테이너 — 세로 단일 컬럼.
  const stack = document.createElement('div');
  stack.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  target.append(stack);

  // A. 입력 영역.
  const inputCard = cardShell('A. 입력');
  const fileRow = document.createElement('div');
  fileRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileRow.append(fileInput);
  for (const sample of [
    { label: '사진 샘플', url: '/samples/photo.jpg' },
    { label: '랜드스케이프 샘플', url: '/samples/landscape.jpg' },
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = sample.label;
    b.dataset.sample = sample.url;
    b.style.cssText = 'padding:4px 10px;font-size:12px;cursor:pointer';
    fileRow.append(b);
  }
  inputCard.append(fileRow);
  stack.append(inputCard);

  // B. 컨트롤 영역.
  const controlCard = cardShell('B. 컨트롤');
  const controlRow = document.createElement('div');
  controlRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:16px;align-items:center';

  // 가로 슬라이더.
  const widthBox = document.createElement('div');
  widthBox.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:220px';
  const widthLabel = document.createElement('label');
  widthLabel.textContent = '가로(px): 600';
  widthLabel.style.cssText = 'font-size:12px;color:#444';
  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.min = '100';
  widthInput.max = '1600';
  widthInput.value = '600';
  widthBox.append(widthLabel, widthInput);

  // 포맷 셀렉트.
  const formatBox = document.createElement('div');
  formatBox.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  const formatLabel = document.createElement('label');
  formatLabel.textContent = '포맷';
  formatLabel.style.cssText = 'font-size:12px;color:#444';
  const formatSelect = document.createElement('select');
  for (const opt of [
    { value: 'webp', label: 'WebP' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
  ]) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    formatSelect.append(o);
  }
  formatBox.append(formatLabel, formatSelect);

  // 품질 슬라이더.
  const qualityBox = document.createElement('div');
  qualityBox.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:200px';
  const qualityLabel = document.createElement('label');
  qualityLabel.textContent = '품질: 0.85';
  qualityLabel.style.cssText = 'font-size:12px;color:#444';
  const qualityInput = document.createElement('input');
  qualityInput.type = 'range';
  qualityInput.min = '0.1';
  qualityInput.max = '1.0';
  qualityInput.step = '0.05';
  qualityInput.value = '0.85';
  qualityBox.append(qualityLabel, qualityInput);

  controlRow.append(widthBox, formatBox, qualityBox);
  controlCard.append(controlRow);
  stack.append(controlCard);

  // C. 미리보기 영역.
  const previewCard = cardShell('C. 미리보기');
  const status = document.createElement('div');
  status.textContent = '입력을 선택하면 결과가 표시됩니다.';
  status.style.cssText = 'font-size:12px;color:#555';
  const previewImg = new Image();
  previewImg.alt = '결과 미리보기';
  previewImg.style.cssText = 'display:none;max-width:100%;height:auto;border-radius:4px;background:#f5f5f5';
  const previewMeta = document.createElement('div');
  previewMeta.style.cssText =
    'font-size:12px;color:#333;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all';
  previewCard.append(status, previewImg, previewMeta);
  stack.append(previewCard);

  // D. 액션 영역.
  const actionCard = cardShell('D. 액션');
  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.textContent = '다운로드';
  downloadButton.disabled = true;
  downloadButton.style.cssText = 'padding:6px 14px;font-size:13px;cursor:pointer';
  actionCard.append(downloadButton);
  stack.append(actionCard);

  return {
    widthInput,
    widthLabel,
    formatSelect,
    qualityInput,
    qualityLabel,
    previewImg,
    previewMeta,
    status,
    downloadButton,
  };
}

/**
 * 150ms 디바운스로 reprocess를 예약한다.
 *
 * 슬라이더 드래그 중 매 프레임 처리 호출을 피하기 위해 마지막 입력 후 일정 시간이 지난 뒤에만 실행한다.
 */
function scheduleReprocess(controls: Controls): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void reprocess(controls);
  }, 150);
}

/**
 * 메인 처리 흐름 — currentInput을 현재 컨트롤 값으로 변환한다.
 *
 * - 입력이 없으면 안내만 표시하고 종료.
 * - 처리 시작 시 상태를 "처리 중..."으로 갱신하고 다운로드 버튼을 잠근다.
 * - resize는 maxFit으로 width만 지정해 비율 유지 축소를 수행한다.
 * - PNG는 quality를 전달하지 않는다(라이브러리가 무시하지만 의도를 명시).
 */
async function reprocess(controls: Controls): Promise<void> {
  if (!currentInput) {
    controls.status.textContent = '입력을 선택하면 결과가 표시됩니다.';
    controls.status.style.color = '#555';
    return;
  }

  controls.status.textContent = '처리 중...';
  controls.status.style.color = '#555';
  controls.downloadButton.disabled = true;

  const width = Number(controls.widthInput.value);
  const format = controls.formatSelect.value as OutputFormat;
  const quality = Number(controls.qualityInput.value);

  try {
    const chain = processImage(currentInput).resize({ fit: 'maxFit', width });
    const result = format === 'png' ? await chain.toBlob({ format: 'png' }) : await chain.toBlob({ format, quality });
    // ResultBlob.format은 OutputFormat | undefined — 라이브러리가 실제 인코더가 폴백된 경우 다른 값을 반환할 수 있다.
    // 다운로드 확장자/표시는 실제 반환 포맷을 우선하되, 없으면 요청 포맷으로 폴백한다.
    const actualFormat: OutputFormat = result.format ?? format;
    renderResult(controls, result.blob, actualFormat, result.width, result.height);
  } catch (err) {
    showError(controls, `처리 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 처리 결과를 화면에 반영 + currentResult를 갱신한다.
 *
 * 이전 미리보기에 사용된 blob URL을 즉시 revoke해 누수를 막는다.
 */
function renderResult(controls: Controls, blob: Blob, format: OutputFormat, width: number, height: number): void {
  // 이전 blob URL revoke — DemoPage가 페이지 이동 시 한 번 더 revoke하지만 이중 안전망으로 둔다.
  if (currentObjectURL !== null) {
    URL.revokeObjectURL(currentObjectURL);
  }
  currentObjectURL = URL.createObjectURL(blob);

  controls.previewImg.src = currentObjectURL;
  controls.previewImg.style.display = 'block';
  controls.previewMeta.textContent = `${format.toUpperCase()}, ${width}x${height}, ${formatKB(blob.size)}, ${
    blob.type || '(미지정)'
  }`;
  controls.status.textContent = '완료';
  controls.status.style.color = '#0a6b2c';
  controls.downloadButton.disabled = false;

  currentResult = { blob, format, width, height };
}

/**
 * 처리 실패 시 빨간 메시지로 상태를 갱신하고 다운로드를 잠근다.
 */
function showError(controls: Controls, message: string): void {
  controls.status.textContent = message;
  controls.status.style.color = '#b42318';
  controls.downloadButton.disabled = true;
}

/**
 * 다운로드 트리거 — 임시 <a download> 엘리먼트로 click() 후 즉시 URL revoke.
 */
function triggerDownload(blob: Blob, format: OutputFormat): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `output-${Date.now()}${extensionFor(format)}`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 샘플 URL을 fetch해 Blob으로 변환한다.
 *
 * 응답이 OK가 아니면 상태 코드를 메시지에 담아 던진다.
 */
async function buildSample(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return await res.blob();
}

/**
 * OutputFormat을 다운로드 확장자로 매핑한다.
 *
 * jpg/jpeg는 동일하게 .jpg로 떨어진다.
 */
function extensionFor(format: OutputFormat): '.webp' | '.jpg' | '.png' {
  if (format === 'webp') return '.webp';
  if (format === 'png') return '.png';
  return '.jpg';
}

/**
 * 바이트 → "NN.N KB" 한 줄 포맷.
 */
function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * 공통 카드 골격 — 외곽 박스 + 굵은 헤더. 다른 데모와 시각적 일관성을 유지한다.
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
