/**
 * 타입 레벨 export 계약 테스트
 *
 * @description
 * vitest가 실행하는 테스트가 아니라 tsc(타입체크)만으로 검증하는 파일이다.
 * 공개 타입이 지정된 엔트리에서 import 가능한지 확인하고, 제거한 타입이 이전
 * 엔트리에서 다시 노출되지 않는지 검증한다.
 */

import type {
  ComposeCollageSpec,
  ComposeGridSpec,
  ComposeLayer,
  ComposeLayersSpec,
  ComposeSpec,
  RandomSource,
} from '@cp949/web-image-util/advanced';
import type {
  InspectSvgSanitizationFailure,
  InspectSvgSanitizationFailureCode,
  InspectSvgSanitizationImpact,
  InspectSvgSanitizationLightweightImpact,
  InspectSvgSanitizationOptions,
  InspectSvgSanitizationReport,
  InspectSvgSanitizationSkipImpact,
  InspectSvgSanitizationStage,
  InspectSvgSanitizationStageCode,
  InspectSvgSanitizationStrictImpact,
  SvgSanitizerPolicy,
} from '@cp949/web-image-util/svg-sanitizer';
import type {
  InspectSvgDimensions,
  InspectSvgFinding,
  InspectSvgFindingCode,
  InspectSvgReport,
  InspectSvgSourceFetchInfo,
  InspectSvgSourceFetchMode,
  InspectSvgSourceFinding,
  InspectSvgSourceFindingCode,
  InspectSvgSourceInput,
  InspectSvgSourceKind,
  InspectSvgSourceMeta,
  InspectSvgSourceOptions,
  InspectSvgSourceReport,
  SvgIdPrefixDeoptReason,
  SvgIdPrefixReport,
  SvgIdPrefixResult,
  SvgIdPrefixWarning,
  SvgIdPrefixWarningCode,
} from '@cp949/web-image-util/utils';
import type {
  BoxOptions,
  ImageErrorCodeType,
  ImageErrorDetails,
  ImageProcessErrorOptions,
  ResizeConfig,
  ResizeFocalPoint,
  ResizeGravity,
  ScaleConfig,
  ScaleValue,
  TransformOptions,
} from '../../src';
import type { HighResolutionPriority, ProcessingStrategy } from '../../src/advanced-index';
import type {
  ImageErrorCodeType as ImageErrorCodeTypeFromTypes,
  ImageErrorDetails as ImageErrorDetailsFromTypes,
  ImageProcessErrorOptions as ImageProcessErrorOptionsFromTypes,
  ResizeConfig as ResizeConfigFromTypes,
  ScaleConfig as ScaleConfigFromTypes,
  ScaleValue as ScaleValueFromTypes,
  TransformOptions as TransformOptionsFromTypes,
} from '../../src/types';
import type { InitialProcessor } from '../../src/types/typed-processor.internal';

// @ts-expect-error ImageFormat은 루트 엔트리만 소유하며 /advanced에서는 노출하지 않는다.
type ImageFormatFromAdvanced = import('@cp949/web-image-util/advanced').ImageFormat;

const code: ImageErrorCodeType = 'INVALID_SOURCE';
void (null as unknown as ImageFormatFromAdvanced);
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

const scaleValue: ScaleValue = { sx: 2, sy: 0.5 };
const scaleValueFromTypes: ScaleValueFromTypes = scaleValue;
const scaleConfig: ScaleConfig = { fit: 'scale', scale: scaleValue };
const scaleConfigFromTypes: ScaleConfigFromTypes = scaleConfig;
const resizeConfig: ResizeConfig = scaleConfig;
const resizeConfigFromTypes: ResizeConfigFromTypes = resizeConfig;
const processingStrategy: ProcessingStrategy = 'tiled';
const highResPriority: HighResolutionPriority = 'quality';
void highResPriority;
void scaleValueFromTypes;
void scaleConfigFromTypes;
void resizeConfigFromTypes;
void processingStrategy;

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

