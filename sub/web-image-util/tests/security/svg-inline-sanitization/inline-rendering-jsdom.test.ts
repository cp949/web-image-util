/**
 * 인라인 SVG 정화 렌더링 중 jsdom에서 안전한 케이스를 모은다.
 *
 * 따옴표 없는 style 속성 / protocol-relative style 속성 두 케이스는 jsdom의 DOMPurify 처리가
 * 다른 sanitization 결과를 내 SVG가 깨져 SOURCE_LOAD_FAILED로 거부되므로 browser 보안 스모크에서 대표 경로를 확인한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureImageElement } from '../../../src/utils/converters';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 인라인 SVG 정화 렌더링 (jsdom-safe)', () => {
  it('스크립트 요소가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(https://evil.example/pattern.svg#id)"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 태그의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:url(https://evil.example/pattern.svg#id)}</style><rect width="10" height="10"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('protocol-relative href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=//evil.example/pattern.png width="10" height="10"/></svg>';

    const element = await ensureImageElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('javascript: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('onload 이벤트 속성이 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 onclick 이벤트 속성이 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" oNcLiCk="alert(1)"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 외부 href 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="HTTPS://evil.example/tracker.png" width="10" height="10"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 javascript: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="JaVaScRiPt:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('엔티티로 인코딩된 javascript: URI href가 포함된 SVG 문자열도 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="jav&#x61;script:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 url()에 작은따옴표로 감싼 외부 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\'https://evil.example/x.svg\')"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 대문자 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(HTTPS://evil.example/x.svg)"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 javascript: url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(javascript:alert(1))"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('텍스트 노드 안의 href= 문자열은 위험 속성으로 오인하지 않고 렌더링한다', async () => {
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>x href=https://example.com y</text></svg>';

    const element = await ensureImageElement(safeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('텍스트 노드 안의 style=url() 문자열은 위험 속성으로 오인하지 않고 렌더링한다', async () => {
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>x style=fill:url(https://example.com/pattern.svg#id) y</text></svg>';

    const element = await ensureImageElement(safeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('속성값 안의 > 문자 뒤에 오는 외부 href도 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image aria-label="1 > 0" href="https://evil.example/pattern.png" width="10" height="10"/></svg>';

    const element = await ensureImageElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('속성값 안의 > 문자 뒤에 오는 외부 style url()도 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect aria-label="1 > 0" style="fill:url(https://evil.example/x.svg#id)" width="10" height="10"/></svg>';

    const element = await ensureImageElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('data: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+" width="10" height="10"/></svg>';

    const element = await ensureImageElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });
});
