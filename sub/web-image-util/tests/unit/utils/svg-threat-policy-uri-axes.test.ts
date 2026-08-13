/**
 * URI 참조 판정 6축 특성화 표.
 *
 * 위협 정책의 참조 판정이 술어 여러 개로 흩어져 있고 축마다 정규화·검사 순서가
 * 다르다. 이 표는 각 축의 현재 답을 입력별로 고정한다. classifyUriRef 이관 중
 * 한 칸이라도 바뀌면 실패한다.
 *
 * 새 동작을 명세하는 테스트가 아니다. 기댓값은 손으로 쓰지 않고 실행 결과를
 * 확인한 뒤 고정했다.
 */
import { describe, expect, it } from 'vitest';
import { collectSvgDomSecuritySignals } from '../../../src/utils/svg-inspection/dom-signals.internal';
import { classifyUriRef, sanitizeUriValue, type UriRefReason } from '../../../src/utils/svg-threat-policy.internal';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** nested SVG 재귀 정제를 항등으로 두어 재인코딩 형태만 관찰한다. */
const passthroughNested = (svg: string) => svg;

const RASTER = 'data:image/png;base64,iVBORw0KGgo=';
const CANONICAL_SVG_DATA = `data:image/svg+xml;base64,${btoa(`<svg xmlns="${SVG_NS}"><rect/></svg>`)}`;
const NESTED_SVG_UTF8 = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="${SVG_NS}"><rect/></svg>`)}`;
const NESTED_SVG_URLENC = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${SVG_NS}"><rect/></svg>`)}`;

/** 재인코딩 결과는 입력 형태와 무관하게 같은 canonical base64로 수렴한다. */
const REENCODED_SVG = CANONICAL_SVG_DATA;

/**
 * 한 입력에 대한 6축의 답.
 *
 * - `allowedStrict` / `allowedLightweight`: `classifyUriRef(v, mode).reason === 'internal-fragment'`
 * - `sanitizedStrict` / `sanitizedLightweight`: `sanitizeUriValue(v, mode, 0, passthroughNested)`
 * - `blockedPipeline`: `classifyUriRef(v, 'lightweight').verdict === 'threat'`
 * - `domSignalCounted`: `collectSvgDomSecuritySignals` 경유 `externalHrefCount > 0`
 */
interface UriAxes {
  allowedStrict: boolean;
  allowedLightweight: boolean;
  sanitizedStrict: string | null;
  sanitizedLightweight: string | null;
  blockedPipeline: boolean;
  domSignalCounted: boolean;
}

/** 축 6개를 한 번에 적어 표로 읽히게 하는 헬퍼. */
function axes(
  allowedStrict: boolean,
  allowedLightweight: boolean,
  sanitizedStrict: string | null,
  sanitizedLightweight: string | null,
  blockedPipeline: boolean,
  domSignalCounted: boolean
): UriAxes {
  return {
    allowedStrict,
    allowedLightweight,
    sanitizedStrict,
    sanitizedLightweight,
    blockedPipeline,
    domSignalCounted,
  };
}

