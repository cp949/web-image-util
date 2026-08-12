import { describe, expect, it } from 'vitest';
import { sanitizeSvgStrictDetailed } from '../../../src/svg-sanitizer';
import {
  collectEmbeddedImageStages,
  collectGeneralStages,
} from '../../../src/svg-sanitizer/inspect-sanitization/stage-collectors.internal';
import { sanitizeSvgForRendering } from '../../../src/utils/svg-sanitizer';
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

    const stages = collectGeneralStages(input, parseSvgDocument(svgBody));

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

  it('XXE 절단 공유 후 doctype/entity stage는 정책 구분 없이 수집된다', () => {
    const svgBody = '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>';
    const input = `<!DOCTYPE svg [<!ENTITY a "b">]>${svgBody}`;

    const stages = collectGeneralStages(input, parseSvgDocument(svgBody));

    expect(findStage(stages, 'script-removed')?.count).toBe(1);
    expect(findStage(stages, 'doctype-removed')?.count).toBe(1);
    expect(findStage(stages, 'entity-removed')?.count).toBe(1);
  });

  it('빈 href를 두 정책 모두 제거 대상으로 세고, 실제 sanitizer 제거와 거울 정합한다', () => {
    const svgBody = '<svg xmlns="http://www.w3.org/2000/svg"><image href=""/></svg>';

    // 진단: URI allowlist 통일 후 빈 href를 external-href-removed로 센다
    const stages = collectGeneralStages(svgBody, parseSvgDocument(svgBody));
    expect(findStage(stages, 'external-href-removed')).toEqual({
      code: 'external-href-removed',
      count: 1,
      samples: ['href'],
    });

    // 거울: 두 sanitizer 모두 빈 href 속성을 제거한다
    expect(sanitizeSvgStrictDetailed(svgBody).svg).not.toContain('href');
    expect(sanitizeSvgForRendering(svgBody)).not.toContain('href');
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
