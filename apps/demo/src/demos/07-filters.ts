import { processImage } from '@cp949/web-image-util';
// applyFilter는 ./advanced 서브패스, initializeFilterSystem은 ./filters 서브패스가 진입점이다.
import { applyFilter } from '@cp949/web-image-util/advanced';
import { initializeFilterSystem } from '@cp949/web-image-util/filters';

export const meta = {
  title: '07. Filters 카탈로그',
  description:
    'ImageData 단위로 동작하는 13종 필터(effect/blur/color 카테고리)를 그리드로 한눈에 비교한다. ' +
    '원본 캔버스를 한 번만 만든 뒤 ImageData를 기준 입력으로 재사용해 필터별 결과를 병렬로 생성한다.',
};

// 카탈로그용 셀 크기 — 모든 필터가 동일한 베이스 ImageData를 공유한다.
const CELL_WIDTH = 200;
const CELL_HEIGHT = 140;

/**
 * 필터별 의도 파라미터.
 *
 * brightness/contrast/saturation은 기본값 0이 "변화 없음"이므로
 * 데모 가시성을 위해 양수 값을 미리 지정한다. 그 외 필터는 라이브러리 기본값을 사용한다.
 */
const PARAMS = {
  grayscale: {},
  sepia: { intensity: 100 },
  invert: {},
  noise: { intensity: 10 },
  vignette: { intensity: 0.8, size: 0.5, blur: 0.5 },
  pixelate: { pixelSize: 8 },
  posterize: { levels: 8 },
  blur: { radius: 2 },
  sharpen: { amount: 50 },
  emboss: { strength: 1 },
  edgeDetection: { sensitivity: 1 },
  brightness: { value: 40 },
  contrast: { value: 40 },
  saturation: { value: 60 },
} as const;

// 표시 순서(카테고리별 묶음). 라이브러리 표면의 13개 필터를 그대로 노출한다.
const FILTER_ORDER: Array<keyof typeof PARAMS> = [
  'grayscale',
  'sepia',
  'invert',
  'noise',
  'vignette',
  'pixelate',
  'posterize',
  'blur',
  'sharpen',
  'emboss',
  'edgeDetection',
  'brightness',
  'contrast',
  'saturation',
];

export async function run(target: HTMLElement): Promise<void> {
  // 필터 플러그인 자동 등록은 제거되어 있어 명시적 초기화가 필요하다.
  // 내부적으로 중복 등록은 no-op로 처리된다.
  initializeFilterSystem();

  const sample = await (await fetch('/samples/photo.jpg')).blob();

  // resize는 체인당 1회만 — 베이스 캔버스를 한 번만 만든 뒤 ImageData를 재사용한다.
  const baseResult = await processImage(sample)
    .resize({ fit: 'cover', width: CELL_WIDTH, height: CELL_HEIGHT })
    .toCanvas();
  const baseCanvas = baseResult.canvas;

  // 베이스 ImageData를 한 번만 추출한다.
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    throw new Error('베이스 캔버스의 2D 컨텍스트를 얻지 못했습니다.');
  }
  const baseImageData = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);

  // 그리드 컨테이너.
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:12px';
  target.append(grid);

  // 원본 셀(맨 앞)을 즉시 표시한다.
  grid.append(await originalCell('원본 (resize cover 200×140)', baseCanvas));

  // 13개 필터를 병렬 처리한다. 개별 실패는 셀 단위로 격리한다.
  const cells = await Promise.all(FILTER_ORDER.map((name) => buildFilterCell(name, baseImageData)));
  for (const cell of cells) {
    grid.append(cell);
  }
}

/**
 * 원본 셀: 베이스 캔버스를 그대로 blob 변환해 <img>로 보여준다.
 *
 * toCanvas() 결과 캔버스는 사용자 소유이지만, 여기서는 표시 안정성을 위해 blob URL로 변환해
 * DemoPage의 일괄 revoke 흐름을 활용한다.
 */
async function originalCell(label: string, canvas: HTMLCanvasElement): Promise<HTMLElement> {
  const blob = await canvasToBlob(canvas);
  return imageCell(label, blob);
}

/**
 * 필터 셀: 베이스 ImageData에 필터를 적용한 뒤 결과를 새 캔버스에 putImageData → Blob → <img>로 표시.
 *
 * 개별 필터가 실패해도 다른 셀이 계속 그려지도록 셀 내부에서 에러를 잡는다.
 */
async function buildFilterCell(name: keyof typeof PARAMS, baseImageData: ImageData): Promise<HTMLElement> {
  const caption = `${name}\n${formatParams(PARAMS[name])}`;
  try {
    const result = applyFilter(baseImageData, {
      name,
      params: PARAMS[name],
    });

    // 결과 ImageData를 새 캔버스로 옮긴다.
    const out = document.createElement('canvas');
    out.width = result.width;
    out.height = result.height;
    const outCtx = out.getContext('2d');
    if (!outCtx) {
      throw new Error('출력 캔버스의 2D 컨텍스트를 얻지 못했습니다.');
    }
    outCtx.putImageData(result, 0, 0);

    const blob = await canvasToBlob(out);
    return imageCell(caption, blob);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorCell(caption, message);
  }
}

/**
 * 캔버스를 PNG Blob으로 직렬화한다. 필터 결과는 RGBA 픽셀 데이터이므로 PNG로 보관한다.
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('canvas.toBlob() 결과가 null입니다.'));
      }
    }, 'image/png');
  });
}

/**
 * 정상 결과 셀: 캡션 + 결과 이미지.
 */
function imageCell(label: string, blob: Blob): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid #e0e0e0;border-radius:8px;background:#fff';

  const cap = document.createElement('div');
  cap.textContent = label;
  cap.style.cssText =
    'font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-line;color:#333';

  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.alt = label;
  img.style.cssText = 'display:block;width:100%;height:auto;border-radius:4px';

  wrap.append(cap, img);
  return wrap;
}

/**
 * 에러 셀: 필터 실패 시 빨간색 메시지로 사유를 보여준다. 그리드는 계속 채워진다.
 */
function errorCell(label: string, message: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid #f5c2c7;border-radius:8px;background:#fff5f5';

  const cap = document.createElement('div');
  cap.textContent = label;
  cap.style.cssText =
    'font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-line;color:#333';

  const err = document.createElement('div');
  err.textContent = `필터 실패: ${message}`;
  err.style.cssText = 'font-size:12px;color:#b42318;word-break:break-word';

  wrap.append(cap, err);
  return wrap;
}

/**
 * 파라미터 객체를 한 줄 캡션 텍스트로 직렬화한다(빈 객체는 '-'로 표시).
 */
function formatParams(params: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) {
    return '-';
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(', ');
}
