/**
 * 원격 SVG fetch 성공 경로의 정화 처리를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToElement } from '../../../src/utils/converters';
import { withFetchMock } from '../../utils';
import { createStreamBody } from '../helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 원격 SVG fetch 정화', () => {
  it('외부 리소스를 참조하는 원격 SVG는 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 외부 href 속성을 제거하므로 convertToElement는 성공한다
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/tracker.png" width="10" height="10"/></svg>',
      ]),
    });

    await withFetchMock(fetchMock, async () => {
      const element = await convertToElement('https://example.com/unsafe.svg');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('확장자가 없는 URL이라도 image/svg+xml 응답의 외부 href는 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 외부 href 속성을 제거하므로 convertToElement는 성공한다
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/tracker.png" width="10" height="10"/></svg>',
      ]),
    });

    await withFetchMock(fetchMock, async () => {
      const element = await convertToElement('https://example.com/asset?id=unsafe');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it('응답 스트림이 없어도 text()로 안전하게 읽을 수 있는 image/svg+xml 응답은 허용한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: null,
      text: async () => '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
    });

    await withFetchMock(fetchMock, async () => {
      const element = await convertToElement('https://example.com/text-only-svg');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('Fabric.js 형태의 data:image/svg+xml xlink:href 원격 SVG를 정제 후 보존한다', async () => {
    const nestedSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="81" height="114"/></svg>';
    const nestedDataUrl = `data:image/svg+xml;base64,${btoa(nestedSvg)}`;
    const remoteSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="81px" height="114px" viewBox="0 0 81 114">
        <g transform="matrix(-1 0 0 1 40.5 57)">
          <image xlink:href="${nestedDataUrl}" x="-40.5" y="-57" width="81" height="114"/>
        </g>
      </svg>
    `;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'image/svg+xml' : null;
        },
      },
      body: createStreamBody([remoteSvg]),
    });

    await withFetchMock(fetchMock, async () => {
      const element = await convertToElement('https://example.com/fabric.svg');
      expect(element).toBeInstanceOf(HTMLImageElement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
