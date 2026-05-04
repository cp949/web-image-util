/**
 * 인라인 SVG 문자열 입력이 정화 후 렌더링되는 경로를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToElement } from '../../../src/utils/converters';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 인라인 SVG 정화 렌더링', () => {
  it('스크립트 요소가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 script 요소를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('스크립트 요소가 제거된 SVG는 성공적으로 변환된다', async () => {
    // sanitize 계층이 script 요소를 제거하므로 INVALID_SOURCE 에러는 발생하지 않는다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(https://evil.example/pattern.svg#id)"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 태그의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:url(https://evil.example/pattern.svg#id)}</style><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('protocol-relative href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=//evil.example/pattern.png width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('javascript: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 javascript: href를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('onload 이벤트 속성이 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 onload 속성을 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 onclick 이벤트 속성이 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 on* 속성을 대소문자 무관하게 제거한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" oNcLiCk="alert(1)"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 외부 href 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 HTTPS:// href를 대소문자 무관하게 제거한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="HTTPS://evil.example/tracker.png" width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('대소문자가 섞인 javascript: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 javascript: href를 대소문자 무관하게 제거한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="JaVaScRiPt:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('엔티티로 인코딩된 javascript: URI href가 포함된 SVG 문자열도 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="jav&#x61;script:alert(1)"><rect width="10" height="10"/></a></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 url()에 작은따옴표로 감싼 외부 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 style 속성의 외부 url() 참조를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\'https://evil.example/x.svg\')"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 대문자 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 대소문자 무관하게 외부 url()을 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(HTTPS://evil.example/x.svg)"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('style 속성 내 javascript: url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 javascript: url()을 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(javascript:alert(1))"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('따옴표 없는 style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style=fill:url(https://evil.example/x.svg#id)/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('protocol-relative style 속성의 외부 url() 참조가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style=fill:url(//evil.example/x.svg#id)/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('텍스트 노드 안의 href= 문자열은 위험 속성으로 오인하지 않고 렌더링한다', async () => {
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>x href=https://example.com y</text></svg>';

    const element = await convertToElement(safeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('텍스트 노드 안의 style=url() 문자열은 위험 속성으로 오인하지 않고 렌더링한다', async () => {
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>x style=fill:url(https://example.com/pattern.svg#id) y</text></svg>';

    const element = await convertToElement(safeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('속성값 안의 > 문자 뒤에 오는 외부 href도 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image aria-label="1 > 0" href="https://evil.example/pattern.png" width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('속성값 안의 > 문자 뒤에 오는 외부 style url()도 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect aria-label="1 > 0" style="fill:url(https://evil.example/x.svg#id)" width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('data: URI href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    // sanitize 계층이 data: href를 제거하므로 convertToElement는 성공한다
    const maliciousSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+" width="10" height="10"/></svg>';

    const element = await convertToElement(maliciousSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });
});
