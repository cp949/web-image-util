import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import {
  type InspectSvgSanitizationStage,
  type InspectSvgSanitizationStageCode,
  inspectSvgSanitization,
} from '../../../src/svg-sanitizer/inspect-sanitization';
import { sanitizeSvgForRendering } from '../../../src/utils/svg-sanitizer';

const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

/** stages 배열에서 특정 code의 stage를 찾는다. 없으면 undefined. */
function findStage(
  stages: InspectSvgSanitizationStage[],
  code: InspectSvgSanitizationStageCode
): InspectSvgSanitizationStage | undefined {
  return stages.find((stage) => stage.code === code);
}

describe('inspectSvgSanitization()', () => {
  describe('비문자열 입력 검증', () => {
    it('숫자 입력 시 ImageProcessError를 던지고 actualType이 "number"다', async () => {
      try {
        await inspectSvgSanitization(123 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('number');
      }
    });

    it('undefined 입력 시 actualType이 "undefined"다', async () => {
      try {
        await inspectSvgSanitization(undefined as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('undefined');
      }
    });

    it('null 입력 시 actualType이 "null"이다', async () => {
      try {
        await inspectSvgSanitization(null as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('null');
      }
    });

    it('일반 객체 입력 시 actualType이 "object"다', async () => {
      try {
        await inspectSvgSanitization({} as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('object');
      }
    });
  });

  describe('옵션 정책 검증', () => {
    it('지원하지 않는 policy 문자열은 ImageProcessError를 던진다', async () => {
      try {
        await inspectSvgSanitization(TINY_SVG, { policy: 'foo' as unknown as 'lightweight' });
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('INVALID_SOURCE');
        expect((e as ImageProcessError).details?.policy).toBe('foo');
      }
    });

    it('policy 미지정 시 보고서의 policy 필드가 기본값 lightweight다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      expect(report.policy).toBe('lightweight');
    });
  });

  describe('정상 입력 — 정책별 placeholder 보고서', () => {
    it('lightweight: 보고서의 bytes·byteLimit·environment·impact 기본 형태가 일치한다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      const sanitizedBytes = new TextEncoder().encode(sanitizeSvgForRendering(TINY_SVG)).length;
      expect(report.bytes).toBe(new TextEncoder().encode(TINY_SVG).length);
      expect(report.byteLimit).toBe(MAX_SVG_BYTES);
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(report.environment);
      expect(report.policy).toBe('lightweight');
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind === 'lightweight') {
        expect(report.impact.status).toBe('ok');
        expect(report.impact.outputBytes).toBe(sanitizedBytes);
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure).toBeNull();
      }
    });

    it('strict: impact.kind가 strict이고 outputNodeCount는 0(placeholder)이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG, { policy: 'strict' });
      expect(report.policy).toBe('strict');
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind === 'strict') {
        expect(report.impact.status).toBe('ok');
        expect(report.impact.outputBytes).toBe(report.bytes);
        expect(report.impact.outputNodeCount).toBe(0);
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure).toBeNull();
      }
    });

    it('skip: impact.kind가 skip이고 potentialStages가 빈 배열이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG, { policy: 'skip' });
      expect(report.policy).toBe('skip');
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind === 'skip') {
        expect(report.impact.status).toBe('not-applied');
        expect(report.impact.potentialStages).toEqual([]);
      }
    });
  });

  describe('byte 초과 → 정책별 fallback', () => {
    // MAX_SVG_BYTES = 10 MiB. 한 글자 = 1 byte ASCII이므로 +1로 초과를 만든다.
    const oversizedInput = 'a'.repeat(MAX_SVG_BYTES + 1);

    it('lightweight: failure.code가 svg-bytes-exceeded이고 outputBytes가 null이다', async () => {
      const report = await inspectSvgSanitization(oversizedInput);
      expect(report.bytes).toBe(MAX_SVG_BYTES + 1);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind === 'lightweight') {
        expect(report.impact.status).toBe('failed');
        expect(report.impact.outputBytes).toBeNull();
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure?.code).toBe('svg-bytes-exceeded');
      }
    });

    it('strict: failure.code가 svg-bytes-exceeded이고 outputNodeCount가 null이다', async () => {
      const report = await inspectSvgSanitization(oversizedInput, { policy: 'strict' });
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind === 'strict') {
        expect(report.impact.status).toBe('failed');
        expect(report.impact.outputBytes).toBeNull();
        expect(report.impact.outputNodeCount).toBeNull();
        expect(report.impact.failure?.code).toBe('svg-bytes-exceeded');
      }
    });

    it('skip: byte 초과여도 항상 not-applied + 빈 potentialStages를 반환한다', async () => {
      const report = await inspectSvgSanitization(oversizedInput, { policy: 'skip' });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind === 'skip') {
        expect(report.impact.status).toBe('not-applied');
        expect(report.impact.potentialStages).toEqual([]);
      }
    });
  });

  describe('환경 감지', () => {
    it('happy-dom 기본 환경에서 environment가 "happy-dom"이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      expect(report.environment).toBe('happy-dom');
    });
  });

  describe('lightweight 일반 stage 수집', () => {
    it('script 요소가 있으면 script-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'script-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['script']);
    });

    it('foreignObject 요소가 있으면 foreign-object-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject></foreignObject></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'foreign-object-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['foreignobject']);
    });

    it('on* 속성이 있으면 event-handler-removed stage가 발생 attribute 수만큼 카운트된다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="x"><rect onclick="y"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'event-handler-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(2);
      expect(stage?.samples).toContain('onload');
      expect(stage?.samples).toContain('onclick');
    });

    it('외부 xlink:href는 external-href-removed stage로 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="http://evil.example.com/sprite#a"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'external-href-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['xlink:href']);
    });

    it('style 속성에 외부 url(...)이 있으면 external-css-removed stage가 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill: url(http://evil.example.com/p.png)"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'external-css-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['style']);
    });

    it('<style> 본문에 외부 url(...)이 있으면 samples 토큰은 style-tag다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { fill: url(http://evil.example.com/p.png); }</style></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'external-css-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['style-tag']);
    });

    it('lightweight 정책에서는 doctype-removed stage가 포함되지 않는다', async () => {
      const report = await inspectSvgSanitization('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(findStage(report.impact.stages, 'doctype-removed')).toBeUndefined();
      expect(findStage(report.impact.stages, 'entity-removed')).toBeUndefined();
    });

    it('정상 SVG에서는 stages가 빈 배열이다', async () => {
      const report = await inspectSvgSanitization(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10"/></svg>'
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.stages).toEqual([]);
    });

    it('outputBytes는 sanitizeSvgForRendering 결과 byte와 동일하다', async () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>';
      const report = await inspectSvgSanitization(input);
      const expected = new TextEncoder().encode(sanitizeSvgForRendering(input)).length;
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.outputBytes).toBe(expected);
    });

    it('multi-occurrence 입력에서 event-handler/script count가 정확하다', async () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg" onload="a" onclick="b"><script>c</script><script>d</script></svg>';
      const report = await inspectSvgSanitization(input);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const event = findStage(report.impact.stages, 'event-handler-removed');
      const script = findStage(report.impact.stages, 'script-removed');
      expect(event?.count).toBe(2);
      expect(script?.count).toBe(2);
    });

    it('파싱 실패 입력도 status는 ok이고 stages는 빈 배열이며 outputBytes는 정제 결과 byte다', async () => {
      const input = '<not-svg-root>broken<';
      const report = await inspectSvgSanitization(input);
      const expected = new TextEncoder().encode(sanitizeSvgForRendering(input)).length;
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.status).toBe('ok');
      expect(report.impact.stages).toEqual([]);
      expect(report.impact.outputBytes).toBe(expected);
      expect(report.impact.failure).toBeNull();
    });
  });

  describe('skip 정책 — potentialStages 시뮬레이션', () => {
    it('script 요소가 있으면 potentialStages에 script-removed가 포함된다', async () => {
      const report = await inspectSvgSanitization('<svg xmlns="http://www.w3.org/2000/svg"><script></script></svg>', {
        policy: 'skip',
      });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind !== 'skip') return;
      expect(report.impact.status).toBe('not-applied');
      const stage = findStage(report.impact.potentialStages, 'script-removed');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      // outputBytes 필드는 타입상 skip impact에 존재하지 않음(컴파일 타임 보장).
      expect('outputBytes' in report.impact).toBe(false);
    });

    it('skip 정책에서도 doctype-removed는 potentialStages에 포함되지 않는다', async () => {
      const report = await inspectSvgSanitization('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        policy: 'skip',
      });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind !== 'skip') return;
      expect(findStage(report.impact.potentialStages, 'doctype-removed')).toBeUndefined();
    });
  });

  describe('embedded image stage 수집', () => {
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

    it('PNG data URL은 data-image-preserved stage로 잡히고 samples에 image/png가 담긴다', async () => {
      const report = await inspectSvgSanitization(
        `<svg ${XMLNS}><image href="data:image/png;base64,${TINY_PNG_BASE64}"/></svg>`
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-preserved');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['image/png']);
    });

    it('xlink:href로 참조한 JPEG data URL도 data-image-preserved로 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        `<svg ${XMLNS} ${XLINK}><image xlink:href="data:image/jpeg;base64,${TINY_JPEG_BASE64}"/></svg>`
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-preserved');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['image/jpeg']);
    });

    it('미허용 MIME data URL은 data-image-blocked stage로 잡히고 samples에 원본 MIME이 담긴다', async () => {
      const report = await inspectSvgSanitization(
        `<svg ${XMLNS}><image href="data:application/x-shockwave-flash;base64,Q1dT"/></svg>`
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-blocked');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['application/x-shockwave-flash']);
      // external-href-removed로 중복 카운트되지 않는다.
      expect(findStage(report.impact.stages, 'external-href-removed')).toBeUndefined();
    });

    it('크기 초과 PNG data URL은 data-image-blocked로 분기된다', async () => {
      // MAX_EMBEDDED_DATA_IMAGE_BYTES = 2 * 1024 * 1024 (= 2,097,152).
      // base64 'A' 문자만으로 N자를 만들면 decodedBytes = floor(N * 3 / 4).
      // decodedBytes > 2,097,152 가 되려면 N >= 2,796,204.
      const payloadChars = 2_796_204;
      const oversizedPayload = 'A'.repeat(payloadChars);
      const input = `<svg ${XMLNS}><image href="data:image/png;base64,${oversizedPayload}"/></svg>`;
      const report = await inspectSvgSanitization(input);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-blocked');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['image/png']);
      expect(findStage(report.impact.stages, 'data-image-preserved')).toBeUndefined();
    });

    it('base64 SVG data URL은 nested-svg-resanitized stage로 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        `<svg ${XMLNS}><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>`
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'nested-svg-resanitized');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['image/svg+xml']);
    });

    it('URL-encoded SVG data URL도 nested-svg-resanitized로 잡힌다', async () => {
      const report = await inspectSvgSanitization(
        `<svg ${XMLNS}><image href="data:image/svg+xml,%3Csvg%2F%3E"/></svg>`
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'nested-svg-resanitized');
      expect(stage).toBeDefined();
      expect(stage?.count).toBe(1);
      expect(stage?.samples).toEqual(['image/svg+xml']);
    });

    it('외부 URL과 raster data URL이 같이 있으면 두 stage가 각각 1로 분리되어 카운트된다', async () => {
      const report = await inspectSvgSanitization(
        `<svg ${XMLNS}><image href="http://evil.example.com/a.png"/><image href="data:image/png;base64,${TINY_PNG_BASE64}"/></svg>`
      );
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const external = findStage(report.impact.stages, 'external-href-removed');
      const preserved = findStage(report.impact.stages, 'data-image-preserved');
      expect(external?.count).toBe(1);
      expect(preserved?.count).toBe(1);
    });

    it('skip 정책의 potentialStages는 lightweight stages와 동일한 embedded image 카운트를 가진다', async () => {
      const input = `<svg ${XMLNS}><image href="data:image/png;base64,${TINY_PNG_BASE64}"/><image href="data:image/svg+xml;base64,PHN2Zy8+"/><image href="data:application/x-shockwave-flash;base64,Q1dT"/></svg>`;
      const lightweight = await inspectSvgSanitization(input);
      const skip = await inspectSvgSanitization(input, { policy: 'skip' });
      expect(lightweight.impact.kind).toBe('lightweight');
      expect(skip.impact.kind).toBe('skip');
      if (lightweight.impact.kind !== 'lightweight' || skip.impact.kind !== 'skip') return;

      const codes: InspectSvgSanitizationStageCode[] = [
        'data-image-preserved',
        'data-image-blocked',
        'nested-svg-resanitized',
      ];
      for (const code of codes) {
        const fromLightweight = findStage(lightweight.impact.stages, code);
        const fromSkip = findStage(skip.impact.potentialStages, code);
        expect(fromSkip).toEqual(fromLightweight);
      }
    });

    it('동일 mimeType의 raster가 4번 등장하면 count=4지만 samples는 단일 항목이다', async () => {
      const cell = `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>`;
      const input = `<svg ${XMLNS}>${cell}${cell}${cell}${cell}</svg>`;
      const report = await inspectSvgSanitization(input);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-preserved');
      expect(stage?.count).toBe(4);
      expect(stage?.samples).toEqual(['image/png']);
    });

    it('서로 다른 mimeType 3개 raster는 samples 길이 3에 발생 순서를 보존한다', async () => {
      const input =
        `<svg ${XMLNS}>` +
        `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>` +
        `<image href="data:image/jpeg;base64,${TINY_JPEG_BASE64}"/>` +
        `<image href="data:image/webp;base64,${TINY_WEBP_BASE64}"/>` +
        `</svg>`;
      const report = await inspectSvgSanitization(input);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-preserved');
      expect(stage?.count).toBe(3);
      expect(stage?.samples).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    });

    it('서로 다른 mimeType 4종 raster는 samples 처음 3개만 보존한다', async () => {
      const input =
        `<svg ${XMLNS}>` +
        `<image href="data:image/png;base64,${TINY_PNG_BASE64}"/>` +
        `<image href="data:image/jpeg;base64,${TINY_JPEG_BASE64}"/>` +
        `<image href="data:image/webp;base64,${TINY_WEBP_BASE64}"/>` +
        `<image href="data:image/gif;base64,${TINY_GIF_BASE64}"/>` +
        `</svg>`;
      const report = await inspectSvgSanitization(input);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      const stage = findStage(report.impact.stages, 'data-image-preserved');
      expect(stage?.count).toBe(4);
      expect(stage?.samples).toHaveLength(3);
      expect(stage?.samples).toEqual(['image/png', 'image/jpeg', 'image/webp']);
      expect(stage?.samples).not.toContain('image/gif');
    });
  });
});
