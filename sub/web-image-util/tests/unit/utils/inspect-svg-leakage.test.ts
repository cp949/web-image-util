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

  // xmlns:xlink 선언이 있어야 image/svg+xml 파서가 xlink:href를 unbound prefix 오류 없이 파싱한다.
  // 선언이 없으면 파싱이 실패해 regex fallback 경로만 타고 DOM/CSS helper의 sample 경로가 검사되지 않는다.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-marker="${sentinelAttr}">
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

  // samples 화이트리스트 정규식. 허용 문자: 소문자 알파벳, 숫자, 하이픈, 콜론, 슬래시(MIME),
  // 플러스(image/svg+xml), 점(MIME). 공백/따옴표/대문자/외부 URL 문자를 차단한다.
  // sanitization 쪽 누출 테스트와 대칭으로 두어 sample 경로의 raw 값 echo 회귀를 잡는다.
  const WHITELIST_PATTERN = /^[a-z0-9\-:/+.]+$/;

  it('fixture는 파싱에 성공해 DOM/CSS helper 경로를 거친다', () => {
    // 파싱이 실패하면 regex fallback만 타서 sample 누출 경로가 검사되지 않으므로,
    // 이 회귀의 전제(파싱 성공 경로 도달)를 명시적으로 고정한다.
    expect(report.findings.some((finding) => finding.code === 'svg-parse-failed')).toBe(false);
  });

  it('finding details의 samples와 rootTagName은 길이 ≤ 32이고 화이트리스트 정규식을 통과한다', () => {
    let sawSamples = false;
    for (const finding of report.findings) {
      const details = finding.details as Record<string, unknown> | undefined;
      if (!details) continue;
      if (Array.isArray(details.samples)) {
        for (const sample of details.samples) {
          sawSamples = true;
          expect(typeof sample, `findings[${finding.code}] sample 타입은 string이어야 한다`).toBe('string');
          const token = sample as string;
          expect(
            token.length,
            `findings[${finding.code}] sample "${token}" 길이는 32 이하여야 한다`
          ).toBeLessThanOrEqual(32);
          expect(token, `findings[${finding.code}] sample "${token}"는 화이트리스트를 통과해야 한다`).toMatch(
            WHITELIST_PATTERN
          );
        }
      }
      if (typeof details.rootTagName === 'string') {
        expect(
          details.rootTagName.length,
          `findings[${finding.code}] rootTagName 길이는 32 이하여야 한다`
        ).toBeLessThanOrEqual(32);
        expect(
          details.rootTagName,
          `findings[${finding.code}] rootTagName "${details.rootTagName}"는 화이트리스트를 통과해야 한다`
        ).toMatch(WHITELIST_PATTERN);
      }
    }
    // 단언이 vacuous하게 통과하지 않도록 fixture가 실제로 sample을 1건 이상 산출함을 고정한다.
    expect(sawSamples, 'fixture는 sample을 산출하는 finding을 최소 1건 만들어야 한다').toBe(true);
  });
});
