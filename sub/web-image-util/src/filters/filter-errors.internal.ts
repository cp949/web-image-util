/**
 * 필터 시스템의 내부 Error 생성 helper다.
 */

/** 미등록 필터 적용 에러를 생성한다. */
export function createFilterNotFoundError(filterName: string): Error {
  return new Error(`Filter '${filterName}' not found.`);
}

/** 필터 파라미터 검증 실패 에러를 생성한다. */
export function createInvalidFilterParamsError(errors: string[] | undefined): Error {
  return new Error(`Filter parameters are invalid: ${errors?.join(', ')}`);
}

/** 처리되지 않은 블렌드 모드 에러를 생성한다. */
export function createUnsupportedBlendModeError(blendMode: string): Error {
  return new Error(`Blend mode '${blendMode}' is not supported.`);
}
