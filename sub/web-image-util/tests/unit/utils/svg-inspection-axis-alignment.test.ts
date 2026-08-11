/**
 * SVG 진단 판정 축 ↔ 실제 동작 층 정합 테스트.
 *
 * 두 진단 API의 판정 축은 의도적으로 다르다(각각 다른 실제 동작 층의 거울).
 *  - inspectSvg의 external-href / style-*-external-url finding은
 *    렌더 경로 intake guard(assertSafeSvgContent)의 거부 여부와 일치해야 한다.
 *  - inspectSvgSanitization(lightweight)의 external-*-removed stage는
 *    lightweight sanitizer(sanitizeSvgForRendering)의 실제 치환 여부와 일치해야 한다.
 *
 * 이 거울 관계가 리팩토링으로 조용히 어긋나면 본 테스트가 실패한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSafeSvgContent } from '../../../src/core/source-converter/svg/safety.internal';
import { inspectSvgSanitization } from '../../../src/svg-sanitizer/inspect-sanitization';
import { inspectSvg } from '../../../src/utils/inspect-svg';
import { sanitizeSvgForRendering } from '../../../src/utils/svg-sanitizer';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** inspectSvg에서 판정 축 대상 finding 코드 */
const AXIS_FINDING_CODES = new Set(['external-href', 'style-attribute-external-url', 'style-tag-external-url']);
/** intake guard의 script/event-handler 채널과 호응하는 finding 코드 */
const GUARD_CHANNEL_FINDING_CODES = new Set(['has-script-element', 'has-event-handler']);
/** inspectSvgSanitization에서 판정 축 대상 stage 코드 (data-image-* / nested-svg-* 는 embedded 단계라 별개) */
const EXTERNAL_STAGE_CODES = new Set(['external-href-removed', 'external-css-removed']);

const href = (v: string) => `<svg xmlns="${SVG_NS}"><image href="${v}"/></svg>`;
const styleAttr = (css: string) => `<svg xmlns="${SVG_NS}"><rect style="${css}"/></svg>`;
const styleTag = (css: string) => `<svg xmlns="${SVG_NS}"><style>${css}</style><rect/></svg>`;
const presAttr = (name: string, v: string) => `<svg xmlns="${SVG_NS}"><rect ${name}="${v}"/></svg>`;

function hasAxisFinding(svg: string): boolean {
  return inspectSvg(svg).findings.some((f) => AXIS_FINDING_CODES.has(f.code));
}

function intakeGuardRejects(svg: string): boolean {
  try {
    assertSafeSvgContent(svg);
    return false;
  } catch {
    return true;
  }
}

async function hasExternalStage(svg: string): Promise<boolean> {
  const report = await inspectSvgSanitization(svg);
  if (report.impact.kind !== 'lightweight' || report.impact.status !== 'ok') {
    throw new Error(`lightweight impact를 기대했지만 ${report.impact.kind}/${report.impact.status}`);
  }
  return report.impact.stages.some((s) => EXTERNAL_STAGE_CODES.has(s.code));
}

