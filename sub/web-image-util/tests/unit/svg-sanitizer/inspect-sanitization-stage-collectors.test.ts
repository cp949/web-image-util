import { describe, expect, it } from 'vitest';
import { sanitizeSvgStrictDetailed } from '../../../src/svg-sanitizer';
import {
  collectEmbeddedImageStages,
  collectGeneralStages,
} from '../../../src/svg-sanitizer/inspect-sanitization/stage-collectors.internal';
import { findStage } from './inspect-sanitization-helpers';

function parseSvgDocument(svgString: string): Document {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('테스트 SVG 파싱에 실패했다');
  }
  return doc;
}

describe('정화 stage collector helper stage 수집', () => {
  it('strict 정책의 일반 stage를 DOM 신호와 원본 선언에서 수집한다', () => {
    const svgBody =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="x">' +
      '<script>alert(1)</script><style>rect { fill: url(http://evil.example.com/p.png); }</style></svg>';
    const input = `<!DOCTYPE svg [<!ENTITY a "b">]>${svgBody}`;

    const stages = collectGeneralStages(input, parseSvgDocument(svgBody), 'strict');

    expect(findStage(stages, 'script-removed')).toEqual({
      code: 'script-removed',
      count: 1,
      samples: ['script'],
    });
    expect(findStage(stages, 'event-handler-removed')?.count).toBe(1);
    expect(findStage(stages, 'external-css-removed')).toEqual({
      code: 'external-css-removed',
      count: 1,
      samples: ['style-tag'],
    });
    expect(findStage(stages, 'doctype-removed')).toEqual({
      code: 'doctype-removed',
      count: 1,
      samples: ['doctype'],
    });
    expect(findStage(stages, 'entity-removed')).toEqual({
      code: 'entity-removed',
      count: 1,
      samples: ['entity'],
    });
  });

  it('lightweight 정책의 일반 stage는 doctype/entity를 제외한다', () => {
    const svgBody = '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>';
    const input = `<!DOCTYPE svg [<!ENTITY a "b">]>${svgBody}`;

    const stages = collectGeneralStages(input, parseSvgDocument(svgBody), 'lightweight');

    expect(findStage(stages, 'script-removed')?.count).toBe(1);
    expect(findStage(stages, 'doctype-removed')).toBeUndefined();
    expect(findStage(stages, 'entity-removed')).toBeUndefined();
  });

  it('strict 정책은 빈 href를 제거 대상으로 세고, 실제 strict sanitizer 제거와 거울 정합한다', () => {
    const svgBody = '<svg xmlns="http://www.w3.org/2000/svg"><image href=""/></svg>';

    // 진단: strict sanitizer는 빈 href 속성도 제거하므로 external-href-removed로 센다
    const strictStages = collectGeneralStages(svgBody, parseSvgDocument(svgBody), 'strict');
    expect(findStage(strictStages, 'external-href-removed')).toEqual({
      code: 'external-href-removed',
      count: 1,
      samples: ['href'],
    });

    // 거울: 실제 strict sanitizer도 빈 href 속성을 제거한다
    const sanitized = sanitizeSvgStrictDetailed(svgBody).svg;
    expect(sanitized).not.toContain('href');

    // 비대칭 문서화: lightweight sanitizer는 빈 href를 보존하므로 진단도 세지 않는다
    const lightweightStages = collectGeneralStages(svgBody, parseSvgDocument(svgBody), 'lightweight');
    expect(findStage(lightweightStages, 'external-href-removed')).toBeUndefined();
  });

  it('embedded image stage는 보존 raster, 차단 MIME, nested SVG를 분리한다', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="/>' +
      '<image href="data:application/x-shockwave-flash;base64,Q1dT"/>' +
      '<image href="data:image/svg+xml;base64,PHN2Zy8+"/>' +
      '</svg>';

    const stages = collectEmbeddedImageStages(parseSvgDocument(input));

    expect(findStage(stages, 'data-image-preserved')).toEqual({
      code: 'data-image-preserved',
      count: 1,
      samples: ['image/png'],
    });
    expect(findStage(stages, 'data-image-blocked')).toEqual({
      code: 'data-image-blocked',
      count: 1,
      samples: ['application/x-shockwave-flash'],
    });
    expect(findStage(stages, 'nested-svg-resanitized')).toEqual({
      code: 'nested-svg-resanitized',
      count: 1,
      samples: ['image/svg+xml'],
    });
  });
});
