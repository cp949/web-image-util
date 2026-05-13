import { inspectSvg as inspectSvgFromUtils } from '@cp949/web-image-util/utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { analyzeSvgComplexity } from '../../../src/core/svg-complexity-analyzer';
import { ImageProcessError } from '../../../src/errors';
import { inspectSvg } from '../../../src/utils/inspect-svg';

vi.mock('../../../src/core/svg-complexity-analyzer', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/core/svg-complexity-analyzer')>();
  return { ...actual, analyzeSvgComplexity: vi.fn().mockImplementation(actual.analyzeSvgComplexity) };
});

describe('inspectSvg()', () => {
  describe('비문자열 입력 검증', () => {
    it('숫자 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg(42 as unknown as string)).toThrow(ImageProcessError);
    });

    it('숫자 입력 시 code가 SVG_INPUT_INVALID다', () => {
      try {
        inspectSvg(42 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
      }
    });

    it('숫자 입력 시 details.actualType이 "number"다', () => {
      try {
        inspectSvg(42 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect((e as ImageProcessError).details?.actualType).toBe('number');
      }
    });

    it('undefined 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg(undefined as unknown as string)).toThrow(ImageProcessError);
    });

    it('undefined 입력 시 code가 SVG_INPUT_INVALID이고 actualType이 "undefined"다', () => {
      try {
        inspectSvg(undefined as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('undefined');
      }
    });

    it('null 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg(null as unknown as string)).toThrow(ImageProcessError);
    });

    it('null 입력 시 details.actualType이 "null"이다', () => {
      try {
        inspectSvg(null as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('null');
      }
    });

    it('일반 객체 입력 시 ImageProcessError를 던진다', () => {
      expect(() => inspectSvg({} as unknown as string)).toThrow(ImageProcessError);
    });

    it('일반 객체 입력 시 details.actualType이 "object"다', () => {
      try {
        inspectSvg({} as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('object');
      }
    });
  });

  describe('정상 문자열 입력', () => {
    it('report.bytes가 UTF-8 바이트 수와 일치한다', () => {
      const input = '<svg></svg>';
      const report = inspectSvg(input);
      const expectedBytes = new TextEncoder().encode(input).length;
      expect(report.bytes).toBe(expectedBytes);
    });

    it('report.byteLimit이 MAX_SVG_BYTES와 같다', () => {
      const report = inspectSvg('<svg></svg>');
      expect(report.byteLimit).toBe(MAX_SVG_BYTES);
    });

    it('report.environment가 허용된 값 중 하나다', () => {
      const report = inspectSvg('<svg></svg>');
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(report.environment);
    });
  });

  describe('happy-dom 환경 감지', () => {
    it('report.environment가 "happy-dom"이다', () => {
      // Vitest 기본 환경은 happy-dom이므로 globalThis.happyDOM이 존재한다
      const report = inspectSvg('<svg></svg>');
      expect(report.environment).toBe('happy-dom');
    });
  });

  describe('바이트 초과 입력', () => {
    it('MAX_SVG_BYTES + 1 크기 입력 시 findings[0].code가 "svg-bytes-exceeded"다', () => {
      const oversized = 'a'.repeat(MAX_SVG_BYTES + 1);
      const report = inspectSvg(oversized);
      expect(report.findings[0]?.code).toBe('svg-bytes-exceeded');
    });

    it('바이트 초과 시 findings[0].details에 actualBytes가 있다', () => {
      const oversized = 'a'.repeat(MAX_SVG_BYTES + 1);
      const report = inspectSvg(oversized);
      expect(report.findings[0]?.details).toHaveProperty('actualBytes');
    });

    it('바이트 초과 시 findings[0].details에 maxBytes가 있다', () => {
      const oversized = 'a'.repeat(MAX_SVG_BYTES + 1);
      const report = inspectSvg(oversized);
      expect(report.findings[0]?.details).toHaveProperty('maxBytes');
    });

    it('바이트 초과 시 valid가 false다', () => {
      const oversized = 'a'.repeat(MAX_SVG_BYTES + 1);
      const report = inspectSvg(oversized);
      expect(report.valid).toBe(false);
    });

    it('바이트 초과 시 details.actualBytes가 실제 바이트 수와 일치한다', () => {
      const oversized = 'a'.repeat(MAX_SVG_BYTES + 1);
      const report = inspectSvg(oversized);
      expect(report.findings[0]?.details?.actualBytes).toBe(MAX_SVG_BYTES + 1);
    });

    it('바이트 초과 시 details.maxBytes가 MAX_SVG_BYTES와 같다', () => {
      const oversized = 'a'.repeat(MAX_SVG_BYTES + 1);
      const report = inspectSvg(oversized);
      expect(report.findings[0]?.details?.maxBytes).toBe(MAX_SVG_BYTES);
    });
  });

  describe('DOMParser 파싱', () => {
    it('빈 문자열 → parse.ok === false', () => {
      const report = inspectSvg('');
      expect(report.parse.ok).toBe(false);
    });

    it('빈 문자열 → findings에 svg-parse-failed 포함', () => {
      const report = inspectSvg('');
      expect(report.findings.some((f) => f.code === 'svg-parse-failed')).toBe(true);
    });

    it('빈 문자열 → valid === false', () => {
      const report = inspectSvg('');
      expect(report.valid).toBe(false);
    });

    it('잘려 있는 입력 → parse.ok === false', () => {
      const report = inspectSvg('<svg<<');
      expect(report.parse.ok).toBe(false);
    });

    it('정상 SVG → parse.ok === true', () => {
      const report = inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
      expect(report.parse.ok).toBe(true);
    });

    it('정상 SVG → root === "svg"', () => {
      const report = inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
      expect(report.root).toBe('svg');
    });

    it('정상 SVG → not-svg-root finding 없음', () => {
      const report = inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
      expect(report.findings.some((f) => f.code === 'not-svg-root')).toBe(false);
    });
  });

  // 체크리스트 D3/D4/D5 회귀: DOMParser 미가용 / parse.message normalized / locationAvailable boolean 결정
  describe('환경별 파싱 동작', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('D3: DOMParser가 undefined인 환경에서도 throw 없이 svg-parse-failed finding을 반환한다', () => {
      vi.stubGlobal('DOMParser', undefined);
      let report: ReturnType<typeof inspectSvg> | undefined;
      expect(() => {
        report = inspectSvg('<svg></svg>');
      }).not.toThrow();
      expect(report?.parse.ok).toBe(false);
      expect(report?.findings.some((f) => f.code === 'svg-parse-failed')).toBe(true);
      expect(report?.valid).toBe(false);
    });

    it('D4: DOMParser 미가용 시 parse.message는 정확한 normalized 영어 문장이다', () => {
      vi.stubGlobal('DOMParser', undefined);
      const report = inspectSvg('<svg></svg>');
      expect(report.parse.message).toBe('DOMParser is not available in this environment.');
    });

    it('D4: 파싱 실패 시 parse.message는 정확한 normalized 영어 문장이다', () => {
      const report = inspectSvg('<svg<<');
      expect(report.parse.message).toBe('XML parser reported an error while parsing the input as image/svg+xml.');
    });

    it('D4: 파싱 성공 시 parse.message는 null이다', () => {
      const report = inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
      expect(report.parse.message).toBeNull();
    });

    it('D5: DOMParser 미가용 시 locationAvailable === false', () => {
      vi.stubGlobal('DOMParser', undefined);
      const report = inspectSvg('<svg></svg>');
      expect(report.parse.locationAvailable).toBe(false);
    });

    it('D5: 파싱 성공 시 locationAvailable === false', () => {
      const report = inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
      expect(report.parse.locationAvailable).toBe(false);
    });

    it('D5: parsererror textContent에 line 패턴이 있으면 locationAvailable === true', () => {
      // 실제 DOMParser로 parsererror 자식을 가진 fakeDoc을 만든 뒤 Mock DOMParser로 교체
      const realParser = new DOMParser();
      const fakeDoc = realParser.parseFromString(
        '<root><parsererror>XML error at line 5: unexpected token</parsererror></root>',
        'application/xml'
      );
      class MockDOMParser {
        parseFromString(): Document {
          return fakeDoc;
        }
      }
      vi.stubGlobal('DOMParser', MockDOMParser);
      const report = inspectSvg('<svg></svg>');
      expect(report.parse.ok).toBe(false);
      expect(report.parse.locationAvailable).toBe(true);
    });

    it('D5: parsererror textContent에 line 패턴이 없으면 locationAvailable === false', () => {
      const realParser = new DOMParser();
      const fakeDoc = realParser.parseFromString(
        '<root><parsererror>XML error: unexpected token</parsererror></root>',
        'application/xml'
      );
      class MockDOMParser {
        parseFromString(): Document {
          return fakeDoc;
        }
      }
      vi.stubGlobal('DOMParser', MockDOMParser);
      const report = inspectSvg('<svg></svg>');
      expect(report.parse.ok).toBe(false);
      expect(report.parse.locationAvailable).toBe(false);
    });

    it('D5: parsererror textContent의 대소문자 변형 "Line: 12" 패턴도 매치된다', () => {
      const realParser = new DOMParser();
      const fakeDoc = realParser.parseFromString(
        '<root><parsererror>Some message Line: 12 mismatch</parsererror></root>',
        'application/xml'
      );
      class MockDOMParser {
        parseFromString(): Document {
          return fakeDoc;
        }
      }
      vi.stubGlobal('DOMParser', MockDOMParser);
      const report = inspectSvg('<svg></svg>');
      expect(report.parse.locationAvailable).toBe(true);
    });
  });

  describe('루트 검사', () => {
    it('루트가 <html>인 XML → root === "other"', () => {
      const report = inspectSvg('<html></html>');
      expect(report.root).toBe('other');
    });

    it('루트가 <html>인 XML → not-svg-root finding의 details.rootTagName이 "html"이다', () => {
      const report = inspectSvg('<html></html>');
      const finding = report.findings.find((f) => f.code === 'not-svg-root');
      expect(finding?.details?.rootTagName).toBe('html');
    });

    it('루트가 <html>인 XML → not-svg-root finding 존재', () => {
      const report = inspectSvg('<html></html>');
      expect(report.findings.some((f) => f.code === 'not-svg-root')).toBe(true);
    });

    it('루트가 <html>인 XML → valid === false', () => {
      const report = inspectSvg('<html></html>');
      expect(report.valid).toBe(false);
    });
  });

  describe('정규식 finding 수집 (파싱 실패 경로)', () => {
    it('파싱 실패 입력에 <script> 포함 → has-script-element finding 발생', () => {
      // <svg<< 는 잘못된 XML이므로 파싱 실패 경로를 탄다
      const report = inspectSvg('<svg<<<script>alert(1)</script>');
      const finding = report.findings.find((f) => f.code === 'has-script-element');
      expect(finding).toBeDefined();
      expect(finding?.details?.count as number).toBeGreaterThanOrEqual(1);
    });

    it('파싱 실패 입력에 onload="x" 포함 → has-event-handler finding 발생', () => {
      const report = inspectSvg('<svg<< onload="x">');
      const finding = report.findings.find((f) => f.code === 'has-event-handler');
      expect(finding).toBeDefined();
      expect(finding?.details?.count as number).toBeGreaterThanOrEqual(1);
    });

    it('파싱 실패 입력에 <foreignObject> 포함 → has-foreign-object finding 발생', () => {
      const report = inspectSvg('<svg<<<foreignObject><div>x</div></foreignObject>');
      const finding = report.findings.find((f) => f.code === 'has-foreign-object');
      expect(finding).toBeDefined();
      expect(finding?.details?.count as number).toBeGreaterThanOrEqual(1);
    });
  });

  describe('치수 분석 (dimensions)', () => {
    it('width/height/viewBox 모두 있는 SVG → explicit 분기가 올바르게 동작한다', () => {
      const report = inspectSvg('<svg width="200" height="100" viewBox="0 0 200 100"><rect/></svg>');
      expect(report.dimensions?.effective.source).toBe('explicit');
      expect(report.dimensions?.widthAttr.numeric).toBe(200);
      expect(report.dimensions?.widthAttr.unit).toBe('');
      expect(report.dimensions?.viewBox.parsed).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(report.findings.some((f) => f.code === 'dimensions-fallback')).toBe(false);
      expect(report.complexity).not.toBeNull();
    });

    it('viewBox만 있는 SVG → viewBox 분기가 올바르게 동작한다', () => {
      const report = inspectSvg('<svg viewBox="0 0 300 150"><rect/></svg>');
      expect(report.dimensions?.effective.source).toBe('viewBox');
      expect(report.dimensions?.effective.width).toBe(300);
      expect(report.findings.some((f) => f.code === 'dimensions-fallback')).toBe(false);
    });

    it('단위 포함 width/height → raw/numeric/unit 모두 정확하다', () => {
      const report = inspectSvg('<svg width="2em" height="1em"><rect/></svg>');
      expect(report.dimensions?.widthAttr.raw).toBe('2em');
      expect(report.dimensions?.widthAttr.numeric).toBe(2);
      expect(report.dimensions?.widthAttr.unit).toBe('em');
    });

    it('치수 정보 없는 SVG → fallback 분기가 올바르게 동작한다', () => {
      const report = inspectSvg('<svg><rect/></svg>');
      expect(report.dimensions?.effective.source).toBe('fallback');
      expect(report.dimensions?.effective.width).toBe(100);
      expect(report.findings.some((f) => f.code === 'dimensions-fallback')).toBe(true);
    });

    it('파싱 실패 경로 → dimensions === null', () => {
      const report = inspectSvg('<svg<<');
      expect(report.dimensions).toBeNull();
    });

    it('svg 루트 아닌 경우 → dimensions === null', () => {
      const report = inspectSvg('<html></html>');
      expect(report.dimensions).toBeNull();
    });
  });

  describe('복잡도 분석 (complexity)', () => {
    const FALLBACK_COMPLEXITY_RESULT = {
      metrics: {
        pathCount: 0,
        gradientCount: 0,
        filterCount: 0,
        animationCount: 0,
        textElementCount: 0,
        totalElementCount: 0,
        hasClipPath: false,
        hasMask: false,
        fileSize: 0,
      },
      complexityScore: 0.5,
      recommendedQuality: 'medium' as const,
      reasoning: ['Using default values due to analysis failure', 'Error: forced'],
    };

    afterEach(() => {
      vi.mocked(analyzeSvgComplexity).mockClear();
    });

    it('analyzeSvgComplexity fallback 반환 시 complexity === null이고 complexity-analysis-failed finding이 존재한다', () => {
      vi.mocked(analyzeSvgComplexity).mockReturnValueOnce(FALLBACK_COMPLEXITY_RESULT);
      const report = inspectSvg('<svg><rect/></svg>');
      expect(report.complexity).toBeNull();
      expect(report.findings.some((f) => f.code === 'complexity-analysis-failed')).toBe(true);
    });

    it('파싱 실패 경로 → analyzeSvgComplexity 호출 안 함', () => {
      inspectSvg('<svg<<');
      expect(vi.mocked(analyzeSvgComplexity)).not.toHaveBeenCalled();
    });
  });

  describe('DOM 기반 보안 finding 수집', () => {
    it('<script> 포함 → has-script-element finding(count=1), recommendation.sanitizer === "strict"', () => {
      const report = inspectSvg('<svg><script>alert(1)</script></svg>');
      const finding = report.findings.find((f) => f.code === 'has-script-element');
      expect(finding).toBeDefined();
      expect(finding?.details?.count).toBe(1);
      expect(report.recommendation.sanitizer).toBe('strict');
      expect(report.recommendation.reasons).toContain('has-script-element');
    });

    it('<foreignObject> 포함 → has-foreign-object finding', () => {
      const report = inspectSvg('<svg><foreignObject>...</foreignObject></svg>');
      const finding = report.findings.find((f) => f.code === 'has-foreign-object');
      expect(finding).toBeDefined();
      expect(finding?.details?.count).toBeGreaterThanOrEqual(1);
    });

    it('on* 이벤트 핸들러 두 개 → has-event-handler finding(count=2)', () => {
      const report = inspectSvg('<svg onload="x"><rect onclick="y"/></svg>');
      const finding = report.findings.find((f) => f.code === 'has-event-handler');
      expect(finding).toBeDefined();
      expect(finding?.details?.count).toBe(2);
    });

    it('xlink:href 외부 참조 → external-href finding', () => {
      const report = inspectSvg(
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="http://evil.example.com/sprite#a"/></svg>'
      );
      const finding = report.findings.find((f) => f.code === 'external-href');
      expect(finding).toBeDefined();
    });

    it('style attribute 외부 url() → style-attribute-external-url finding', () => {
      const report = inspectSvg('<svg><rect style="fill: url(http://evil.example.com/p.png)"/></svg>');
      const finding = report.findings.find((f) => f.code === 'style-attribute-external-url');
      expect(finding).toBeDefined();
    });

    it('<style> 태그 외부 url() → style-tag-external-url finding', () => {
      const report = inspectSvg('<svg><style>rect { fill: url(http://evil.example.com/p.png); }</style></svg>');
      const finding = report.findings.find((f) => f.code === 'style-tag-external-url');
      expect(finding).toBeDefined();
    });

    it('보안 finding 두 종류 이상 → recommendation.reasons 길이가 트리거 종류 수, 중복 없음', () => {
      const report = inspectSvg('<svg><script>alert(1)</script><foreignObject>x</foreignObject></svg>');
      const reasons = report.recommendation.reasons;
      expect(reasons.length).toBe(2);
      expect(new Set(reasons).size).toBe(reasons.length);
    });

    it('보안 finding 없는 정상 SVG → sanitizer === "lightweight", reasons.length === 0, valid === true', () => {
      const report = inspectSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect/></svg>');
      expect(report.recommendation.sanitizer).toBe('lightweight');
      expect(report.recommendation.reasons.length).toBe(0);
      expect(report.valid).toBe(true);
    });
  });

  describe('공개 표면 smoke 테스트', () => {
    it('@cp949/web-image-util/utils에서 inspectSvg를 import해 호출할 수 있다', () => {
      const report = inspectSvgFromUtils('<svg></svg>');
      expect(report).toHaveProperty('valid');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('recommendation');
    });
  });

  describe('누출 방지 회귀 테스트', () => {
    const sentinelHost = 'evil-leak-canary.example.com';
    const sentinelScriptBody = "alert('leak-canary-script')";
    const sentinelDataUrl = 'data:image/svg+xml;base64,LEAK_CANARY_BASE64_PAYLOAD';
    const sentinelAttr = 'leak-canary-attribute-value';
    const ALL_SENTINELS = [
      sentinelHost,
      sentinelScriptBody,
      sentinelDataUrl,
      sentinelAttr,
      'LEAK_CANARY_BASE64_PAYLOAD',
      'leak-canary',
    ];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" data-marker="${sentinelAttr}">
        <script>${sentinelScriptBody}</script>
        <foreignObject></foreignObject>
        <rect onload="alert(1)" />
        <use xlink:href="http://${sentinelHost}/sprite#a"/>
        <image href="${sentinelDataUrl}"/>
        <rect style="fill: url(http://${sentinelHost}/p.png)"/>
        <style>rect { background: url(http://${sentinelHost}/p.png); }</style>
      </svg>
    `;

    // finding details를 깊이 우선 순회해 string 값에 sentinel이 없음을 검사하는 헬퍼
    function assertNoSentinelInValue(value: unknown, path: string): void {
      if (typeof value === 'string') {
        for (const sentinel of ALL_SENTINELS) {
          expect(value, `${path}에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          assertNoSentinelInValue(v, `${path}.${k}`);
        }
      }
    }

    let report: ReturnType<typeof inspectSvg>;
    let serialized: string;

    beforeAll(() => {
      report = inspectSvg(svg);
      serialized = JSON.stringify(report);
    });

    it('report JSON에 sentinelHost가 포함되지 않는다', () => {
      expect(serialized).not.toContain(sentinelHost);
    });

    it('report JSON에 sentinelScriptBody가 포함되지 않는다', () => {
      expect(serialized).not.toContain(sentinelScriptBody);
    });

    it('report JSON에 sentinelDataUrl이 포함되지 않는다', () => {
      expect(serialized).not.toContain(sentinelDataUrl);
    });

    it('report JSON에 sentinelAttr이 포함되지 않는다', () => {
      expect(serialized).not.toContain(sentinelAttr);
    });

    it('report JSON에 LEAK_CANARY_BASE64_PAYLOAD가 포함되지 않는다', () => {
      expect(serialized).not.toContain('LEAK_CANARY_BASE64_PAYLOAD');
    });

    it('report JSON에 leak-canary가 포함되지 않는다', () => {
      expect(serialized).not.toContain('leak-canary');
    });

    it('finding details의 모든 string 값에 sentinel substring이 없다', () => {
      for (const finding of report.findings) {
        if (finding.details) {
          assertNoSentinelInValue(finding.details, `findings[${finding.code}].details`);
        }
      }
    });
  });
});
