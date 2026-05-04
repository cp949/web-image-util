/**
 * 타입 레벨 export 계약 테스트
 *
 * @description
 * vitest가 실행하는 테스트가 아니라 tsc(타입체크)만으로 검증하는 파일이다.
 * `ImageProcessErrorOptions`, `ImageErrorDetails`, `ImageErrorDetailsByCode`가
 * 루트 엔트리(`../../src`)와 타입 허브(`../../src/types`) 양쪽에서
 * 타입으로 import 가능한지 확인한다.
 */

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