describe('SVG 진단 판정 축 ↔ 실제 동작 층 정합', () => {
  describe('inspectSvg 판정 축 ↔ 렌더 intake guard(assertSafeSvgContent)', () => {
    // [label, svg, intake guard가 거부하는가]
    const cases: Array<[string, string, boolean]> = [
      ['href http 외부 URL', href('http://example.com/a.png'), true],
      ['href protocol-relative', href('//cdn.example.com/a.png'), true],
      ['href javascript URI', href('javascript:alert(1)'), true],
      ['href 상대 경로 ./', href('./rel.png'), true],
      ['href 상대 경로 ../', href('../up.png'), true],
      ['href 절대 경로 /', href('/abs.png'), true],
      ['href 접두어 없는 상대 경로', href('bare.png'), false],
      ['href 내부 fragment', href('#frag'), false],
      ['href 안전 raster data URL', href('data:image/png;base64,iVBORw0KGgo='), false],
      ['href 비허용 MIME data URL', href('data:text/html,hi'), true],
      [
        'href utf8 형식 svg data URL',
        href(`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="${SVG_NS}"><rect/></svg>`)}`),
        true,
      ],
      ['style 속성 url(http)', styleAttr('fill:url(http://example.com/x.png)'), true],
      ['style 속성 url(./)', styleAttr('fill:url(./rel.png)'), true],
      ['style 속성 url(#id)', styleAttr('fill:url(#id)'), false],
      ['style 속성 url(안전 raster data)', styleAttr('fill:url(data:image/png;base64,iVBORw0KGgo=)'), false],
      ['style 속성 expression()', styleAttr('width:expression(alert(1))'), false],
      ['style 태그 url(http)', styleTag('.a{fill:url(http://example.com/x.png)}'), true],
      ['style 태그 url(./)', styleTag('.a{fill:url(./rel.png)}'), true],
      ['style 태그 @import', styleTag('@import "http://example.com/x.css";'), false],
      ['style 속성 -moz-binding url(#내부)', styleAttr('-moz-binding:url(#internal)'), false],
      ['style 속성 image-set 문자열 인자', styleAttr("background:image-set('http://example.com/a.png' 1x)"), false],
      ['presentation 속성 fill=url(http)', presAttr('fill', 'url(http://example.com/x.png)'), false],
      ['presentation 속성 clip-path=url(./)', presAttr('clip-path', 'url(./c.svg#c)'), false],
    ];

    it.each(cases)('%s → 판정 축과 guard 거부 여부가 일치한다', (_label, svg, rejects) => {
      expect(hasAxisFinding(svg)).toBe(rejects);
      expect(intakeGuardRejects(svg)).toBe(rejects);
    });
  });

  describe('inspectSvg script/event-handler finding ↔ 렌더 intake guard', () => {
    // [label, svg, intake guard가 거부하는가]
    // 알려진 guard-단독 거부 비대칭 2종은 코퍼스에서 제외한다(fail-closed 방향이라 보안 문제 없음):
    //  1. 추출 방식 차이 — guard는 원문 문자열 검사(<script 포함, \son[a-z0-9:-]*= 정규식),
    //     inspectSvg는 DOM 순회라 주석 안의 <script는 guard만 거부한다.
    //  2. 수량자 차이 — guard 정규식은 on 뒤 0글자(`on=`)도 매치하지만 DOM 패턴
    //     (^on[a-z0-9:-]+$)은 1글자 이상만 매치한다.
    // 외부 참조 채널과 겹치지 않게 href/style은 넣지 않는다.
    const cases: Array<[string, string, boolean]> = [
      ['script 요소', `<svg xmlns="${SVG_NS}"><script>alert(1)</script></svg>`, true],
      ['script·핸들러 없는 도형만', `<svg xmlns="${SVG_NS}"><rect width="1" height="1"/></svg>`, false],
      ['rect의 onload 핸들러', `<svg xmlns="${SVG_NS}"><rect onload="x"/></svg>`, true],
      ['루트 svg의 onclick 핸들러', `<svg xmlns="${SVG_NS}" onclick="alert(1)"><rect/></svg>`, true],
      ['대문자 ONLOAD 핸들러', `<svg xmlns="${SVG_NS}"><rect ONLOAD="x"/></svg>`, true],
      ['onbegin(SMIL 계열) 핸들러', `<svg xmlns="${SVG_NS}"><rect onbegin="x"/></svg>`, true],
      ['on 접두 일반 속성(onlyattr)', `<svg xmlns="${SVG_NS}"><rect onlyattr="x"/></svg>`, true],
    ];

    it.each(cases)('%s → 판정 축과 guard 거부 여부가 일치한다', (_label, svg, rejects) => {
      const hasGuardChannelFinding = inspectSvg(svg).findings.some((f) => GUARD_CHANNEL_FINDING_CODES.has(f.code));
      expect(hasGuardChannelFinding).toBe(rejects);
      expect(intakeGuardRejects(svg)).toBe(rejects);
    });
  });

  describe('inspectSvgSanitization lightweight stage ↔ lightweight sanitizer 실제 치환', () => {
    // [label, svg, sanitizer가 치환하는가]
    // data:image/svg+xml(재인코딩으로 출력 변화)과 비허용 MIME data:(embedded stage로 차단) 케이스는
    // external stage 축 밖에서 출력이 변하므로 이 등가 관계로 표현할 수 없어 제외한다.
    const cases: Array<[string, string, boolean]> = [
      ['href http 외부 URL', href('http://example.com/a.png'), true],
      ['href protocol-relative', href('//cdn.example.com/a.png'), true],
      ['href javascript URI', href('javascript:alert(1)'), true],
      ['href 상대 경로 ./', href('./rel.png'), false],
      ['href 상대 경로 ../', href('../up.png'), false],
      ['href 절대 경로 /', href('/abs.png'), false],
      ['href 접두어 없는 상대 경로', href('bare.png'), false],
      ['href 내부 fragment', href('#frag'), false],
      ['href 안전 raster data URL', href('data:image/png;base64,iVBORw0KGgo='), false],
      ['style 속성 url(http)', styleAttr('fill:url(http://example.com/x.png)'), true],
      ['style 속성 url(./)', styleAttr('fill:url(./rel.png)'), false],
      ['style 속성 url(#id)', styleAttr('fill:url(#id)'), false],
      ['style 속성 url(안전 raster data)', styleAttr('fill:url(data:image/png;base64,iVBORw0KGgo=)'), true],
      ['style 속성 -moz-binding url(#내부)', styleAttr('-moz-binding:url(#internal)'), false],
      ['style 속성 image-set 문자열 인자', styleAttr("background:image-set('http://example.com/a.png' 1x)"), false],
      ['style 태그 url(http)', styleTag('.a{fill:url(http://example.com/x.png)}'), true],
      ['style 태그 url(./)', styleTag('.a{fill:url(./rel.png)}'), false],
      ['style 태그 @import', styleTag('@import "http://example.com/x.css";'), false],
      ['presentation 속성 fill=url(http)', presAttr('fill', 'url(http://example.com/x.png)'), false],
    ];

    it.each(cases)('%s → stage 유무와 sanitizer 출력 변화가 일치한다', async (_label, svg, rewrites) => {
      expect(await hasExternalStage(svg)).toBe(rewrites);
      expect(sanitizeSvgForRendering(svg) !== svg).toBe(rewrites);
    });
  });
});