const sanitizationPolicy: SvgSanitizerPolicy = 'lightweight';
const sanitizationStageCode: InspectSvgSanitizationStageCode = 'script-removed';
const sanitizationStage: InspectSvgSanitizationStage = {
  code: sanitizationStageCode,
  count: 1,
  samples: ['script'],
};
const sanitizationFailureCode: InspectSvgSanitizationFailureCode = 'svg-bytes-exceeded';
const sanitizationFailure: InspectSvgSanitizationFailure = {
  code: sanitizationFailureCode,
  message: 'SVG input size exceeds the configured byte limit.',
  details: { actualBytes: 11, maxBytes: 10 },
};
const sanitizationLightweightImpact: InspectSvgSanitizationLightweightImpact = {
  kind: 'lightweight',
  status: 'ok',
  outputBytes: 0,
  stages: [sanitizationStage],
  failure: null,
};
const sanitizationStrictImpact: InspectSvgSanitizationStrictImpact = {
  kind: 'strict',
  status: 'failed',
  outputBytes: null,
  outputNodeCount: null,
  stages: [],
  failure: sanitizationFailure,
};
const sanitizationSkipImpact: InspectSvgSanitizationSkipImpact = {
  kind: 'skip',
  status: 'not-applied',
  potentialStages: [sanitizationStage],
};
const sanitizationImpact: InspectSvgSanitizationImpact = sanitizationLightweightImpact;
const sanitizationOptions: InspectSvgSanitizationOptions = { policy: sanitizationPolicy };
const sanitizationReport: InspectSvgSanitizationReport = {
  bytes: 0,
  byteLimit: 0,
  environment: 'unknown',
  policy: sanitizationPolicy,
  impact: sanitizationImpact,
};
void sanitizationStrictImpact;
void sanitizationSkipImpact;
void sanitizationOptions;
void sanitizationReport;

const prefixWarningCode: SvgIdPrefixWarningCode = 'id-rewrite-skipped-idempotent';
const prefixWarning: SvgIdPrefixWarning = { code: prefixWarningCode, count: 1 };
const prefixDeoptReason: SvgIdPrefixDeoptReason = 'style-tag-present';
const prefixReport: SvgIdPrefixReport = {
  deoptimized: false,
  deoptReasons: [],
  bytes: 0,
  byteLimit: 0,
  environment: 'unknown',
  prefixedIdCount: 0,
  rewrittenReferenceCount: 0,
  warnings: [prefixWarning],
};
const prefixResult: SvgIdPrefixResult = { svg: '<svg/>', report: prefixReport };
void prefixDeoptReason;
void prefixResult;

const srcInput: InspectSvgSourceInput = '<svg/>';
const srcFetchMode: InspectSvgSourceFetchMode = 'never';
const srcKind: InspectSvgSourceKind = 'svg';
const srcFindingCode: InspectSvgSourceFindingCode = 'mime-mismatch';
const srcFinding: InspectSvgSourceFinding = { code: srcFindingCode, message: '' };
const srcMeta: InspectSvgSourceMeta = {
  originalKind: 'string',
  mime: null,
  extension: null,
  url: null,
  bytes: 0,
  consumed: false,
};
const srcFetchInfo: InspectSvgSourceFetchInfo = {
  mode: srcFetchMode,
  performed: false,
  status: null,
};
const srcOptions: InspectSvgSourceOptions = { fetch: 'never', byteLimit: 1024 };
const srcReport: InspectSvgSourceReport = {
  kind: srcKind,
  source: srcMeta,
  fetch: srcFetchInfo,
  svg: null,
  findings: [srcFinding],
  environment: 'unknown',
};
void srcInput;
void srcOptions;
void srcReport;

