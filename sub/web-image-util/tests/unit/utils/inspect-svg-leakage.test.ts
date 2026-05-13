import { beforeAll, describe, expect, it } from 'vitest';
import { inspectSvg } from '../../../src/utils/inspect-svg';

describe('inspectSvg() 누출 방지 회귀 테스트', () => {
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
