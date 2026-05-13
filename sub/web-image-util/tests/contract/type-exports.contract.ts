/**
 * 타입 레벨 export 계약 테스트
 *
 * @description
 * vitest가 실행하는 테스트가 아니라 tsc(타입체크)만으로 검증하는 파일이다.
 * `ImageProcessErrorOptions`, `ImageErrorDetails`, `ImageErrorDetailsByCode`가
 * 루트 엔트리(`../../src`)와 타입 허브(`../../src/types`) 양쪽에서
 * 타입으로 import 가능한지 확인한다.
 */

import type {
  InspectSvgDimensions,
  InspectSvgFinding,
  InspectSvgFindingCode,
  InspectSvgReport,
} from '@cp949/web-image-util/utils';
import type { ImageErrorCodeType, ImageErrorDetails, ImageProcessErrorOptions } from '../../src';
import type {
  ImageErrorCodeType as ImageErrorCodeTypeFromTypes,
  ImageErrorDetails as ImageErrorDetailsFromTypes,
  ImageProcessErrorOptions as ImageProcessErrorOptionsFromTypes,
} from '../../src/types';

const code: ImageErrorCodeType = 'INVALID_SOURCE';
const codeFromTypes: ImageErrorCodeTypeFromTypes = code;
const options: ImageProcessErrorOptions = {
  cause: new Error('root cause'),
  details: { reason: 'script-tag' },
};
const optionsFromTypes: ImageProcessErrorOptionsFromTypes = options;
const details: ImageErrorDetails = options.details ?? {};
const detailsFromTypes: ImageErrorDetailsFromTypes = details;
void codeFromTypes;
void optionsFromTypes;
void detailsFromTypes;

const inspectReport: InspectSvgReport = {
  valid: true,
  bytes: 0,
  byteLimit: 0,
  environment: 'unknown',
  parse: { ok: true, message: null, locationAvailable: false },
  root: 'svg',
  dimensions: null,
  complexity: null,
  findings: [],
  recommendation: { sanitizer: 'lightweight', reasons: [] },
};
const inspectFinding: InspectSvgFinding = { code: 'has-script-element', message: '' };
const inspectFindingCode: InspectSvgFindingCode = 'has-script-element';
const inspectDimensions: InspectSvgDimensions = {
  widthAttr: { raw: null, numeric: null, unit: null },
  heightAttr: { raw: null, numeric: null, unit: null },
  viewBox: { raw: null, parsed: null },
  effective: { width: 100, height: 100, source: 'fallback' },
};
void inspectReport;
void inspectFinding;
void inspectFindingCode;
void inspectDimensions;
