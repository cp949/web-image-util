/**
 * SVG Browser Compatibility Utilities
 * - Focus on rendering compatibility while preserving original intent.
 * - Never overwrite existing semantics (viewBox/width/height/preserveAspectRatio/xmlns*).
 */

/**
 * SVG 호환성 향상을 위한 옵션
 *
 * @description 브라우저 간 SVG 렌더링 호환성을 위한 설정 옵션들
 * 원본 SVG의 의미를 보존하면서 렌더링 호환성을 높입니다.
 */
export interface SvgCompatibilityOptions {
  /** 기본 크기(마땅한 크기 단서를 못 찾을 때, preserve-framing 모드에서 viewBox W/H 추정치) */
  defaultSize?: { width: number; height: number };
  /** 네임스페이스 자동 추가 여부 */
  addNamespaces?: boolean;
  /** 크기 속성/좌표계 보정 여부(viewBox 생성 등) */
  fixDimensions?: boolean;
  /** 구형 문법 현대화(xlink:href→href) */
  modernizeSyntax?: boolean;
  /** preserveAspectRatio 기본값 추가 */
  addPreserveAspectRatio?: boolean;

  /** 반응형 선호(기본 true): true면 width/height를 가능하면 주입하지 않음 */
  preferResponsive?: boolean;

  /**
   * viewBox 정책
   * - preserve-framing: 원점 0,0로 두고 W×H 추정(원본 프레이밍 보존)
   * - fit-content: 실제 내용 bbox로 딱 맞춤(필요 시 패딩)
   */
  mode?: 'preserve-framing' | 'fit-content';

  /** fit-content 모드에서 여유 패딩 비율(0.02=2%) */
  paddingPercent?: number;

  /**
   * 브라우저 환경에서 실제 레이아웃 기반 BBox(getBBox) 사용(기본 false)
   * - DOMParser 결과를 hidden SVG 트리에 붙여서 계산
   * - SSR/Node에서는 자동 비활성
   */
  enableLiveBBox?: boolean;

  /**
   * 휴리스틱 BBox 허용(기본 true)
   * - getBBox를 못 쓰는 환경에서 rect/circle/ellipse/line/poly* 정도만 근사 계산
   * - path/text 등은 보수적으로 무시(필요 시 paddingPercent로 안전 여백)
   */
  enableHeuristicBBox?: boolean;

  /**
   * 0×0 방지 및 콘텐츠 기반 크기 계산:
   * 1) viewBox만 있고 width/height 없을 때 viewBox W/H를 width/height로 주입
   * 2) preserve-framing 모드에서도 콘텐츠 기반 viewBox 계산 시도
   *
   * 기본값:
   * - preserve-framing 모드: false (defaultSize 512×512 사용)
   * - fit-content 모드: true (항상 콘텐츠 기반 계산)
   *
   * true 설정 시: 실제 콘텐츠 크기에 맞는 viewBox 생성 시도
   * false 설정 시: defaultSize 기반 고정 크기 viewBox 사용
   */
  ensureNonZeroViewport?: boolean;
}

/**
 * SVG 호환성 처리 결과 보고서
 *
 * @description SVG 호환성 처리 과정에서 수행된 작업들과 결과를 담은 보고서
 * 디버깅과 최적화에 유용한 정보를 제공합니다.
 */
export interface SvgCompatibilityReport {
  addedNamespaces: string[];
  fixedDimensions: boolean;
  modernizedSyntax: number;
  warnings: string[]; // 처리상 주의
  infos?: string[]; // 참고 정보
  processingTimeMs: number;
}

const DEFAULT_OPTIONS: Required<Omit<SvgCompatibilityOptions, 'defaultSize' | 'paddingPercent'>> & {
  defaultSize: { width: number; height: number };
  paddingPercent: number;
} = {
  defaultSize: { width: 512, height: 512 },
  addNamespaces: true,
  fixDimensions: true,
  modernizeSyntax: true,
  addPreserveAspectRatio: true,
  preferResponsive: true,
  mode: 'preserve-framing',
  paddingPercent: 0.0,
  enableLiveBBox: false,
  enableHeuristicBBox: true,
  ensureNonZeroViewport: true,
};

