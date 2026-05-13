/**
 * 공개 export 계약 테스트
 *
 * @description
 * 루트 엔트리(`@cp949/web-image-util`)와 서브패스(`/utils`, `/advanced`, `/presets`, `/filters`,
 * `/svg-sanitizer`)의
 * 명시적 value export 목록을 잠근다. 의도되지 않은 추가/제거를 즉시 감지하기 위해
 * 정확 일치(`exact match`) 방식으로 검증한다.
 *
 * 새 export를 추가하거나 제거할 때는 expected-public-exports.ts의 목록을 의도적으로 함께 수정해야 한다.
 */

import { describe, expect, test } from 'vitest';

import * as root from '../../src';
import * as advanced from '../../src/advanced-index';
import * as filters from '../../src/filters/plugins';
import * as presets from '../../src/presets';
import * as svgSanitizer from '../../src/svg-sanitizer';
import * as utils from '../../src/utils';
import {
  ADVANCED_VALUE_EXPORTS,
  FILTERS_VALUE_EXPORTS,
  PRESETS_VALUE_EXPORTS,
  ROOT_VALUE_EXPORTS,
  SVG_SANITIZER_VALUE_EXPORTS,
  UTILS_VALUE_EXPORTS,
} from './expected-public-exports';

/**
 * `import * as mod`로 얻은 모듈 네임스페이스에서 실제 value export 키만 추출한다.
 */
function valueExportKeys(mod: Record<string, unknown>): string[] {
  return Object.keys(mod)
    .filter((key) => key !== 'default')
    .sort();
}

describe('공개 export 계약', () => {
  test('루트(`@cp949/web-image-util`) value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(root)).toEqual(ROOT_VALUE_EXPORTS);
  });

  test('빌드된 루트 패키지 export는 신규 photo-editor 유틸을 노출한다', async () => {
    const builtRoot = await import('../../dist/index.js');

    expect(builtRoot.decodeSvgDataURL).toBeTypeOf('function');
    expect(builtRoot.estimateDataURLPayloadByteLength).toBeTypeOf('function');
    expect(builtRoot.fetchImageSourceBlob).toBeTypeOf('function');
  });

  test('`/utils` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(utils)).toEqual(UTILS_VALUE_EXPORTS);
  });

  test('빌드된 `/utils` 서브패스 export는 신규 photo-editor 유틸을 노출한다', async () => {
    const builtUtils = await import('../../dist/utils/index.js');

    expect(builtUtils.decodeSvgDataURL).toBeTypeOf('function');
    expect(builtUtils.estimateDataURLPayloadByteLength).toBeTypeOf('function');
    expect(builtUtils.fetchImageSourceBlob).toBeTypeOf('function');
  });

  test('빌드된 `/utils` 서브패스에서 prefixSvgIds를 import하고 실행할 수 있다', async () => {
    const builtUtils = await import('../../dist/utils/index.js');
    expect(builtUtils.prefixSvgIds).toBeTypeOf('function');
    const r = builtUtils.prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"/>', 'p');
    expect(r.report).toBeDefined();
  });

  test('빌드된 `/utils` 서브패스에서 inspectSvgSource를 import하고 실행할 수 있다', async () => {
    const builtUtils = await import('../../dist/utils/index.js');
    expect(builtUtils.inspectSvgSource).toBeTypeOf('function');
    const result = await builtUtils.inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(result.kind).toBe('svg');
  });

  test('`/presets` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(presets)).toEqual(PRESETS_VALUE_EXPORTS);
  });

  test('`/filters` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(filters)).toEqual(FILTERS_VALUE_EXPORTS);
  });

  test('`/svg-sanitizer` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(svgSanitizer)).toEqual(SVG_SANITIZER_VALUE_EXPORTS);
  });

  test('`/advanced` 서브패스 value export 목록이 고정되어 있다', () => {
    expect(valueExportKeys(advanced)).toEqual(ADVANCED_VALUE_EXPORTS);
  });
});
