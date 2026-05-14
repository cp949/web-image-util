/**
 * SVG Blob, Data URL, 크기 제한 같은 입력 경계 계약을 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToImageElement } from '../../../src/core/source-converter';
import { ensureImageElement } from '../../../src/utils/converters';
import { sanitizeSvg } from '../../../src/utils/svg-sanitizer';
import { SVG_LIMIT_BYTES } from '../helpers/svg-test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('보안: 인라인·Blob SVG 입력 경계', () => {
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

    await expect(ensureImageElement(oversizedSvg)).rejects.toMatchObject({
      code: 'SVG_BYTES_EXCEEDED',
      details: {
        actualBytes: expect.any(Number),
        maxBytes: SVG_LIMIT_BYTES,
      },
    });
  });

  it('MIME 타입이 비어 있는 SVG Blob도 본문을 스니핑해 sanitize 후 렌더링한다', async () => {
    const svgBlob = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>'],
      { type: '' }
    );

    const element = await ensureImageElement(svgBlob);
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

    await expect(ensureImageElement(svgBlob)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });
});