/**
 * SVG 브라우저 호환성 향상
 *
 * @description SVG 문자열을 브라우저 간 호환성을 위해 최적화합니다.
 * 네임스페이스 추가, 크기 속성 보정, 구형 문법 현대화 등을 수행합니다.
 *
 * @param svgString 원본 SVG 문자열
 * @param options 호환성 처리 옵션
 * @returns 향상된 SVG 문자열과 처리 보고서
 *
 * @example
 * ```typescript
 * // 기본 호환성 향상
 * const result = enhanceBrowserCompatibility(svgString);
 * console.log(result.enhancedSvg);
 * console.log(result.report.warnings);
 *
 * // 특정 모드로 처리
 * const result = enhanceBrowserCompatibility(svgString, {
 *   mode: 'fit-content',
 *   ensureNonZeroViewport: true
 * });
 * ```
 */
export function enhanceBrowserCompatibility(
  svgString: string,
  options: SvgCompatibilityOptions = {}
): { enhancedSvg: string; report: SvgCompatibilityReport } {
  // 모드에 따른 스마트 기본값 설정
  const mode = options.mode ?? DEFAULT_OPTIONS.mode;
  const smartDefaults = {
    ...DEFAULT_OPTIONS,
    // preserve-framing 모드에서는 defaultSize로 이미 0×0 방지됨
    // 하지만 사용자가 명시적으로 설정한 경우는 우선 적용
    ensureNonZeroViewport:
      options.ensureNonZeroViewport !== undefined
        ? options.ensureNonZeroViewport
        : mode === 'preserve-framing'
          ? false
          : true,
  };

  const opts = { ...smartDefaults, ...options };
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();
  const t0 = now();

  const report: SvgCompatibilityReport = {
    addedNamespaces: [],
    fixedDimensions: false,
    modernizedSyntax: 0,
    warnings: [],
    infos: [],
    processingTimeMs: 0,
  };

  // Parse
  let doc: Document;
  try {
    if (typeof DOMParser === 'undefined') {
      report.warnings.push('DOMParser is not available. Returning original SVG.');
      return finalize(svgString, report, now(), t0);
    }
    doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      report.warnings.push('XML parse error detected. Returning original SVG.');
      return finalize(svgString, report, now(), t0);
    }
  } catch (e) {
    report.warnings.push(`DOMParser failed: ${toMsg(e)}. Returning original SVG.`);
    return finalize(svgString, report, now(), t0);
  }

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    report.warnings.push('Root element is not <svg>. Returning original SVG.');
    return finalize(svgString, report, now(), t0);
  }

  try {
    // 1) Namespaces
    if (opts.addNamespaces) addRequiredNamespaces(root, report);

    // 2) Syntax modernization
    if (opts.modernizeSyntax) modernizeSvgSyntax(root, report);

    // 3) preserveAspectRatio
    if (opts.addPreserveAspectRatio) addPAR(root);

    // 4) Dimensions / viewBox policy
    if (opts.fixDimensions) {
      applyViewBoxPolicy(root, opts, report, svgString);
    }

    const enhancedSvg = new XMLSerializer().serializeToString(doc);
    return finalize(enhancedSvg, report, now(), t0);
  } catch (e) {
    report.warnings.push(`Processing error: ${toMsg(e)}. Returned original SVG.`);
    return finalize(svgString, report, now(), t0);
  }
}

/* --------------------------------- Helpers -------------------------------- */

function finalize(svg: string, report: SvgCompatibilityReport, t1: number, t0: number) {
  report.processingTimeMs = Math.max(0, t1 - t0);
  return { enhancedSvg: svg, report };
}

function toMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/** Add xmlns + xmlns:xlink(if needed). Never overwrite existing. */
function addRequiredNamespaces(root: Element, report: SvgCompatibilityReport) {
  const added: string[] = [];
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    added.push('svg');
  }
  const usesXlink = !!(root.querySelector('[xlink\\:href]') || root.querySelector('[*|href]:not([href])'));
  if (usesXlink && !root.getAttribute('xmlns:xlink')) {
    root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    added.push('xlink');
  }
  report.addedNamespaces = added;
}

/** xlink:href -> href (if href absent). */
function modernizeSvgSyntax(root: Element, report: SvgCompatibilityReport) {
  let count = 0;
  const nodes = root.querySelectorAll('[xlink\\:href]');
  nodes.forEach((el) => {
    const xlink = el.getAttribute('xlink:href');
    if (!xlink) return;
    const href = el.getAttribute('href');
    if (!href) {
      el.setAttribute('href', xlink);
      el.removeAttribute('xlink:href');
      count++;
    }
  });
  report.modernizedSyntax = count;
}

/** Add preserveAspectRatio default if missing. */
function addPAR(root: Element) {
  if (!root.getAttribute('preserveAspectRatio')) {
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
}

/** CSS length parser: returns (value, unit). Accepts -num, decimals, scientific, unit or %. */
function parseCssLength(input?: string | null): { value: number | null; unit: string | null } {
  if (!input) return { value: null, unit: null };
  const s = String(input).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?(?:e-?\d+)?)([a-z%]*)$/i);
  if (!m) return { value: null, unit: null };
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return { value: null, unit: null };
  const unit = m[2] ? m[2].toLowerCase() : null; // 단위 없음은 user unit
  return { value: num, unit };
}

/** Extract width/height from attributes or style. */
function extractSizeHints(root: Element): { wAttr?: string; hAttr?: string } {
  const wAttr = root.getAttribute('width') ?? getStyleLength(root, 'width') ?? undefined;
  const hAttr = root.getAttribute('height') ?? getStyleLength(root, 'height') ?? undefined;
  return { wAttr, hAttr };
}

function getStyleLength(el: Element, prop: 'width' | 'height'): string | null {
  const style = el.getAttribute('style');
  if (!style) return null;
  const m = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m?.[1]?.trim() ?? null;
}

