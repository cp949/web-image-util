/**
 * SVG Browser Compatibility Utilities
 *
 * @description
 * Utility collection for improving cross-browser SVG rendering compatibility
 * - Focuses on rendering compatibility while preserving original SVG intent
 * - Does not overwrite existing semantic information (viewBox/width/height/preserveAspectRatio/xmlns*, etc.)
 * - Automatically supplements missing essential attributes
 */

/**
 * Options for SVG compatibility enhancement
 *
 * @description Configuration options for cross-browser SVG rendering compatibility
 * Enhances rendering compatibility while preserving original SVG semantics.
 */
export interface SvgCompatibilityOptions {
  /** Default size (viewBox W/H estimate in preserve-framing mode when no size clues are found) */
  defaultSize?: { width: number; height: number };
  /** Whether to automatically add namespaces */
  addNamespaces?: boolean;
  /** Whether to fix dimension attributes/coordinate system (viewBox generation, etc.) */
  fixDimensions?: boolean;
  /** Modernize legacy syntax (xlink:href→href) */
  modernizeSyntax?: boolean;
  /** Add default preserveAspectRatio */
  addPreserveAspectRatio?: boolean;

  /** Prefer responsive (default true): if true, avoid injecting width/height when possible */
  preferResponsive?: boolean;

  /**
   * viewBox policy
   * - preserve-framing: Keep origin at 0,0 and estimate W×H (preserve original framing)
   * - fit-content: Fit exactly to actual content bbox (with padding if needed)
   */
  mode?: 'preserve-framing' | 'fit-content';

  /** Padding percentage for fit-content mode (0.02=2%) */
  paddingPercent?: number;

  /**
   * Use actual layout-based BBox (getBBox) in browser environment (default false)
   * - Calculate by attaching DOMParser result to hidden SVG tree
   * - Automatically disabled in SSR/Node
   */
  enableLiveBBox?: boolean;

  /**
   * Allow heuristic BBox (default true)
   * - Approximate calculation for rect/circle/ellipse/line/poly* only in environments where getBBox is unavailable
   * - Conservatively ignore path/text etc. (use paddingPercent for safety margin if needed)
   */
  enableHeuristicBBox?: boolean;

  /**
   * Prevent 0×0 and content-based size calculation:
   * 1) When only viewBox exists without width/height, inject viewBox W/H as width/height
   * 2) Attempt content-based viewBox calculation even in preserve-framing mode
   *
   * Default values:
   * - preserve-framing mode: false (use defaultSize 512×512)
   * - fit-content mode: true (always content-based calculation)
   *
   * When set to true: Attempt to generate viewBox matching actual content size
   * When set to false: Use fixed-size viewBox based on defaultSize
   */
  ensureNonZeroViewport?: boolean;
}

/**
 * SVG compatibility processing result report
 *
 * @description Report containing operations performed and results during SVG compatibility processing
 * Provides useful information for debugging and optimization.
 */
