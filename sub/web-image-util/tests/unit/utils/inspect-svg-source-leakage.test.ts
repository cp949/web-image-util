import { describe, expect, it } from 'vitest';
import { inspectSvgSource } from '../../../src/utils/inspect-svg-source';
import { collectReportStrings } from './inspect-svg-source-helpers';

describe('inspectSvgSource() — 보고서 누출 방지 회귀', () => {
  // sentinel 7종은 누출 의도를 fixture 자체로 드러내야 하므로 helper로 빼지 않고 본 파일에 둔다.
  const sentinelQueryToken = 'LEAKCANARY-QUERY-ISP-9XQ7';
  const sentinelFragmentToken = 'LEAKCANARY-FRAG-ISP-9XQ7';
  const sentinelDataUrlPayload = 'LEAKCANARY-DATAURL-ISP-9XQ7-PAYLOAD';
  const sentinelBlobBody = 'LEAKCANARY-BLOB-ISP-9XQ7-BODY';
  const sentinelHost = 'leakcanary-isp-host-9xq7.example.com';

  const sentinels = [
    sentinelQueryToken,
    sentinelFragmentToken,
    sentinelDataUrlPayload,
    sentinelBlobBody,
    sentinelHost,
    'LEAKCANARY-DATAURL-ISP', // sentinelDataUrlPayload 부분 문자열
    'LEAKCANARY-BLOB-ISP', // sentinelBlobBody 부분 문자열
  ];

  it('URL query/fragment sentinel이 report JSON에 포함되지 않는다', async () => {
    const urlInput = `https://inspect-test.example.com/path.svg?token=${sentinelQueryToken}#${sentinelFragmentToken}`;
    const result = await inspectSvgSource(urlInput, { fetch: 'never' });
    const json = JSON.stringify(result);
    for (const sentinel of sentinels) {
      expect(json, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
    }
  });

  it('URL report의 모든 string 값에 sentinel substring이 없다', async () => {
    const urlInput = `https://inspect-test.example.com/path.svg?token=${sentinelQueryToken}#${sentinelFragmentToken}`;
    const result = await inspectSvgSource(urlInput, { fetch: 'never' });
    const strings = collectReportStrings(result);
    for (const sentinel of sentinels) {
      for (const str of strings) {
        expect(str, `report string "${str}"에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
      }
    }
  });

  it('Data URL base64 payload sentinel이 report JSON에 포함되지 않는다', async () => {
    const dataUrl = `data:image/svg+xml;base64,${sentinelDataUrlPayload}`;
    const result = await inspectSvgSource(dataUrl);
    const json = JSON.stringify(result);
    for (const sentinel of sentinels) {
      expect(json, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
    }
  });

  it('Data URL report의 모든 string 값에 sentinel substring이 없다', async () => {
    const dataUrl = `data:image/svg+xml;base64,${sentinelDataUrlPayload}`;
    const result = await inspectSvgSource(dataUrl);
    const strings = collectReportStrings(result);
    for (const sentinel of sentinels) {
      for (const str of strings) {
        expect(str, `report string "${str}"에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
      }
    }
  });

  it('Blob sentinel 본문과 외부 URL이 report JSON에 포함되지 않는다', async () => {
    const blobSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="https://${sentinelHost}/page">${sentinelBlobBody}</a></svg>`;
    const blob = new Blob([blobSvg], { type: 'image/svg+xml' });
    const result = await inspectSvgSource(blob);
    const json = JSON.stringify(result);
    for (const sentinel of sentinels) {
      expect(json, `sentinel "${sentinel}"이 report JSON에 포함됨`).not.toContain(sentinel);
    }
  });

  it('Blob report의 모든 string 값에 sentinel substring이 없다', async () => {
    const blobSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="https://${sentinelHost}/page">${sentinelBlobBody}</a></svg>`;
    const blob = new Blob([blobSvg], { type: 'image/svg+xml' });
    const result = await inspectSvgSource(blob);
    const strings = collectReportStrings(result);
    for (const sentinel of sentinels) {
      for (const str of strings) {
        expect(str, `report string "${str}"에 sentinel "${sentinel}" 포함`).not.toContain(sentinel);
      }
    }
  });
});

describe('inspectSvgSource() — URL 마스킹 / 누출 방지', () => {
  it('Data URL의 base64 payload가 report JSON에 포함되지 않는다', async () => {
    const SENTINEL = 'SENTINEL_BASE64_PAYLOAD_XYZ';
    const dataUrl = `data:image/svg+xml;base64,${SENTINEL}`;
    const result = await inspectSvgSource(dataUrl);
    const json = JSON.stringify(result);
    expect(json).not.toContain(SENTINEL);
  });

  it('URL query token과 fragment가 report JSON에 포함되지 않는다', async () => {
    const result = await inspectSvgSource('https://h.example/path/to/foo.svg?token=MYTOKEN123#MYFRAG456', {
      fetch: 'never',
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain('MYTOKEN123');
    expect(json).not.toContain('MYFRAG456');
  });

  it('URL 인스턴스 입력도 query/fragment가 마스킹된다', async () => {
    const url = new URL('https://cdn.example/icon.svg?sso=SSOTOKEN&x=1#anchor');
    const result = await inspectSvgSource(url, { fetch: 'never' });
    expect(result.source.url).toBe('https://cdn.example/icon.svg');
    const json = JSON.stringify(result);
    expect(json).not.toContain('SSOTOKEN');
  });
});
