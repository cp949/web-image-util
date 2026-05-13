import { describe, expect, it } from 'vitest';
import {
  type InspectSvgSanitizationReport,
  type InspectSvgSanitizationStageCode,
  inspectSvgSanitization,
} from '../../../src/svg-sanitizer/inspect-sanitization';
import { findStage } from './inspect-sanitization-helpers';

describe('inspectSvgSanitization() embedded image stage 수집', () => {
  // 작은 PNG payload (16 bytes). MAX_EMBEDDED_DATA_IMAGE_BYTES(2 MiB) 이하라 보존 대상.
  const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUg==';
  // 작은 JPEG payload. 8 bytes 미만이라 보존 대상.
  const TINY_JPEG_BASE64 = '/9j/4AAQ';
  // 작은 WEBP payload. 임의 base64 문자열.
  const TINY_WEBP_BASE64 = 'UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAA==';
  // 작은 GIF payload (GIF89a 시작 magic + 일부). 임의 base64 문자열.
  const TINY_GIF_BASE64 = 'R0lGODlhAQABAAAAACw=';
  const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';
  const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

  const svgWith = (children: string, extraAttributes = '') =>
    `<svg ${XMLNS}${extraAttributes ? ` ${extraAttributes}` : ''}>${children}</svg>`;

  function expectLightweightStages(report: InspectSvgSanitizationReport) {
    expect(report.impact.kind).toBe('lightweight');
    if (report.impact.kind !== 'lightweight') {
      throw new Error(`lightweight impact가 필요하지만 ${report.impact.kind}를 받았다`);
    }
    return report.impact.stages;
  }

  async function inspectLightweightStages(input: string) {
    return expectLightweightStages(await inspectSvgSanitization(input));
  }

  it.each([
    {
      name: 'PNG href data URL',
      input: svgWith(`<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>`),
      expectedMimeType: 'image/png',
    },
    {
      name: 'JPEG xlink:href data URL',
      input: svgWith(`<image xlink:href="data:image/jpeg;base64,${TINY_JPEG_BASE64}"/>`, XLINK),
      expectedMimeType: 'image/jpeg',
    },
  ])('$name은 data-image-preserved stage로 잡히고 samples에 MIME이 담긴다', async ({ input, expectedMimeType }) => {
    const stages = await inspectLightweightStages(input);
    const stage = findStage(stages, 'data-image-preserved');
    expect(stage).toBeDefined();
    expect(stage?.count).toBe(1);
    expect(stage?.samples).toEqual([expectedMimeType]);
  });

  it('미허용 MIME data URL은 data-image-blocked stage로 잡히고 samples에 원본 MIME이 담긴다', async () => {
    const stages = await inspectLightweightStages(
      svgWith('<image href="data:application/x-shockwave-flash;base64,Q1dT"/>')
    );
    const stage = findStage(stages, 'data-image-blocked');
    expect(stage).toBeDefined();
    expect(stage?.count).toBe(1);
    expect(stage?.samples).toEqual(['application/x-shockwave-flash']);
    // external-href-removed로 중복 카운트되지 않는다.
    expect(findStage(stages, 'external-href-removed')).toBeUndefined();
  });

  it('크기 초과 PNG data URL은 data-image-blocked로 분기된다', async () => {
    // MAX_EMBEDDED_DATA_IMAGE_BYTES = 2 * 1024 * 1024 (= 2,097,152).
    // base64 'A' 문자만으로 N자를 만들면 decodedBytes = floor(N * 3 / 4).
    // decodedBytes > 2,097,152 가 되려면 N >= 2,796,204.
    const payloadChars = 2_796_204;
    const oversizedPayload = 'A'.repeat(payloadChars);
    const stages = await inspectLightweightStages(svgWith(`<image href="data:image/png;base64,${oversizedPayload}"/>`));
    const stage = findStage(stages, 'data-image-blocked');
    expect(stage).toBeDefined();
    expect(stage?.count).toBe(1);
    expect(stage?.samples).toEqual(['image/png']);
    expect(findStage(stages, 'data-image-preserved')).toBeUndefined();
  });

  it.each([
    {
      name: 'base64 SVG data URL',
      href: 'data:image/svg+xml;base64,PHN2Zy8+',
    },
    {
      name: 'URL-encoded SVG data URL',
      href: 'data:image/svg+xml,%3Csvg%2F%3E',
    },
  ])('$name은 nested-svg-resanitized stage로 잡힌다', async ({ href }) => {
    const stages = await inspectLightweightStages(svgWith(`<image href="${href}"/>`));
    const stage = findStage(stages, 'nested-svg-resanitized');
    expect(stage).toBeDefined();
    expect(stage?.count).toBe(1);
    expect(stage?.samples).toEqual(['image/svg+xml']);
  });

  it('외부 URL과 raster data URL이 같이 있으면 두 stage가 각각 1로 분리되어 카운트된다', async () => {
    const stages = await inspectLightweightStages(
      svgWith(`<image href="http://evil.example.com/a.png"/><image href="data:image/png;base64,${TINY_PNG_BASE64}"/>`)
    );
    const external = findStage(stages, 'external-href-removed');
    const preserved = findStage(stages, 'data-image-preserved');
    expect(external?.count).toBe(1);
    expect(preserved?.count).toBe(1);
  });

  it('skip 정책의 potentialStages는 lightweight stages와 동일한 embedded image 카운트를 가진다', async () => {
    const input = svgWith(
      `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>` +
        '<image href="data:image/svg+xml;base64,PHN2Zy8+"/>' +
        '<image href="data:application/x-shockwave-flash;base64,Q1dT"/>'
    );
    const lightweight = await inspectSvgSanitization(input);
    const skip = await inspectSvgSanitization(input, { policy: 'skip' });
    const lightweightStages = expectLightweightStages(lightweight);
    expect(skip.impact.kind).toBe('skip');
    if (skip.impact.kind !== 'skip') {
      throw new Error(`skip impact가 필요하지만 ${skip.impact.kind}를 받았다`);
    }

    const codes: InspectSvgSanitizationStageCode[] = [
      'data-image-preserved',
      'data-image-blocked',
      'nested-svg-resanitized',
    ];
    for (const code of codes) {
      const fromLightweight = findStage(lightweightStages, code);
      const fromSkip = findStage(skip.impact.potentialStages, code);
      expect(fromSkip).toEqual(fromLightweight);
    }
  });

  it('동일 mimeType의 raster가 4번 등장하면 count=4지만 samples는 단일 항목이다', async () => {
    const cell = `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>`;
    const stages = await inspectLightweightStages(svgWith(`${cell}${cell}${cell}${cell}`));
    const stage = findStage(stages, 'data-image-preserved');
    expect(stage?.count).toBe(4);
    expect(stage?.samples).toEqual(['image/png']);
  });

  it.each([
    {
      name: '서로 다른 mimeType 3개 raster',
      imageTags:
        `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>` +
        `<image href="data:image/jpeg;base64,${TINY_JPEG_BASE64}"/>` +
        `<image href="data:image/webp;base64,${TINY_WEBP_BASE64}"/>`,
      expectedCount: 3,
      expectedSamples: ['image/png', 'image/jpeg', 'image/webp'],
      excludedSample: undefined,
    },
    {
      name: '서로 다른 mimeType 4종 raster',
      imageTags:
        `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>` +
        `<image href="data:image/jpeg;base64,${TINY_JPEG_BASE64}"/>` +
        `<image href="data:image/webp;base64,${TINY_WEBP_BASE64}"/>` +
        `<image href="data:image/gif;base64,${TINY_GIF_BASE64}"/>`,
      expectedCount: 4,
      expectedSamples: ['image/png', 'image/jpeg', 'image/webp'],
      excludedSample: 'image/gif',
    },
  ])('$name는 samples에 발생 순서와 최대 개수 정책을 반영한다', async ({
    imageTags,
    expectedCount,
    expectedSamples,
    excludedSample,
  }) => {
    const stages = await inspectLightweightStages(svgWith(imageTags));
    const stage = findStage(stages, 'data-image-preserved');
    expect(stage?.count).toBe(expectedCount);
    expect(stage?.samples).toHaveLength(expectedSamples.length);
    expect(stage?.samples).toEqual(expectedSamples);
    if (excludedSample) {
      expect(stage?.samples).not.toContain(excludedSample);
    }
  });
});