export interface SvgCompatibilityReport {
  addedNamespaces: string[];
  fixedDimensions: boolean;
  modernizedSyntax: number;
  warnings: string[]; // Processing warnings
  infos?: string[]; // Reference information
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
 * Enhance SVG browser compatibility
 *
 * @description Optimizes SVG strings for cross-browser compatibility.
 * Performs namespace addition, dimension attribute correction, legacy syntax modernization, etc.
 *
 * @param svgString Original SVG string
 * @param options Compatibility processing options
 * @returns Enhanced SVG string and processing report
 *
 * @example
 * ```typescript
 * // Basic compatibility enhancement
 * const result = enhanceBrowserCompatibility(svgString);
 * console.log(result.enhancedSvg);
 * console.log(result.report.warnings);
 *
 * // Process with specific mode
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
  // Smart default settings based on mode
  const mode = options.mode ?? DEFAULT_OPTIONS.mode;
  const smartDefaults = {
    ...DEFAULT_OPTIONS,
    // In preserve-framing mode, 0×0 is already prevented by defaultSize
    // However, if user explicitly sets this option, prioritize user setting
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

/**
 * Add required namespaces
 * Add xmlns and xmlns:xlink (when needed) without overwriting existing settings
 */
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

/**
 * Modernize SVG syntax
 * Convert xlink:href to href (only when href is not present)
 */
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

/**
 * Add default preserveAspectRatio
 * Add default value when missing
 */
function addPAR(root: Element) {
  if (!root.getAttribute('preserveAspectRatio')) {
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
}

/**
 * CSS length value parser
 * @param input CSS length value string to parse
 * @returns Parsed numeric value and unit (value, unit)
 * @description Supports negative numbers, decimals, scientific notation, and units (%, px, etc.)
 */
function parseCssLength(input?: string | null): { value: number | null; unit: string | null } {
  if (!input) return { value: null, unit: null };
  const s = String(input).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?(?:e-?\d+)?)([a-z%]*)$/i);
  if (!m) return { value: null, unit: null };
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return { value: null, unit: null };
  const unit = m[2] ? m[2].toLowerCase() : null; // No unit means user unit
  return { value: num, unit };
}

/**
 * Extract size hints
 * Extract width/height values from SVG element attributes or styles
 */
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

/**
 * Apply viewBox policy
 * @description Main policy function that sets viewBox and optionally width/height as needed
 */
function applyViewBoxPolicy(
  root: Element,
  opts: Required<SvgCompatibilityOptions>,
  report: SvgCompatibilityReport,
  svgString: string
) {
  const hasVB = root.hasAttribute('viewBox');
  const hasW = root.hasAttribute('width') || !!getStyleLength(root, 'width');
  const hasH = root.hasAttribute('height') || !!getStyleLength(root, 'height');

  // If viewBox already exists: do not overwrite
  if (hasVB) {
    // Prevent 0×0: no size clues at all and ensureNonZeroViewport=true → use viewBox W/H
    if (opts.ensureNonZeroViewport && !hasW && !hasH) {
      const vb = root.getAttribute('viewBox')!;
      const [, , rawW, rawH] = vb.split(/[\s,]+/).map(Number);
      // Even if viewBox is 0 or negative, correct to safe values
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

  // Parse width/height hints
  const { wAttr, hAttr } = extractSizeHints(root);
  const { value: wVal, unit: wUnit } = parseCssLength(wAttr);
  const { value: hVal, unit: hUnit } = parseCssLength(hAttr);
  const wIsPxLike = wVal != null && (!wUnit || wUnit === 'px');
  const hIsPxLike = hVal != null && (!hUnit || hUnit === 'px');

  // Safe injection helper
  const setVB = (minX: number, minY: number, rawW: number, rawH: number) => {
    // Correct 0 or negative values to default size
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
      // Even when preferring responsive, inject minimum size (prevent 0×0)
      root.setAttribute('width', String(W));
      root.setAttribute('height', String(H));
      report.infos?.push('Injected width/height from viewBox (coerced to non-zero).');
    }
    report.fixedDimensions = true;
  };

  // Case A) When both numeric width/height are present
  if (wIsPxLike && hIsPxLike) {
    if (opts.mode === 'preserve-framing') {
      setVB(0, 0, wVal!, hVal!); // 0 correction handled internally
      return;
    } else {
      // fit-content
      const bbox = computeBBox(root, opts, report, svgString) ?? { minX: 0, minY: 0, width: wVal!, height: hVal! };
      const padded = padBBox(bbox, opts.paddingPercent);
      setVB(padded.minX, padded.minY, padded.width, padded.height);
      return;
    }
  }

  // Case B) Only one present or non-pixel units → use defaultSize
  if ((wAttr || hAttr) && (!wIsPxLike || !hIsPxLike)) {
    report.warnings.push('Non-px or partial size detected. Falling back to defaultSize for viewBox.');
  }

  // Case C) No hints → handle based on mode
  if (opts.mode === 'fit-content' || opts.ensureNonZeroViewport) {
    // In fit-content mode or when ensureNonZeroViewport=true, attempt content-based calculation
    const bbox = computeBBox(root, opts, report, svgString);
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const padded = padBBox(bbox, opts.paddingPercent);
      setVB(padded.minX, padded.minY, padded.width, padded.height);
      return;
    }
    // Debug: check bbox calculation result
    report.warnings.push(
      `Content bbox unavailable (${bbox ? `${bbox.width}x${bbox.height}` : 'null'}). Falling back to defaultSize.`
    );
  }

  // Fallback: preserve-framing + defaultSize
  setVB(0, 0, opts.defaultSize.width, opts.defaultSize.height);
}

/**
 * Sanitize numeric values
 * @description Sanitize numbers to avoid scientific notation in attributes
 */
function sanitizeNum(n: number) {
  return Number.isFinite(n) ? parseFloat(n.toFixed(6)) : 0;
}

/**
 * String-based heuristic BBox calculation
 * @description Analyze SVG string with regex to calculate approximate bounding box
 */
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

  // Find circles using regex
  const circleRegex =
    /<circle[^>]*cx=["']?([^"'\s]+)["']?[^>]*cy=["']?([^"'\s]+)["']?[^>]*r=["']?([^"'\s]+)["']?[^>]*\/?>/gi;
  let circleMatch;
  while ((circleMatch = circleRegex.exec(svgString)) !== null) {
    const cx = parseFloat(circleMatch[1]);
    const cy = parseFloat(circleMatch[2]);
    const r = parseFloat(circleMatch[3]);
    if (r > 0) push(cx - r, cy - r, cx + r, cy + r);
  }

  // Find rectangles using regex
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

/**
 * Real-time getBBox calculation
 * @description Calculate actual getBBox result by attaching hidden SVG to DOM
 */
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
 * Heuristic BBox calculation
 * @description DOM-based bounding box calculation
 * - Supported: rect, circle, ellipse, line, polyline, polygon
 * - Ignored: path, text, filters, markers (use padding if needed)
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

/* ========================================================================== */
/* Simple Facade API - Simplified Interface for Image Resizer                */
/* ========================================================================== */

/**
 * Basic SVG normalization (for image resizer)
 *
 * @description Performs basic normalization for processing SVG in image resizer.
 * Normalizes SVG with options optimized for Canvas rendering.
 *
 * @param svgString Original SVG string
 * @returns Normalized SVG string
 *
 * @example
 * ```typescript
 * // Normalize SVG for Canvas rendering
 * const normalizedSvg = normalizeSvgBasics(svgString);
 *
 * // Convert normalized SVG to image
 * const result = await processImage(normalizedSvg)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 * ```
 */
export function normalizeSvgBasics(svgString: string): string {
  const { enhancedSvg } = enhanceBrowserCompatibility(svgString, {
    // === Essential Compatibility ===
    addNamespaces: true, // Required for browser compatibility
    fixDimensions: true, // Needed for Canvas rendering
    modernizeSyntax: true, // xlink → href modernization
    addPreserveAspectRatio: true, // Ensure aspect ratio preservation

    // === Size Handling Strategy ===
    mode: 'fit-content', // Fit exactly to content (suitable for resizer)
    ensureNonZeroViewport: true, // Prevent 0×0 rendering
    paddingPercent: 0, // No padding - exact size

    // === Performance Optimization ===
    preferResponsive: false, // Fixed size needed for Canvas rendering
    enableLiveBBox: false, // Prevent test environment timeout from getBBox() calls
    enableHeuristicBBox: true, // Support Node.js environment
  });
  return enhancedSvg;
}
