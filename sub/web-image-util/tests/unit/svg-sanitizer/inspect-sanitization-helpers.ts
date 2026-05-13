import type {
  InspectSvgSanitizationStage,
  InspectSvgSanitizationStageCode,
} from '../../../src/svg-sanitizer/inspect-sanitization';

export const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

/** 문자열의 UTF-8 byte 길이를 계산한다. */
export function encodedByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** stages 배열에서 특정 code의 stage를 찾는다. 없으면 undefined. */
export function findStage(
  stages: InspectSvgSanitizationStage[],
  code: InspectSvgSanitizationStageCode
): InspectSvgSanitizationStage | undefined {
  return stages.find((stage) => stage.code === code);
}