/** Main policy for setting viewBox (and possibly width/height). */
function applyViewBoxPolicy(
  root: Element,
  opts: Required<SvgCompatibilityOptions>,
  report: SvgCompatibilityReport,
  svgString: string
) {
  const hasVB = root.hasAttribute('viewBox');
  const hasW = root.hasAttribute('width') || !!getStyleLength(root, 'width');
  const hasH = root.hasAttribute('height') || !!getStyleLength(root, 'height');

  // viewBox 이미 있는 경우: 덮어쓰지 않음
  if (hasVB) {
    // 0×0 방지: 크기 단서 전혀 없고 ensureNonZeroViewport=true → viewBox의 W/H 사용
    if (opts.ensureNonZeroViewport && !hasW && !hasH) {
      const vb = root.getAttribute('viewBox')!;
      const [, , rawW, rawH] = vb.split(/[\s,]+/).map(Number);
      // viewBox가 0 또는 음수여도 안전값으로 보정
      const W = rawW > 0 ? rawW : opts.defaultSize.width;
      const H = rawH > 0 ? rawH : opts.defaultSize.height;
      root.setAttribute('width', String(W));
      root.setAttribute('height', String(H));
      report.infos?.push('Injected width/height from existing viewBox (coerced to non-zero).');
    }
    report.infos?.push('viewBox exists; preserved.');
    report.fixedDimensions = true;
    return;
  }

  // width/height 힌트 파싱
  const { wAttr, hAttr } = extractSizeHints(root);
  const { value: wVal, unit: wUnit } = parseCssLength(wAttr);
  const { value: hVal, unit: hUnit } = parseCssLength(hAttr);
  const wIsPxLike = wVal != null && (!wUnit || wUnit === 'px');
  const hIsPxLike = hVal != null && (!hUnit || hUnit === 'px');

  // 안전 주입 헬퍼
  const setVB = (minX: number, minY: number, rawW: number, rawH: number) => {
    // 0 또는 음수는 기본 크기로 보정
    const W = rawW > 0 ? rawW : opts.defaultSize.width;
    const H = rawH > 0 ? rawH : opts.defaultSize.height;

    root.setAttribute('viewBox', `${sanitizeNum(minX)} ${sanitizeNum(minY)} ${sanitizeNum(W)} ${sanitizeNum(H)}`);

    const hasAttrW = root.hasAttribute('width');
    const hasAttrH = root.hasAttribute('height');
    const styleW = getStyleLength(root, 'width');
    const styleH = getStyleLength(root, 'height');
    const noAnySize = !hasAttrW && !hasAttrH && !styleW && !styleH;

    if (!opts.preferResponsive) {
      if (!hasAttrW) root.setAttribute('width', String(W));
      if (!hasAttrH) root.setAttribute('height', String(H));
    } else if (opts.ensureNonZeroViewport && noAnySize) {
      // 반응형 선호라도 최소 크기 주입(0×0 방지)
      root.setAttribute('width', String(W));
      root.setAttribute('height', String(H));
      report.infos?.push('Injected width/height from viewBox (coerced to non-zero).');
    }
    report.fixedDimensions = true;
  };

  // Case A) 숫자형 width/height 둘 다 있는 경우
  if (wIsPxLike && hIsPxLike) {
    if (opts.mode === 'preserve-framing') {
      setVB(0, 0, wVal!, hVal!); // 내부에서 0 보정
      return;
    } else {
      // fit-content
      const bbox = computeBBox(root, opts, report, svgString) ?? { minX: 0, minY: 0, width: wVal!, height: hVal! };
      const padded = padBBox(bbox, opts.paddingPercent);
      setVB(padded.minX, padded.minY, padded.width, padded.height);
      return;
    }
  }

  // Case B) 하나만 있거나 비픽셀 단위 → defaultSize로
  if ((wAttr || hAttr) && (!wIsPxLike || !hIsPxLike)) {
    report.warnings.push('Non-px or partial size detected. Falling back to defaultSize for viewBox.');
  }

  // Case C) 힌트 없음 → 모드에 따라 처리
  if (opts.mode === 'fit-content' || opts.ensureNonZeroViewport) {
    // fit-content 모드이거나 ensureNonZeroViewport=true이면 콘텐츠 기반 계산 시도
    const bbox = computeBBox(root, opts, report, svgString);
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const padded = padBBox(bbox, opts.paddingPercent);
      setVB(padded.minX, padded.minY, padded.width, padded.height);
      return;
    }
    // Debug: bbox 계산 결과 확인
    report.warnings.push(
      `Content bbox unavailable (${bbox ? `${bbox.width}x${bbox.height}` : 'null'}). Falling back to defaultSize.`
    );
  }

  // Fallback: preserve-framing + defaultSize
  setVB(0, 0, opts.defaultSize.width, opts.defaultSize.height);
}

/** Sanitize number to avoid scientific notation in attributes. */
function sanitizeNum(n: number) {
  return Number.isFinite(n) ? parseFloat(n.toFixed(6)) : 0;
}

