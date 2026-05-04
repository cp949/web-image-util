/**
 * 인라인 SVG 문자열·Blob·Data URL 입력에 대한 정화 파이프라인 보안 계약을 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../src/core/source-converter';
import { convertToElement } from '../../src/utils/converters';
import { sanitizeSvg } from '../../src/utils/svg-sanitizer';
import { SVG_LIMIT_BYTES } from './helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 인라인·Blob SVG 정화', () => {
  it('safe 경로는 sanitize 후 10MiB 미만이 되는 과대 script SVG도 원본 기준으로 차단한다', async () => {
    const safeBody = '<rect width="10" height="10"/>';
    const svgPrefix = '<svg xmlns="http://www.w3.org/2000/svg">';
    const svgSuffix = `${safeBody}</svg>`;
    const scriptPrefix = '<script>';
    const scriptSuffix = '</script>';
    const limitBytes = SVG_LIMIT_BYTES;
    const fixedBytes = new TextEncoder().encode(svgPrefix + scriptPrefix + scriptSuffix + svgSuffix).length;
    const scriptPayload = 'a'.repeat(limitBytes - fixedBytes + 1);
    const oversizedSvg = `${svgPrefix}${scriptPrefix}${scriptPayload}${scriptSuffix}${svgSuffix}`;
    const sanitizedSvg = sanitizeSvg(oversizedSvg);

    expect(new TextEncoder().encode(oversizedSvg).length).toBeGreaterThan(limitBytes);
    expect(new TextEncoder().encode(sanitizedSvg).length).toBeLessThan(limitBytes);

    await expect(convertToElement(oversizedSvg)).rejects.toMatchObject({
      code: 'SVG_BYTES_EXCEEDED',
      details: {
        actualBytes: expect.any(Number),
        maxBytes: SVG_LIMIT_BYTES,
      },
    });
  });

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

  it('상대 경로 참조가 포함된 SVG 문자열은 외부 리소스로 간주해 거부한다', async () => {
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>';

    await expect(convertToElement(safeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'external-ref' },
    });
  });

  it('따옴표 없는 상대 경로 href가 포함된 SVG 문자열도 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=./assets/pattern.png width="10" height="10"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'external-ref' },
    });
  });

  it('CSS escape로 숨긴 상대 경로 style URL도 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\\2e \\2e /secret.png)"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('엔티티로 분할된 CSS escape 상대 경로 style URL도 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\\00002&#x65; \\00002&#x65; /secret.png)"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('함수명과 값에 엔티티로 분할된 CSS escape가 있어도 상대 경로 style URL을 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:u\\00007&#x32;l(\\00002&#x65; \\00002&#x65; /secret.png)"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('CSS escape로 숨긴 루트 절대 경로 style URL도 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="fill:url(\\2f assets/tracker.png)"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'style-attribute-url' },
    });
  });

  it('protocol-relative href가 포함된 SVG 문자열은 sanitize 후 렌더링된다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href=//evil.example/pattern.png width="10" height="10"/></svg>';

    const element = await convertToElement(unsafeSvg);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('루트 절대 경로 참조가 포함된 SVG 문자열은 외부 리소스로 간주해 거부한다', async () => {
    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="/assets/pattern.png" width="10" height="10"/></svg>';

    await expect(convertToElement(unsafeSvg)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
      details: { reason: 'external-ref' },
    });
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

  it('MIME 타입이 비어 있는 SVG Blob도 본문을 스니핑해 sanitize 후 렌더링한다', async () => {
    const svgBlob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'],
      { type: '' }
    );

    const element = await convertToElement(svgBlob);
    expect(element).toBeInstanceOf(HTMLImageElement);
  });

  it('SVG Data URL은 allowedProtocols에 data:가 없으면 거부한다', async () => {
    const dataSvg =
      'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2210%22%20height%3D%2210%22%2F%3E%3C%2Fsvg%3E';

    await expect(
      convertToImageElement(dataSvg, {
        allowedProtocols: ['http:', 'https:'],
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('XML MIME 타입의 SVG Blob에 상대 경로 참조가 있으면 보안 게이트에서 차단한다', async () => {
    const svgBlob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><image href="./assets/pattern.png" width="10" height="10"/></svg>'],
      { type: 'application/xml' }
    );

    await expect(convertToElement(svgBlob)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });
});
