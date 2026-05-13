import { describe, expect, it } from 'vitest';
import { inspectSvgSanitization } from '../../../src/svg-sanitizer/inspect-sanitization';
import { sanitizeSvgForRendering } from '../../../src/utils/svg-sanitizer';
import { encodedByteLength, findStage } from './inspect-sanitization-helpers';

describe('inspectSvgSanitization() stage 수집', () => {
  describe('lightweight 일반 stage 수집', () => {
    it('script 요소가 있으면 script-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'script-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['script']);
    });

    it('foreignObject 요소가 있으면 foreign-object-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject></foreignObject></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'foreign-object-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['foreignobject']);
    });

    it('on* 속성이 있으면 event-handler-removed stage가 발생 attribute 수만큼 카운트된다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="x"><rect onclick="y"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'event-handler-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(2);
      expect(stage?.samples).toContain('onload');
      expect(stage?.samples).toContain('onclick');
    });

    it('외부 xlink:href는 external-href-removed stage로 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="http://evil.example.com/sprite#a"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'external-href-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['xlink:href']);
    });

    it('style 속성에 외부 url(...)이 있으면 external-css-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill: url(http://evil.example.com/p.png)"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'external-css-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['style']);
    });

    it('<style> 본문에 외부 url(...)이 있으면 samples 토큰은 style-tag다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { fill: url(http://evil.example.com/p.png); }</style></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'external-css-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['style-tag']);
    });

    it('lightweight 정책에서는 doctype-removed stage가 포함되지 않는다', async () => {
      const report = await inspectSvgSanitization('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(findStage(report.impact.stages, 'doctype-removed')).toBeUndefined();
      expect(findStage(report.impact.stages, 'entity-removed')).toBeUndefined();
    });

    it('정상 SVG에서는 stages가 빈 배열이다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.stages).toEqual([]);
    });

    it('outputBytes는 sanitizeSvgForRendering 결과 byte와 동일하다', async () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>';
      const report = await inspectSvgSanitization(input);
      const expected = encodedByteLength(sanitizeSvgForRendering(input));
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.outputBytes).toBe(expected);
    });

    it('multi-occurrence 입력에서 event-handler/script count가 정확하다', async () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg" onload="a" onclick="b"><script>c</script><script>d</script></svg>';
      const report = await inspectSvgSanitization(input);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const event = findStage(report.impact.stages, 'event-handler-removed');
      const script = findStage(report.impact.stages, 'script-removed');
      expect(event?.count).toBe(2);
      expect(script?.count).toBe(2);
    });
  });

  describe('skip 정책 — potentialStages 시뮬레이션', () => {
    it('script 요소가 있으면 potentialStages에 script-removed가 포함된다', async () => {
      const report = await inspectSvgSanitization('<svg xmlns="http://www.w3.org/2000/svg"><script></script></svg>', {
        policy: 'skip',
      });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind !== 'skip') return;
      expect(report.impact.status).toBe('not-applied');
      const stage = findStage(report.impact.potentialStages, 'script-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      // outputBytes 필드는 타입상 skip impact에 존재하지 않음(컴파일 타임 보장).
      expect('outputBytes' in report.impact).toBe(false);
    });

    it('skip 정책에서도 doctype-removed는 potentialStages에 포함되지 않는다', async () => {
      const report = await inspectSvgSanitization('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        policy: 'skip',
      });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind !== 'skip') return;
      expect(findStage(report.impact.potentialStages, 'doctype-removed')).toBeUndefined();
    });
  });

  describe('strict 정책 — 동적 실행과 stage 수집', () => {
    it('script 요소가 있는 입력은 script-removed stage가 잡히고 outputBytes/outputNodeCount가 채워진다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        { policy: 'strict' }
      );
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind !== 'strict') return;
      expect(report.impact.status).toBe('ok');
      expect(report.impact.outputBytes).not.toBeNull();
      expect(report.impact.outputBytes ?? 0).toBeGreaterThan(0);
      expect(report.impact.outputNodeCount).not.toBeNull();
      expect(report.impact.outputNodeCount ?? -1).toBeGreaterThanOrEqual(0);
      expect(report.impact.failure).toBeNull();
      const stage = findStage(report.impact.stages, 'script-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['script']);
    });

    it('foreignObject 요소가 있는 입력은 foreign-object-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject></foreignObject></svg>',
        { policy: 'strict' }
      );
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind !== 'strict') return;
      expect(report.impact.status).toBe('ok');
      const stage = findStage(report.impact.stages, 'foreign-object-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
    });

    it('DOCTYPE 선언이 있으면 strict 정책에서만 doctype-removed stage가 등장한다', async () => {
      const input = '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>';
      const strictReport = await inspectSvgSanitization(input, { policy: 'strict' });
      expect(strictReport.impact.kind).toBe('strict');
      if (strictReport.impact.kind !== 'strict') return;
      const strictStage = findStage(strictReport.impact.stages, 'doctype-removed');
      expect(strictStage).toBeDefined();
      expect(strictStage?.count).toBeGreaterThanOrEqual(1);
      expect(strictStage?.samples).toEqual(['doctype']);

      // lightweight/skip 정책에서는 doctype-removed가 등장하지 않음을 다시 확인
      const lightweightReport = await inspectSvgSanitization(input);
      expect(lightweightReport.impact.kind).toBe('lightweight');
      if (lightweightReport.impact.kind !== 'lightweight') return;
      expect(findStage(lightweightReport.impact.stages, 'doctype-removed')).toBeUndefined();
    });

    it('ENTITY 선언이 있으면 strict 정책에서 entity-removed stage가 등장한다', async () => {
      const input = '<!DOCTYPE svg [<!ENTITY xxe "test">]><svg xmlns="http://www.w3.org/2000/svg"></svg>';
      const report = await inspectSvgSanitization(input, { policy: 'strict' });
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind !== 'strict') return;
      const stage = findStage(report.impact.stages, 'entity-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBeGreaterThanOrEqual(1);
      expect(stage?.samples).toEqual(['entity']);
    });

    it('정상 SVG는 strict 정책에서도 stages가 빈 배열이고 outputBytes/outputNodeCount가 정확하다', async () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10"/></svg>';
      const report = await inspectSvgSanitization(input, { policy: 'strict' });
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind !== 'strict') return;
      expect(report.impact.status).toBe('ok');
      expect(report.impact.stages).toEqual([]);
      expect(report.impact.outputBytes).not.toBeNull();
      expect(report.impact.outputBytes ?? 0).toBeGreaterThan(0);
      // rect 1개 → root 자식 1개
      expect(report.impact.outputNodeCount).toBe(1);
    });

    it('strict outputNodeCount는 sanitizedSvg를 재파싱한 결과의 querySelectorAll("*").length와 의미가 일치한다', async () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect/><circle/></g></svg>';
      const report = await inspectSvgSanitization(input, { policy: 'strict' });
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind !== 'strict') return;
      // g + rect + circle → root 기준 element 3개
      expect(report.impact.outputNodeCount).toBe(3);
    });
  });
});
