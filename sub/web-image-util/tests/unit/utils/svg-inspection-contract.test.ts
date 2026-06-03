import { describe, expect, it } from 'vitest';
import {
  type InspectSvgSanitizationReport,
  type InspectSvgSanitizationStage,
  inspectSvgSanitization,
} from '../../../src/svg-sanitizer/inspect-sanitization';
import { type InspectSvgFindingCode, inspectSvg } from '../../../src/utils/inspect-svg';

/**
 * SVG inspection/sanitization 보안 행위 contract.
 *
 * 목적: `inspectSvg`, `inspectSvgSanitization`, `svg-inspection/*` 헬퍼를 하나의 행위 표면으로
 * 보고 현재 시점의 보안 분류를 fixture matrix로 고정한다. 이 파일이 통과한 뒤에는 새 리뷰
 * 지적이 source를 바꾸려면 먼저 누락된 contract row를 명시해야 한다.
 *
 * 각 row는 관련 surface(`inspectSvg` finding / sanitizer stage)를 함께 검증한다.
 */

/** inspectSvg finding 코드 목록을 추출한다. */
function findingCodes(svg: string): InspectSvgFindingCode[] {
  return inspectSvg(svg).findings.map((finding) => finding.code);
}

/** policy별 sanitizer stage 배열을 추출한다. skip은 potentialStages, 그 외는 stages. */
async function stagesOf(
  svg: string,
  policy: 'lightweight' | 'strict' | 'skip'
): Promise<InspectSvgSanitizationStage[]> {
  const report = await inspectSvgSanitization(svg, { policy });
  return stagesFromReport(report);
}

function stagesFromReport(report: InspectSvgSanitizationReport): InspectSvgSanitizationStage[] {
  if (report.impact.kind === 'skip') return report.impact.potentialStages;
  return report.impact.stages;
}

/** stage 코드 목록을 추출한다. */
async function stageCodes(svg: string, policy: 'lightweight' | 'strict' | 'skip' = 'lightweight'): Promise<string[]> {
  return (await stagesOf(svg, policy)).map((stage) => stage.code);
}

/** 특정 코드의 stage를 찾는다. */
function findStage(stages: InspectSvgSanitizationStage[], code: string): InspectSvgSanitizationStage | undefined {
  return stages.find((stage) => stage.code === code);
}

/** 임의 값 안의 모든 string을 재귀 수집한다. 누출 검사용. */
function collectStrings(value: unknown): string[] {
  const strings: string[] = [];
  const visit = (input: unknown): void => {
    if (typeof input === 'string') {
      strings.push(input);
      return;
    }
    if (Array.isArray(input)) {
      for (const item of input) visit(item);
      return;
    }
    if (input && typeof input === 'object') {
      for (const item of Object.values(input)) visit(item);
    }
  };
  visit(value);
  return strings;
}

const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';
// 보존 대상 PNG raster payload (16 bytes 미만이라 크기 제한 통과).
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

