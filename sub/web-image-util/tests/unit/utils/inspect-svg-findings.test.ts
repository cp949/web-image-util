import { describe, expect, it } from 'vitest';
import { inspectSvg } from '../../../src/utils/inspect-svg';

describe('inspectSvg() 보안 finding 수집', () => {
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
});
