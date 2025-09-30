/**
 * trim-empty.ts
 * Canvas에서 빈 공간(배경색 또는 투명)을 자동으로 제거하는 유틸리티
 */

/**
 * 트림 경계 정보를 나타내는 인터페이스
 */
export interface TrimBounds {
  /** 콘텐츠 영역의 왼쪽 경계 (x좌표) */
  left: number;
  /** 콘텐츠 영역의 위쪽 경계 (y좌표) */
  top: number;
  /** 콘텐츠 영역의 오른쪽 경계 (x좌표) */
  right: number;
  /** 콘텐츠 영역의 아래쪽 경계 (y좌표) */
  bottom: number;
  /** 콘텐츠 영역의 너비 */
  width: number;
  /** 콘텐츠 영역의 높이 */
  height: number;
}

/**
 * RGBA 색상 값을 나타내는 인터페이스
 */
export interface RGBA {
  /** Red 채널 (0-255) */
  r: number;
  /** Green 채널 (0-255) */
  g: number;
  /** Blue 채널 (0-255) */
  b: number;
  /** Alpha 채널 (0-255) */
  a: number;
}

/**
 * 배경색 문자열을 RGBA 객체로 파싱합니다.
 * 지원 형식: hex (#RGB, #RRGGBB), rgb/rgba, named colors
 *
 * @param backgroundColor 배경색 문자열 (CSS color, hex 등)
 * @returns RGBA 색상 객체 (기본값: 투명 검정)
 */
export function parseBackgroundColor(backgroundColor?: string): RGBA {
  // 기본값: 투명 검정 (alpha = 0)
  if (!backgroundColor) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const color = backgroundColor.trim().toLowerCase();

  // Hex 형식: #RGB, #RRGGBB, #RRGGBBAA
  if (color.startsWith('#')) {
    const hex = color.substring(1);

    // #RGB 형식 (짧은 형식)
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 255 };
    }

    // #RRGGBB 형식
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return { r, g, b, a: 255 };
    }

    // #RRGGBBAA 형식
    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const a = parseInt(hex.substring(6, 8), 16);
      return { r, g, b, a };
    }
  }

  // rgba() 또는 rgb() 형식
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 255) : 255;
    return { r, g, b, a };
  }

  // Named colors: 자주 쓰이는 색상들만 지원
  const namedColors: Record<string, RGBA> = {
    transparent: { r: 0, g: 0, b: 0, a: 0 },
    white: { r: 255, g: 255, b: 255, a: 255 },
    black: { r: 0, g: 0, b: 0, a: 255 },
    red: { r: 255, g: 0, b: 0, a: 255 },
    green: { r: 0, g: 128, b: 0, a: 255 },
    blue: { r: 0, g: 0, b: 255, a: 255 },
  };

  if (color in namedColors) {
    return namedColors[color];
  }

  // Canvas를 사용한 fallback 파싱
  // 브라우저가 알아서 파싱해주도록 함
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const imageData = ctx.getImageData(0, 0, 1, 1);
      return {
        r: imageData.data[0],
        g: imageData.data[1],
        b: imageData.data[2],
        a: imageData.data[3],
      };
    }
  }

  // 파싱 실패 시 기본값 반환
  return { r: 0, g: 0, b: 0, a: 0 };
}

/**
 * 주어진 픽셀이 배경색인지 판단합니다.
 * 허용 오차를 적용하여 비교합니다.
 *
 * @param r Red 채널 값
 * @param g Green 채널 값
 * @param b Blue 채널 값
 * @param a Alpha 채널 값
 * @param bgColor 배경색 RGBA 객체
 * @param tolerance 허용 오차 (기본값: 5)
 * @returns 배경색과 일치하면 true
 */
export function isBackgroundPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  bgColor: RGBA,
  tolerance = 5
): boolean {
  return (
    Math.abs(r - bgColor.r) <= tolerance &&
    Math.abs(g - bgColor.g) <= tolerance &&
    Math.abs(b - bgColor.b) <= tolerance &&
    Math.abs(a - bgColor.a) <= tolerance
  );
}

/**
 * Canvas에서 비어있지 않은 영역의 경계를 찾습니다.
 * 픽셀별로 스캔하여 배경색이 아닌 픽셀들의 최소/최대 좌표를 찾습니다.
 *
 * @param canvas 분석할 캔버스
 * @param backgroundColor 배경색 (투명도 포함)
 * @returns 비어있지 않은 영역의 경계 정보
 */
export function findContentBounds(
  canvas: HTMLCanvasElement,
  backgroundColor?: string
): TrimBounds {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot get canvas context');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const bgColor = parseBackgroundColor(backgroundColor);

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  // 픽셀별로 스캔하여 콘텐츠 영역 찾기
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // 배경색이나 투명 픽셀이 아닌 경우
      if (!isBackgroundPixel(r, g, b, a, bgColor)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 콘텐츠가 없는 경우 전체 영역 반환
  if (minX >= maxX || minY >= maxY) {
    return {
      left: 0,
      top: 0,
      right: canvas.width,
      bottom: canvas.height,
      width: canvas.width,
      height: canvas.height,
    };
  }

  return {
    left: minX,
    top: minY,
    right: maxX + 1,
    bottom: maxY + 1,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * 지정된 영역으로 캔버스를 크롭합니다.
 *
 * @param canvas 원본 캔버스
 * @param bounds 크롭할 영역
 * @returns 크롭된 새 캔버스
 */
export function cropCanvas(canvas: HTMLCanvasElement, bounds: TrimBounds): HTMLCanvasElement {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = bounds.width;
  newCanvas.height = bounds.height;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot create new canvas context');
  }

  // 원본 캔버스에서 지정된 영역을 새 캔버스로 복사
  ctx.drawImage(
    canvas,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  return newCanvas;
}

/**
 * trimEmpty 기능 통합 함수
 * Canvas에서 빈 공간(배경색 또는 투명)을 자동으로 제거합니다.
 *
 * @param canvas 처리할 캔버스
 * @param backgroundColor 배경색 (지정하지 않으면 투명 영역을 기준으로 트림)
 * @returns 트림된 캔버스 (트림할 공간이 없으면 원본 반환)
 */
export function trimEmptySpace(
  canvas: HTMLCanvasElement,
  backgroundColor?: string
): HTMLCanvasElement {
  const bounds = findContentBounds(canvas, backgroundColor);

  // 트림할 공간이 없으면 원본 반환
  if (
    bounds.left === 0 &&
    bounds.top === 0 &&
    bounds.width === canvas.width &&
    bounds.height === canvas.height
  ) {
    return canvas;
  }

  return cropCanvas(canvas, bounds);
}