describe('SVG inspection/sanitization contract matrix', () => {
  describe('DOM-01: <script> 요소(대소문자 혼합)', () => {
    it('inspectSvg는 has-script-element finding을 낸다', () => {
      expect(findingCodes(`<svg ${XMLNS}><script>a()</script><ScRiPt>b()</ScRiPt></svg>`)).toContain(
        'has-script-element'
      );
    });

    it('sanitizer는 script-removed stage를 내고 sample은 script만 담는다', async () => {
      const stages = await stagesOf(`<svg ${XMLNS}><script>a()</script><ScRiPt>b()</ScRiPt></svg>`, 'lightweight');
      const stage = findStage(stages, 'script-removed');
      expect(stage).toBeDefined();
      expect(stage?.samples).toEqual(['script']);
    });
  });

  describe('DOM-02: <foreignObject> 요소(대소문자 혼합)', () => {
    it('inspectSvg는 has-foreign-object finding을 낸다', () => {
      expect(findingCodes(`<svg ${XMLNS}><foreignObject></foreignObject></svg>`)).toContain('has-foreign-object');
      expect(findingCodes(`<svg ${XMLNS}><foreignobject></foreignobject></svg>`)).toContain('has-foreign-object');
    });

    it('sanitizer는 foreign-object-removed stage를 내고 sample은 정규화 토큰만 담는다', async () => {
      const stages = await stagesOf(`<svg ${XMLNS}><foreignObject></foreignObject></svg>`, 'lightweight');
      const stage = findStage(stages, 'foreign-object-removed');
      expect(stage).toBeDefined();
      // 정규화된 소문자 토큰만 담긴다(원본 대소문자 토큰 echo 금지).
      expect(stage?.samples).toEqual(['foreignobject']);
    });
  });

  describe('DOM-03: 이벤트 핸들러 속성(onclick, ONLOAD, on:custom)', () => {
    // on:custom은 미선언 namespace prefix라 XML parse 실패를 유발한다. inspectSvg는 parse 실패
    // 경로에서 regex 폴백으로 이벤트 핸들러를 검출하므로 casing/콜론 변형 모두 finding으로 잡힌다.
    const parseFailingSvg = `<svg ${XMLNS} ONLOAD="a()"><rect onclick="b()" on:custom="c()"/></svg>`;
    // parse 유효 입력(콜론 변형 제외). sanitizer stage 수집은 DOM 기반이라 parse 성공이 전제다.
    const parseValidSvg = `<svg ${XMLNS} ONLOAD="a()"><rect onclick="b()"/></svg>`;

    it('inspectSvg는 casing/콜론 변형 모두 has-event-handler finding으로 잡는다', () => {
      expect(findingCodes(parseFailingSvg)).toContain('has-event-handler');
      expect(findingCodes(parseValidSvg)).toContain('has-event-handler');
    });

    it('sanitizer event-handler-removed sample은 속성 토큰(소문자)만 담고 핸들러 값은 누출하지 않는다', async () => {
      const stages = await stagesOf(parseValidSvg, 'lightweight');
      const stage = findStage(stages, 'event-handler-removed');
      expect(stage).toBeDefined();
      expect(stage?.samples).toEqual(['onload', 'onclick']);
      for (const sample of stage?.samples ?? []) {
        // 속성명 토큰만, 핸들러 본문 값은 절대 담기지 않는다.
        expect(sample).toMatch(/^on[a-z0-9:-]*$/);
        expect(sample).not.toContain('(');
      }
    });

    it('parse 실패 입력은 inspectSvg가 finding을 내지만 sanitizer stages는 설계상 비어 있다(의도된 표면 차이)', async () => {
      // inspect-sanitization-failures 회귀가 고정한 계약: parse 실패 → 정제는 regex로 그대로
      // 수행되지만 진단 stage 수집은 DOM 기반이라 빈 배열이다. 이 차이는 gap이 아니라 계약이다.
      expect(findingCodes(parseFailingSvg)).toContain('has-event-handler');
      expect(inspectSvg(parseFailingSvg).parse.ok).toBe(false);
      const report = await inspectSvgSanitization(parseFailingSvg, { policy: 'lightweight' });
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.status).toBe('ok');
      expect(report.impact.stages).toEqual([]);
    });
  });

  describe('REF-01: href 절대 외부 URL', () => {
    const svg = `<svg ${XMLNS}><use href="https://example.com/a.svg#id"/></svg>`;

    it('inspectSvg는 external-href finding을 낸다', () => {
      expect(findingCodes(svg)).toContain('external-href');
    });

    it('sanitizer는 external-href-removed stage를 내고 raw URL을 노출하지 않는다', async () => {
      const report = await inspectSvgSanitization(svg, { policy: 'lightweight' });
      const stages = stagesFromReport(report);
      expect(findStage(stages, 'external-href-removed')).toBeDefined();
      expect(JSON.stringify(report)).not.toContain('example.com');
    });
  });

  describe('REF-02: xlink:href 절대 외부 URL(xmlns:xlink 선언)', () => {
    const svg = `<svg ${XMLNS} ${XLINK}><use xlink:href="https://example.com/a.svg#id"/></svg>`;

    it('inspectSvg는 external-href finding을 낸다(REF-01과 동일 분류)', () => {
      expect(findingCodes(svg)).toContain('external-href');
    });

    it('sanitizer external-href-removed sample은 xlink:href 토큰이다', async () => {
      const stages = await stagesOf(svg, 'lightweight');
      const stage = findStage(stages, 'external-href-removed');
      expect(stage?.samples).toEqual(['xlink:href']);
    });
  });

  describe('REF-03: namespace URI로 읽히는 xlink 속성(다른 prefix)', () => {
    const svg = `<svg ${XMLNS} xmlns:xl="http://www.w3.org/1999/xlink"><use xl:href="https://example.com/a.svg#id"/></svg>`;

    it('inspectSvg는 external-href finding을 낸다(REF-01과 동일 분류)', () => {
      expect(findingCodes(svg)).toContain('external-href');
    });

    it('sanitizer는 external-href-removed stage를 낸다', async () => {
      expect(await stageCodes(svg, 'lightweight')).toContain('external-href-removed');
    });
  });

  describe('REF-04: 내부 fragment / 로컬 참조는 외부 아님', () => {
    it('href="#local"은 external-href finding/stage를 만들지 않는다', async () => {
      const svg = `<svg ${XMLNS}><use href="#local"/></svg>`;
      expect(findingCodes(svg)).not.toContain('external-href');
      expect(await stageCodes(svg, 'lightweight')).not.toContain('external-href-removed');
    });

    it('href="local-id"는 external-href finding/stage를 만들지 않는다', async () => {
      const svg = `<svg ${XMLNS}><use href="local-id"/></svg>`;
      expect(findingCodes(svg)).not.toContain('external-href');
      expect(await stageCodes(svg, 'lightweight')).not.toContain('external-href-removed');
    });
  });

  describe('REF-05: 상대 경로 참조는 inspect와 sanitizer 정책별 표면이 다르다', () => {
    const svg = `<svg ${XMLNS}><use href="../sprite.svg#a"/></svg>`;

    it('inspectSvg는 렌더링 후단 보안 게이트 기준으로 external-href finding을 낸다', () => {
      expect(findingCodes(svg)).toContain('external-href');
    });

    it('lightweight sanitizer는 상대 href를 제거 stage로 보고하지 않는다', async () => {
      expect(await stageCodes(svg, 'lightweight')).not.toContain('external-href-removed');
    });

    it('strict sanitizer는 상대 href를 제거 stage로 보고한다', async () => {
      expect(await stageCodes(svg, 'strict')).toContain('external-href-removed');
    });
  });

  describe('DATA-01: 안전한 raster data URL은 외부 참조 아님', () => {
    const svg = `<svg ${XMLNS}><image href="${TINY_PNG}"/></svg>`;

    it('inspectSvg는 external-href finding을 내지 않는다', () => {
      expect(findingCodes(svg)).not.toContain('external-href');
    });

    it('sanitizer는 external-href-removed가 아니라 data-image-preserved로 분류한다', async () => {
      const stages = await stagesOf(svg, 'lightweight');
      expect(findStage(stages, 'external-href-removed')).toBeUndefined();
      expect(findStage(stages, 'data-image-preserved')).toBeDefined();
    });
  });

  describe('DATA-02: 차단되는 data:image/svg+xml URL', () => {
    // 디코딩 불가능한 svg data URL → data-image-blocked.
    const svg = `<svg ${XMLNS}><image href="data:image/svg+xml;base64,%%%"/></svg>`;

    it('inspectSvg는 blocked data URL을 external-href finding으로 센다', () => {
      expect(findingCodes(svg)).toContain('external-href');
    });

    it('sanitizer는 data-image-blocked로 카운트하고 MIME payload를 노출하지 않는다', async () => {
      const report = await inspectSvgSanitization(svg, { policy: 'lightweight' });
      const stages = stagesFromReport(report);
      const stage = findStage(stages, 'data-image-blocked');
      expect(stage).toBeDefined();
      expect(stage?.count).toBeGreaterThanOrEqual(1);
      // base64 payload는 sample/직렬화 어디에도 echo되지 않는다.
      expect(JSON.stringify(report)).not.toContain('%%%');
    });
  });

  describe('CSS-01: style 속성 외부 url()', () => {
    const svg = `<svg ${XMLNS}><rect style="fill: url(https://example.com/a.png)"/></svg>`;

    it('inspectSvg는 style-attribute-external-url finding을 낸다', () => {
      expect(findingCodes(svg)).toContain('style-attribute-external-url');
    });

    it('sanitizer external-css-removed sample은 style만 담는다', async () => {
      const stages = await stagesOf(svg, 'lightweight');
      const stage = findStage(stages, 'external-css-removed');
      expect(stage?.samples).toEqual(['style']);
    });
  });

  describe('CSS-02: <style> 태그 외부 url()', () => {
    const svg = `<svg ${XMLNS}><style>rect{fill:url(https://example.com/a.png)}</style></svg>`;

    it('inspectSvg는 style-tag-external-url finding을 낸다', () => {
      expect(findingCodes(svg)).toContain('style-tag-external-url');
    });

    it('sanitizer external-css-removed sample은 style-tag만 담는다', async () => {
      const stages = await stagesOf(svg, 'lightweight');
      const stage = findStage(stages, 'external-css-removed');
      expect(stage?.samples).toEqual(['style-tag']);
    });
  });

  describe('CSS-03: 대소문자 혼합 STYLE/URL은 소문자와 동일 분류', () => {
    it('STYLE 속성 + URL() 대문자도 style-attribute-external-url로 분류된다', () => {
      const upper = `<svg ${XMLNS}><rect STYLE="fill: URL(https://example.com/a.png)"/></svg>`;
      const lower = `<svg ${XMLNS}><rect style="fill: url(https://example.com/a.png)"/></svg>`;
      expect(findingCodes(upper)).toContain('style-attribute-external-url');
      expect(findingCodes(lower)).toContain('style-attribute-external-url');
    });

    it('strict 정책에서 image-set 외부 URL은 external-css-removed로 분류된다', async () => {
      const svg = `<svg ${XMLNS}><rect style='background-image:IMAGE-SET("https://example.com/a.png" 1x)'/></svg>`;
      expect(await stageCodes(svg, 'strict')).toContain('external-css-removed');
    });
  });

  describe('LEAK-01: 보고서는 sentinel 원문을 누출하지 않는다', () => {
    const sentinelHost = 'leak-contract-host.example.com';
    const sentinelPayload = 'LEAK_CONTRACT_PAYLOAD';
    const sentinelQuery = 'leak-contract-query';
    const sentinelFragment = 'leak-contract-fragment';
    const sentinelRootTag = 'leakcontractroot';
    const sentinels = [sentinelHost, sentinelPayload, sentinelQuery, sentinelFragment, sentinelRootTag];

    const dangerousSvg = `<svg ${XMLNS} ${XLINK}>
      <use xlink:href="https://${sentinelHost}/a.svg?${sentinelQuery}=1#${sentinelFragment}"/>
      <image href="data:image/svg+xml;base64,${sentinelPayload}"/>
      <rect style="fill:url(https://${sentinelHost}/b.png)"/>
    </svg>`;

    it('inspectSvg report에 sentinel 원문이 없다', () => {
      const report = inspectSvg(dangerousSvg);
      const serialized = JSON.stringify(report);
      for (const sentinel of sentinels) {
        expect(serialized, `inspectSvg가 "${sentinel}"를 누출하면 안 된다`).not.toContain(sentinel);
      }
    });

    it('not-svg-root rootTagName도 sentinel을 누출하지 않는다', () => {
      const longRoot = sentinelRootTag.repeat(4);
      const report = inspectSvg(`<${longRoot} ${XMLNS}></${longRoot}>`);
      const finding = report.findings.find((f) => f.code === 'not-svg-root');
      expect(finding).toBeDefined();
      expect(finding?.details?.rootTagName).toBe('non-svg-root');
      expect(JSON.stringify(report)).not.toContain(sentinelRootTag);
    });

    it('inspectSvgSanitization report에 sentinel 원문이 없다(전 policy)', async () => {
      for (const policy of ['lightweight', 'strict', 'skip'] as const) {
        const report = await inspectSvgSanitization(dangerousSvg, { policy });
        for (const value of collectStrings(report)) {
          for (const sentinel of sentinels) {
            expect(value, `${policy} 정책이 "${sentinel}"를 누출하면 안 된다`).not.toContain(sentinel);
          }
        }
      }
    });
  });

  describe('POLICY-01: skip 정책은 정제를 수행하지 않는다', () => {
    it('report kind는 skip이고 status는 not-applied다', async () => {
      const report = await inspectSvgSanitization(`<svg ${XMLNS}><script>a()</script></svg>`, { policy: 'skip' });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind !== 'skip') return;
      expect(report.impact.status).toBe('not-applied');
      // 실제 정제 결과 필드(outputBytes)는 skip impact에 존재하지 않는다.
      expect('outputBytes' in report.impact).toBe(false);
    });
  });

  describe('POLICY-02: lightweight와 strict는 보안 신호를 공유하되 impact kind는 구분된다', () => {
    const svg = `<svg ${XMLNS}><script>a()</script></svg>`;

    it('두 정책 모두 script-removed stage를 검출한다(공유 신호)', async () => {
      expect(await stageCodes(svg, 'lightweight')).toContain('script-removed');
      expect(await stageCodes(svg, 'strict')).toContain('script-removed');
    });

    it('impact.kind는 정책마다 구분된다', async () => {
      const lightweight = await inspectSvgSanitization(svg, { policy: 'lightweight' });
      const strict = await inspectSvgSanitization(svg, { policy: 'strict' });
      expect(lightweight.impact.kind).toBe('lightweight');
      expect(strict.impact.kind).toBe('strict');
    });
  });
});