const URI_AXES_CORPUS: Array<[label: string, value: string, expected: UriAxes]> = [
  // ── internal-fragment ──
  ['내부 fragment', '#frag', axes(true, true, '#frag', '#frag', false, false)],
  ['선행 공백 fragment', '  #frag', axes(true, true, '  #frag', '  #frag', false, false)],
  // strict는 문자참조를 디코드하지 않아 모드별로 답이 갈린다
  ['문자참조 fragment', '&#35;frag', axes(false, true, null, '&#35;frag', false, false)],

  // ── empty (원본 trim이 빈 값) ──
  ['빈 문자열', '', axes(false, false, null, null, false, true)],
  ['공백만', '  ', axes(false, false, null, null, false, true)],

  // ── normalized-empty (정규화하면 빈 값) ──
  ['문자참조 공백', '&#32;', axes(false, false, null, null, false, false)],
  ['문자참조 탭', '&#9;', axes(false, false, null, null, false, false)],
  ['문자참조 개행', '&#10;', axes(false, false, null, null, false, false)],
  ['제어문자', String.fromCharCode(1), axes(false, false, null, null, false, false)],
  ['따옴표 단독', '&quot;', axes(false, false, null, null, false, false)],

  // ── boundary-quote ──
  ['큰따옴표 fragment', '"#frag"', axes(false, false, null, null, true, true)],
  ['문자참조 큰따옴표 fragment', '&quot;#frag&quot;', axes(false, false, null, null, true, true)],
  ['작은따옴표 fragment', "'#f'", axes(false, false, null, null, true, true)],
  ['역슬래시 fragment', '\\#f', axes(false, false, null, null, true, true)],

  // ── safe-raster-data ──
  ['안전 raster', RASTER, axes(false, false, RASTER, RASTER, false, false)],
  [
    '대문자 스킴 raster',
    'DATA:image/PNG;base64,iVBORw0KGgo=',
    axes(false, false, 'DATA:image/PNG;base64,iVBORw0KGgo=', 'DATA:image/PNG;base64,iVBORw0KGgo=', false, false),
  ],
  ['선행 공백 raster', `  ${RASTER}`, axes(false, false, `  ${RASTER}`, `  ${RASTER}`, false, false)],

  // 따옴표가 data: 감지를 깨뜨려 data 분기를 타지 않는다
  ['따옴표 감싼 raster', `"${RASTER}"`, axes(false, false, null, null, true, true)],

  // ── canonical-svg-data / nested-svg-data ──
  ['canonical svg data', CANONICAL_SVG_DATA, axes(false, false, REENCODED_SVG, REENCODED_SVG, false, false)],
  [
    '대문자 스킴 canonical svg data',
    CANONICAL_SVG_DATA.replace('data:', 'DATA:'),
    axes(false, false, REENCODED_SVG, REENCODED_SVG, false, false),
  ],
  ['utf8 형식 svg data', NESTED_SVG_UTF8, axes(false, false, REENCODED_SVG, REENCODED_SVG, true, false)],
  ['url 인코딩 svg data', NESTED_SVG_URLENC, axes(false, false, REENCODED_SVG, REENCODED_SVG, true, false)],

  // ── unsafe-data ──
  ['비허용 MIME data', 'data:text/html,x', axes(false, false, null, null, true, false)],
  ['비허용 raster MIME data', 'data:image/tiff,x', axes(false, false, null, null, true, false)],
  ['콤마 없는 data', 'data:image/png', axes(false, false, null, null, true, false)],
  [
    '상한 초과 raster data',
    `data:image/png;base64,${'A'.repeat(4_000_000)}`,
    axes(false, false, null, null, true, false),
  ],

  // ── external ──
  ['http 절대 URL', 'http://evil.example.com/a.png', axes(false, false, null, null, true, true)],
  ['protocol-relative', '//cdn.example.com/a.png', axes(false, false, null, null, true, true)],
  ['상대 경로 ./', './rel.png', axes(false, false, null, null, true, true)],
  ['상대 경로 ../', '../up.png', axes(false, false, null, null, true, true)],
  ['절대 경로 /', '/abs.png', axes(false, false, null, null, true, true)],
  ['접두어 없는 상대 경로', 'bare.png', axes(false, false, null, null, true, true)],
  ['javascript URI', 'javascript:alert(1)', axes(false, false, null, null, true, true)],
  ['대소문자 섞인 javascript URI', 'JaVaScRiPt:alert(1)', axes(false, false, null, null, true, true)],
  ['개행 삽입 javascript URI', ' jav\nascript:alert(1)', axes(false, false, null, null, true, true)],
  ['문자참조 javascript URI', 'jav&#x61;script:alert(1)', axes(false, false, null, null, true, true)],
  ['vbscript URI', 'vbscript:alert(1)', axes(false, false, null, null, true, true)],
  ['file URI', 'file:///etc/passwd', axes(false, false, null, null, true, true)],

  // 원본 기준으로는 data:가 아니고 정규화 기준으로는 data:다
  ['문자참조로 감춘 data 스킴', '&#100;ata:image/png;base64,iVBORw0KGgo=', axes(false, false, null, null, true, true)],
];

/** 속성값으로 삽입하기 위해 XML 특수문자를 이스케이프한다. */
function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** dom-signals가 이 참조를 제거 대상으로 집계하는지 실제 순회로 확인한다. */
function isCountedByDomSignals(value: string): boolean {
  const svg = `<svg xmlns="${SVG_NS}"><image href="${escapeAttributeValue(value)}"/></svg>`;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return collectSvgDomSecuritySignals(doc).externalHrefCount > 0;
}

/**
 * 축을 현재 API에 붙이는 어댑터.
 *
 * 판정이 `classifyUriRef`로 모이면 이 세 함수의 본문만 바뀐다. 표의 기댓값은
 * 그때도 한 바이트도 바뀌지 않는다 — 기댓값을 고쳐야 통과한다면 이관이 동작을
 * 바꾼 것이므로 실패로 다뤄야 한다.
 */
function readAllowedAxis(value: string, mode: 'strict' | 'lightweight'): boolean {
  return classifyUriRef(value, mode).reason === 'internal-fragment';
}

function readSanitizedAxis(value: string, mode: 'strict' | 'lightweight'): string | null {
  return sanitizeUriValue(value, mode, 0, passthroughNested);
}

function readBlockedPipelineAxis(value: string): boolean {
  return classifyUriRef(value, 'lightweight').verdict === 'threat';
}

describe('URI 참조 판정 6축 특성화 표', () => {
  it.each(URI_AXES_CORPUS)('%s → 6축의 답이 고정값과 일치한다', (_label, value, expected) => {
    const actual: UriAxes = {
      allowedStrict: readAllowedAxis(value, 'strict'),
      allowedLightweight: readAllowedAxis(value, 'lightweight'),
      sanitizedStrict: readSanitizedAxis(value, 'strict'),
      sanitizedLightweight: readSanitizedAxis(value, 'lightweight'),
      blockedPipeline: readBlockedPipelineAxis(value),
      domSignalCounted: isCountedByDomSignals(value),
    };
    expect(actual).toEqual(expected);
  });

  it('reason 9종을 각각 2행 이상 고정한다', () => {
    const reasonCounts = new Map<UriRefReason, number>();
    for (const [, value] of URI_AXES_CORPUS) {
      const { reason } = classifyUriRef(value, 'lightweight');
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }

    const reasons: UriRefReason[] = [
      'internal-fragment',
      'empty',
      'normalized-empty',
      'boundary-quote',
      'safe-raster-data',
      'canonical-svg-data',
      'nested-svg-data',
      'unsafe-data',
      'external',
    ];
    for (const reason of reasons) {
      expect(reasonCounts.get(reason), reason).toBeGreaterThanOrEqual(2);
    }
  });
});