const composeRandom: RandomSource = () => 0.5;
const composeLayer: ComposeLayer = { image: {} as HTMLImageElement, x: 0, y: 0, opacity: 0.5 };
const composeLayersSpec: ComposeLayersSpec = { type: 'layers', width: 10, height: 10, layers: [composeLayer] };
const composeGridSpec: ComposeGridSpec = { type: 'grid', images: [], columns: 2, fit: 'cover' };
const composeCollageSpec: ComposeCollageSpec = {
  type: 'collage',
  images: [],
  width: 10,
  height: 10,
  scaleRange: [0.1, 0.2],
  random: composeRandom,
};
const composeSpec: ComposeSpec = composeLayersSpec;
void composeGridSpec;
void composeCollageSpec;
void composeSpec;

// transform(): 루트와 /types가 같은 타입을 노출하고, resize() 앞에서만 호출된다.
// transform()의 "resize() 앞에서만" 규칙은 런타임 가드다(resize()의 1회 제약과 같은 수준 —
// this 제약은 ShortcutBuilder의 재귀적 제네릭 때문에 컴파일 타임에 강제되지 않는다).
// 런타임 검증은 tests/unit/processor/processor-transform/transform-chain-jsdom.test.ts가 담당한다.
const transformOptions: TransformOptions = {
  crop: { x: 10, y: 20, width: 640, height: 480 },
  flip: { horizontal: true },
  rotate: { degrees: 90, expand: true },
};
const transformOptionsFromTypes: TransformOptionsFromTypes = transformOptions;
const transformShorthand: TransformOptions = { rotate: 90 };
void transformOptionsFromTypes;
void transformShorthand;

declare const initialProcessor: InitialProcessor;
void initialProcessor.transform(transformOptions).resize({ fit: 'cover', width: 1, height: 1 });
void initialProcessor.transform(transformOptions).blur(1).toBlob();

// box(): resize 앞뒤 어디서나 호출 가능하고(체인 위치 무관), 상태를 바꾸지 않는다.
const boxOptions: BoxOptions = {
  padding: 4,
  background: '#ffffff',
  radius: '50%',
  border: { width: 2, color: '#333333', inset: true },
};
void initialProcessor.box(boxOptions).resize({ fit: 'cover', width: 1, height: 1 });
void initialProcessor.resize({ fit: 'cover', width: 1, height: 1 }).box(boxOptions);
void initialProcessor.box(boxOptions).blur(1).toBlob();

// position: gravity 문자열은 cover/contain 둘 다, focal-point 객체는 cover 전용이다.
const coverWithGravity: ResizeConfig = { fit: 'cover', width: 100, height: 100, position: 'top-left' };
const coverWithFocalPoint: ResizeConfig = {
  fit: 'cover',
  width: 100,
  height: 100,
  position: { x: 0.3, y: 0.7 } satisfies ResizeFocalPoint,
};
const containWithGravity: ResizeConfig = { fit: 'contain', width: 100, height: 100, position: 'bottom-right' };
const gravityValue: ResizeGravity = 'center';
void coverWithGravity;
void coverWithFocalPoint;
void containWithGravity;
void gravityValue;

// contain은 focal-point 객체를 받지 않는다 — 타입 레벨에서부터 막힌다.
const containRejectsFocalPoint: ResizeConfig = {
  fit: 'contain',
  width: 100,
  height: 100,
  // @ts-expect-error contain의 position은 ResizeGravity만 허용한다. focal-point 객체는 cover 전용이다.
  position: { x: 0.5, y: 0.5 },
};
void containRejectsFocalPoint;

// ResizePosition: 미사용·미문서화 죽은 export였다. Track 1B에서 제거했고 다시 노출되면 안 된다.
// @ts-expect-error ResizePosition은 제거된 타입이다. 재도입되면 이 줄이 컴파일 에러 없이 통과해 실패로 드러난다.
type RemovedResizePosition = import('../../src').ResizePosition;
void (null as unknown as RemovedResizePosition);