/** Compute bbox: try live getBBox when enabled; else heuristic if allowed; otherwise null. */
function heuristicBBoxFromString(
  svgString: string
): { minX: number; minY: number; width: number; height: number } | null {
  let minX = +Infinity,
    minY = +Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const push = (x1: number, y1: number, x2: number, y2: number) => {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  };

  // circle 정규표현식으로 찾기
  const circleRegex =
    /<circle[^>]*cx=["']?([^"'\s]+)["']?[^>]*cy=["']?([^"'\s]+)["']?[^>]*r=["']?([^"'\s]+)["']?[^>]*\/?>/gi;
  let circleMatch;
  while ((circleMatch = circleRegex.exec(svgString)) !== null) {
    const cx = parseFloat(circleMatch[1]);
    const cy = parseFloat(circleMatch[2]);
    const r = parseFloat(circleMatch[3]);
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
  }

  // rect 정규표현식으로 찾기
  const rectRegex =
    /<rect[^>]*x=["']?([^"'\s]+)["']?[^>]*y=["']?([^"'\s]+)["']?[^>]*width=["']?([^"'\s]+)["']?[^>]*height=["']?([^"'\s]+)["']?[^>]*\/?>/gi;
  let rectMatch;
  while ((rectMatch = rectRegex.exec(svgString)) !== null) {
    const x = parseFloat(rectMatch[1]);
    const y = parseFloat(rectMatch[2]);
    const w = parseFloat(rectMatch[3]);
    const h = parseFloat(rectMatch[4]);
    if (w > 0 && h > 0) push(x, y, x + w, y + h);
  }

  if (minX === +Infinity || minY === +Infinity || maxX === -Infinity || maxY === -Infinity) {
    return null;
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function computeBBox(
  root: Element,
  opts: Required<SvgCompatibilityOptions>,
  report: SvgCompatibilityReport,
  svgString?: string
): { minX: number; minY: number; width: number; height: number } | null {
  // 1) Live getBBox (browser only)
  if (opts.enableLiveBBox && isBrowser() && typeof (window as any).SVGSVGElement !== 'undefined') {
    try {
      const result = liveGetBBox(root as unknown as SVGSVGElement);
      if (result) {
        report.infos?.push('BBox computed via live getBBox.');
        return result;
      }
      report.warnings.push('Live getBBox returned empty.');
    } catch (e) {
      report.warnings.push(`Live getBBox failed: ${toMsg(e)}`);
    }
  }

  // 2) Heuristic bbox
  if (opts.enableHeuristicBBox) {
    const hb = heuristicBBox(root);
    if (hb) {
      report.infos?.push('BBox computed via heuristic scan.');
      return hb;
    }
    // 2.1) Fallback: string-based heuristic (for environments with DOM parsing issues)
    if (svgString) {
      const stringHb = heuristicBBoxFromString(svgString);
      if (stringHb) {
        report.infos?.push('BBox computed via string-based heuristic.');
        return stringHb;
      }
    }
  }

  // 3) None
  return null;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Attach to hidden SVG in DOM and compute getBBox result. */
function liveGetBBox(parsedRoot: SVGSVGElement): { minX: number; minY: number; width: number; height: number } | null {
  const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmpSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  tmpSvg.setAttribute('width', '0');
  tmpSvg.setAttribute('height', '0');
  tmpSvg.style.position = 'absolute';
  tmpSvg.style.left = '-99999px';
  tmpSvg.style.top = '-99999px';
  tmpSvg.style.opacity = '0';
  document.body.appendChild(tmpSvg);

  const imported = document.importNode(parsedRoot, true) as SVGSVGElement;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  imported.removeAttribute('width');
  imported.removeAttribute('height');
  if (!imported.hasAttribute('viewBox')) imported.setAttribute('viewBox', '0 0 100000 100000');
  while (imported.firstChild) g.appendChild(imported.firstChild);
  tmpSvg.appendChild(g);

  try {
    const bb = (g as unknown as SVGGraphicsElement).getBBox();
    const res = { minX: bb.x, minY: bb.y, width: bb.width, height: bb.height };
    return isValidBBox(res) ? res : null;
  } finally {
    document.body.removeChild(tmpSvg);
  }
}

function isValidBBox(b: { minX: number; minY: number; width: number; height: number }) {
  return Number.isFinite(b.minX) && Number.isFinite(b.minY) && b.width > 0 && b.height > 0;
}

/**
 * Heuristic bbox:
 * - Supports: rect, circle, ellipse, line, polyline, polygon
 * - Ignores: path, text, filters, markers (use padding if needed)
 */
function heuristicBBox(root: Element): { minX: number; minY: number; width: number; height: number } | null {
  let minX = +Infinity,
    minY = +Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const push = (x1: number, y1: number, x2: number, y2: number) => {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  };

  // rect
  root.querySelectorAll('rect').forEach((el) => {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w > 0 && h > 0) push(x, y, x + w, y + h);
  });

  // circle
  root.querySelectorAll('circle').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const r = parseFloat(el.getAttribute('r') || '0');
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
  });

  // ellipse
  root.querySelectorAll('ellipse').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    if (rx > 0 && ry > 0) push(cx - rx, cy - ry, cx + rx, cy + ry);
  });

  // line
  root.querySelectorAll('line').forEach((el) => {
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    push(x1, y1, x2, y2);
  });

  // polyline/polygon
  const scanPoints = (el: Element) => {
    const pts = (el.getAttribute('points') || '').trim();
    if (!pts) return;
    // Parse points string: "x1,y1 x2,y2" or "x1 y1 x2 y2"
    const numbers = pts
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(parseFloat);
    for (let i = 0; i < numbers.length - 1; i += 2) {
      const x = numbers[i],
        y = numbers[i + 1];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        push(x, y, x, y);
      }
    }
  };
  root.querySelectorAll('polyline').forEach(scanPoints);
  root.querySelectorAll('polygon').forEach(scanPoints);

  if (minX === +Infinity || minY === +Infinity || maxX === -Infinity || maxY === -Infinity) {
    return null;
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function padBBox(b: { minX: number; minY: number; width: number; height: number }, pct: number) {
  if (!pct || pct <= 0) return b;
  const dx = b.width * pct;
  const dy = b.height * pct;
  return { minX: b.minX - dx, minY: b.minY - dy, width: b.width + 2 * dx, height: b.height + 2 * dy };
}

/* ----------------------------- Simple facade ------------------------------ */

/**
 * SVG 기본 정규화 (이미지 리사이저용)
 *
 * @description 이미지 리사이저에서 SVG를 처리하기 위한 기본적인 정규화를 수행합니다.
 * Canvas 렌더링에 최적화된 옵션으로 SVG를 정규화합니다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 정규화된 SVG 문자열
 *
 * @example
 * ```typescript
 * // SVG를 Canvas 렌더링용으로 정규화
 * const normalizedSvg = normalizeSvgBasics(svgString);
 *
 * // 정규화된 SVG를 이미지로 변환
 * const result = await processImage(normalizedSvg)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 * ```
 */
export function normalizeSvgBasics(svgString: string): string {
  const { enhancedSvg } = enhanceBrowserCompatibility(svgString, {
    // === 필수 호환성 ===
    addNamespaces: true, // 브라우저 호환성 필수
    fixDimensions: true, // Canvas 렌더링을 위해 필요
    modernizeSyntax: true, // xlink → href 현대화
    addPreserveAspectRatio: true, // 비율 유지 보장

    // === 크기 처리 전략 ===
    mode: 'fit-content', // 콘텐츠에 정확히 맞춤 (리사이저에 적합)
    ensureNonZeroViewport: true, // 0×0 렌더링 방지
    paddingPercent: 0, // 패딩 없음 - 정확한 크기

    // === 성능 최적화 ===
    preferResponsive: false, // Canvas 렌더링에서는 고정 크기 필요
    enableLiveBBox: true, // 브라우저에서 정확한 크기 계산
    enableHeuristicBBox: true, // Node.js 환경 대응
  });
  return enhancedSvg;
}
