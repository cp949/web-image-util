import { describe, expect, it } from 'vitest';
import {
  type InspectSvgSanitizationStage,
  inspectSvgSanitization,
} from '../../../src/svg-sanitizer/inspect-sanitization';

describe('inspectSvgSanitization() 누출 방지 회귀', () => {
  // sentinel 10종: 보고서 어디에도 등장해서는 안 되는 문자열들.
  // 깨지는 순간 본체 stage 빌더가 어딘가에서 원문 string을 흘리고 있다는 신호다.
  // 본 회귀는 약화 금지 — 본체에서 string을 제거해 다시 통과시킨다.
  const sentinelHost = 'leak-canary-sanitizer.example.com';
  const sentinelScriptBody = "alert('leak-canary-sanitization')";
  const sentinelDataUrl = 'data:image/svg+xml;base64,LEAK_CANARY_SANITIZATION_PAYLOAD';
  const sentinelRasterDataUrl = 'data:image/png;base64,LEAK_RASTER_SANITIZATION_PAYLOAD';
  const sentinelAttr = 'leak-canary-attribute-sanitization';
  const sentinelStyleUrl = `http://${sentinelHost}/style-leak.png`;
  const sentinels = [
    sentinelHost,
    sentinelScriptBody,
    sentinelDataUrl,
    sentinelRasterDataUrl,
    sentinelAttr,
    sentinelStyleUrl,
    'LEAK_CANARY_SANITIZATION_PAYLOAD',
    'LEAK_RASTER_SANITIZATION_PAYLOAD',
    'leak-canary',
    'leak-raster',
  ];

  const dangerousSvg = `
    <!DOCTYPE svg>
    <svg xmlns="http://www.w3.org/2000/svg" data-marker="${sentinelAttr}">
      <script>${sentinelScriptBody}</script>
      <foreignObject></foreignObject>
      <rect onload="alert(1)" />
      <use xlink:href="http://${sentinelHost}/sprite#a"/>
      <image href="${sentinelDataUrl}"/>
      <image href="${sentinelRasterDataUrl}"/>
      <rect style="fill: url(${sentinelStyleUrl})"/>
      <style>rect { background: url(${sentinelStyleUrl}); }</style>
    </svg>
  `;

  /**
   * 보고서의 모든 string 값을 재귀 순회해 sentinel substring을 포함한 값을 수집한다.
   * JSON.stringify는 toJSON/순환 참조에서 갈라질 수 있으므로 직접 순회로 보강한다.
   */
  function collectStringLeaks(value: unknown, sentinelList: readonly string[]): string[] {
    const leaks: string[] = [];
    const visit = (node: unknown): void => {
      if (typeof node === 'string') {
        for (const sentinel of sentinelList) {
          if (node.includes(sentinel)) {
            leaks.push(`"${node}" contains sentinel "${sentinel}"`);
          }
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (node !== null && typeof node === 'object') {
        for (const v of Object.values(node)) visit(v);
      }
    };
    visit(value);
    return leaks;
  }

  /**
   * samples 화이트리스트 정규식.
   * 허용 문자: 소문자 알파벳, 숫자, 하이픈, 콜론, 슬래시(MIME 1개), 플러스(image/svg+xml), 점(MIME).
   * 공백/따옴표/외부 URL 문자(host의 .은 path/query를 동반하지 않을 때만), 대문자를 차단한다.
   */
  const WHITELIST_PATTERN = /^[a-z0-9\-:/+.]+$/;

  function assertSamplesWhitelisted(stages: InspectSvgSanitizationStage[]): void {
    for (const stage of stages) {
      for (const sample of stage.samples) {
        expect(sample.length, `stage ${stage.code} sample "${sample}" 길이는 32 이하여야 한다`).toBeLessThanOrEqual(32);
        expect(sample, `stage ${stage.code} sample "${sample}"는 화이트리스트 정규식을 통과해야 한다`).toMatch(
          WHITELIST_PATTERN
        );
      }
    }
  }

  function stagesOf(report: Awaited<ReturnType<typeof inspectSvgSanitization>>): InspectSvgSanitizationStage[] {
    if (report.impact.kind === 'skip') return report.impact.potentialStages;
    return report.impact.stages;
  }

  for (const policy of ['lightweight', 'strict', 'skip'] as const) {
    it(`${policy} 정책: JSON.stringify(report)에 sentinel 10종이 포함되지 않는다`, async () => {
      const report = await inspectSvgSanitization(dangerousSvg, { policy });
      const serialized = JSON.stringify(report);
      for (const sentinel of sentinels) {
        expect(serialized, `${policy} 정책 보고서가 sentinel "${sentinel}"를 누출하면 안 된다`).not.toContain(sentinel);
      }
    });

    it(`${policy} 정책: 보고서 모든 string 값 재귀 순회에서 sentinel substring이 없다`, async () => {
      const report = await inspectSvgSanitization(dangerousSvg, { policy });
      const leaks = collectStringLeaks(report, sentinels);
      expect(leaks, `${policy} 정책 보고서 string 누출: ${leaks.join(', ')}`).toEqual([]);
    });

    it(`${policy} 정책: samples 항목 모두 길이 ≤ 32이고 화이트리스트 정규식을 통과한다`, async () => {
      const report = await inspectSvgSanitization(dangerousSvg, { policy });
      assertSamplesWhitelisted(stagesOf(report));
    });
  }
});
