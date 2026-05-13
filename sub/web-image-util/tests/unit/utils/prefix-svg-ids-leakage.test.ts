import { describe, expect, it } from 'vitest';
import { prefixSvgIds } from '../../../src/utils/prefix-svg-ids';
import { collectReportStrings } from './prefix-svg-ids-helpers';

describe('prefixSvgIds() — 보고서 누출 방지 회귀', () => {
  // sentinel 7종과 dangerousSvg는 누출 의도를 fixture 자체로 드러내야 하므로
  // helper로 빼지 않고 본 파일 안에 둔다.
  const sentinelHost = 'leak-canary-prefix.example.com';
  const sentinelDataUrl = 'data:image/svg+xml;base64,LEAK_CANARY_PREFIX_PAYLOAD';
  const sentinelDanglingFragment = 'leak-canary-dangling-token';
  const sentinelExternalRef = `sprite.svg#leak-canary-external-token`;
  const sentinels = [
    sentinelHost,
    sentinelDataUrl,
    sentinelDanglingFragment,
    sentinelExternalRef,
    'LEAK_CANARY_PREFIX_PAYLOAD',
    'leak-canary-dangling',
    'leak-canary-external',
  ];

  const dangerousSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect id="real-id"/>
        <use xlink:href="#${sentinelDanglingFragment}"/>
        <use href="${sentinelExternalRef}"/>
        <a href="http://${sentinelHost}/page"/>
        <image href="${sentinelDataUrl}"/>
      </svg>
    `;

  it('report JSON에 sentinel 7종이 포함되지 않는다', () => {
    const result = prefixSvgIds(dangerousSvg, 'safe');
    const reportJson = JSON.stringify(result.report);
    for (const sentinel of sentinels) {
      expect(reportJson, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
    }
  });

  it('report의 모든 string 값에 sentinel substring이 없다', () => {
    const result = prefixSvgIds(dangerousSvg, 'safe');
    const strings = collectReportStrings(result.report);
    for (const sentinel of sentinels) {
      for (const str of strings) {
        expect(str, `report string "${str}"에 sentinel "${sentinel}"이 포함됨`).not.toContain(sentinel);
      }
    }
  });
});
