import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { inspectSvg } from '../../../src/utils/inspect-svg';

describe('inspectSvg() 파싱 경계', () => {
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
});
