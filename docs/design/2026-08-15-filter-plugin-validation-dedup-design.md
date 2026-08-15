# Filter plugin validate() 보일러플레이트 공유 검증 module 설계

## 배경

`_tmp/arch-review/03.html` 후보 4는 "12개 filter plugin 중 9개가 같은 패턴(숫자 타입체크 → 범위체크 → 경고 임계값)을 손으로 반복한다 — 24개소"라고 서술했다. 실제 코드(`src/filters/plugins/{blur,color,effect}-plugins.ts`)를 전수 대조한 결과는 다음과 같다.

파라미터가 있는 plugin은 12개(`GrayscaleFilterPlugin`/`InvertFilterPlugin`은 파라미터가 없어 `validate()`가 항상 `{ valid: true }`만 반환 — 대상 아님):

| Plugin | 필드 | 범위 | 경고 조건 | 메시지 형태 |
| --- | --- | --- | --- | --- |
| `BlurFilterPlugin` | `radius` | 0~20 | `radius > 10` | 표준 2단 |
| `SharpenFilterPlugin` | `amount` | 0~100 | `amount > 80` | 표준 2단 |
| `EmbossFilterPlugin` | `strength` | 0~3 | 없음 | 표준 2단 |
| `EdgeDetectionFilterPlugin` | `sensitivity` | 0~2 | 없음 | 표준 2단 |
| `BrightnessFilterPlugin` | `value` | -100~100 | `abs(value) > 50` | 표준 2단 |
| `ContrastFilterPlugin` | `value` | -100~100 | `abs(value) > 50` | 표준 2단 |
| `SaturationFilterPlugin` | `value` | -100~100 | `value > 50`(편측) | 표준 2단 |
| `SepiaFilterPlugin` | `intensity` | 0~100 | 없음 | 표준 2단 |
| `NoiseFilterPlugin` | `intensity` | 0~100 | `intensity > 50` | 표준 2단 |
| `PixelateFilterPlugin` | `pixelSize` | 1~(상한 없음) | `pixelSize > 50` | 상한 없음 변형 |
| `PosterizeFilterPlugin` | `levels` | 2~256 | 없음 | 표준 2단 |
| `VignetteFilterPlugin` | `intensity`/`size`/`blur` 3개 | 각 0~1 | 없음 | **결합 1단**(`X must be a number between 0 and 1`, 필드당 `\|\|` 한 줄) |

"표준 2단"은 리포트가 인용한 모양이다: `typeof !== 'number'` → `"{name} must be a number"`, 범위 밖 → `"{name} must be between {min} and {max}"`, 선택적으로 임계값 초과 → 경고. `PixelateFilterPlugin`은 상한이 없어 두 번째 메시지가 `"{name} must be {min} or greater"`로 갈린다. `VignetteFilterPlugin`은 타입 실패와 범위 실패를 하나의 조건(`||`)·하나의 메시지로 합친다 — 리포트가 "이미 스타일이 갈라졌다"고 지적한 지점이다.

**NaN 처리는 12곳 모두 동일한 부작용을 공유한다.** 각 `else if` 체인은 관계 연산자(`<`/`>`)만 쓰므로 `NaN`이 들어오면 모든 분기가 `false`가 되어 에러도 경고도 없이 `valid: true`를 반환한다 — 어떤 plugin도 이를 막지 않는다. 테스트 스위트 어디에도 `NaN` 입력 케이스가 없다. 이 설계는 이 부작용을 **그대로 보존**한다(아래 "결정" 참고) — 통합 리팩토링이 관측 가능한 동작을 바꾸지 않는다는 이 저장소의 관례(후보 1/2/3 완료 노트 참고)를 따른다.

`createFilterPlugin()`(`src/advanced-index.ts`)은 리포트가 "이름과 달리 아무 것도 안 함"(`{ ...config }` 그대로 반환)이라 지적한 별개 항목이다. 이 함수는 `expected-public-exports.ts`(contract 테스트)와 `create-filter-plugin.test.ts`(자체 동작 테스트)가 지키는 **공개 API**다. 삭제는 breaking change이고, 재구성(공유 검증 module을 감싸는 형태)은 이 plugin이 검증하지 않는 임의 `TParams`를 받는 범용 factory라는 존재 이유와 충돌한다 — 어떤 필드를 감싸 검증할지 알 방법이 없다. 이번 카드는 **`createFilterPlugin()`을 건드리지 않는다**(비범위, 아래 참고).

## 결정

**동작 변화 없음.** `src/filters/filter-param-validation.internal.ts`를 신설해 `validateNumberInRange(value, name, rule)` 하나로 12개 plugin의 `validate()`를 교체한다. 반환 `FilterValidationResult`의 `valid`/`errors`/`warnings` — 값과 트리거 조건 — 은 기존과 문자 그대로 동일하게 유지한다.

```ts
export interface NumberRangeRule {
  min: number;
  max?: number; // 생략 시 상한 없음 — "{name} must be {min} or greater" 메시지로 갈린다
  warnAbove?: number; // 편측 경고 임계값. warnAboveAbs와 동시 지정 금지
  warnAboveAbs?: number; // 절대값 기준 경고 임계값(Brightness/Contrast 전용)
  warnMessage?: string; // warnAbove/warnAboveAbs 중 하나가 있으면 필수
  combinedMessage?: boolean; // true면 타입/범위 실패를 "{name} must be a number between {min} and {max}" 하나로 합친다(Vignette 전용)
}

export function validateNumberInRange(value: number, name: string, rule: NumberRangeRule): FilterValidationResult;
```

`VignetteFilterPlugin`은 필드 3개를 각각 `validateNumberInRange(..., { combinedMessage: true })`로 호출하고 `errors`만 수동으로 `flatMap`해 합친다 — 기존처럼 경고는 없다.

## 변경 상세

**신규: `src/filters/filter-param-validation.internal.ts`**

```ts
/**
 * 필터 plugin validate()가 반복하던 "타입 확인 → 범위 확인 → 경고 임계값 확인" 3단계를
 * 단일 소유하는 helper다. 관계 연산자(<, >)만 쓰는 원본 구현을 그대로 옮겼으므로
 * NaN을 넣으면 모든 분기가 false가 되어 valid:true를 반환하는 기존 부작용도 동일하게 남는다.
 */

import type { FilterValidationResult } from './plugin-system';

/** {@link validateNumberInRange}에 전달하는 범위·경고 규칙이다. */
export interface NumberRangeRule {
  /** 허용 최솟값 (포함) */
  min: number;
  /** 허용 최댓값 (포함). 생략하면 상한을 검사하지 않는다. */
  max?: number;
  /** 이 값을 초과하면 경고한다. warnAboveAbs와 동시에 쓰지 않는다. */
  warnAbove?: number;
  /** 절대값이 이 값을 초과하면 경고한다. warnAbove와 동시에 쓰지 않는다. */
  warnAboveAbs?: number;
  /** warnAbove/warnAboveAbs 중 하나를 지정하면 함께 지정해야 하는 경고 메시지 */
  warnMessage?: string;
  /**
   * true면 "타입 아님"과 "범위 밖"을 하나의 메시지
   * ("{name} must be a number between {min} and {max}")로 합친다.
   * VignetteFilterPlugin처럼 필드 하나를 단일 `||` 조건으로 검사하던 스타일과
   * 메시지를 맞출 때 쓴다. max가 없으면 쓸 수 없다.
   */
  combinedMessage?: boolean;
}

/** max 유무에 따라 "between A and B" 또는 "A or greater" 메시지를 고른다. */
function rangeErrorMessage(name: string, rule: NumberRangeRule): string {
  if (rule.max !== undefined) {
    return `${name} must be between ${rule.min} and ${rule.max}`;
  }
  return `${name} must be ${rule.min} or greater`;
}

/**
 * 숫자 파라미터 하나를 검증한다 — 타입 확인 → 범위 확인 → 경고 임계값 확인 순.
 *
 * @param value 검증할 값
 * @param name 에러 메시지에 쓰이는 파라미터 이름
 * @param rule 범위·경고 규칙
 */
export function validateNumberInRange(value: number, name: string, rule: NumberRangeRule): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof value !== 'number') {
    errors.push(rule.combinedMessage ? `${name} must be a number between ${rule.min} and ${rule.max}` : `${name} must be a number`);
  } else if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
    errors.push(rule.combinedMessage ? `${name} must be a number between ${rule.min} and ${rule.max}` : rangeErrorMessage(name, rule));
  } else if (rule.warnAbove !== undefined && value > rule.warnAbove) {
    warnings.push(rule.warnMessage as string);
  } else if (rule.warnAboveAbs !== undefined && Math.abs(value) > rule.warnAboveAbs) {
    warnings.push(rule.warnMessage as string);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
```

**`src/filters/plugins/blur-plugins.ts`** — 4개 plugin의 `validate()`를 교체 (예: `BlurFilterPlugin`):

```ts
// 변경 전
validate(params: { radius: number }): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof params.radius !== 'number') {
    errors.push('radius must be a number');
  } else if (params.radius < 0 || params.radius > 20) {
    errors.push('radius must be between 0 and 20');
  } else if (params.radius > 10) {
    warnings.push('High blur values can significantly increase processing time');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
},

// 변경 후
validate(params: { radius: number }): FilterValidationResult {
  return validateNumberInRange(params.radius, 'radius', {
    min: 0,
    max: 20,
    warnAbove: 10,
    warnMessage: 'High blur values can significantly increase processing time',
  });
},
```

`SharpenFilterPlugin`/`EmbossFilterPlugin`/`EdgeDetectionFilterPlugin`도 같은 형태로 교체한다(구체 값은 실행 계획 참고).

**`src/filters/plugins/color-plugins.ts`** — `BrightnessFilterPlugin`/`ContrastFilterPlugin`은 `warnAboveAbs`, `SaturationFilterPlugin`은 `warnAbove`(편측)를 쓴다 — 셋의 경고 조건이 실제로 다르므로 이 구분을 지운 채 통합하면 동작이 바뀐다.

**`src/filters/plugins/effect-plugins.ts`** — `SepiaFilterPlugin`/`NoiseFilterPlugin`/`PixelateFilterPlugin`/`PosterizeFilterPlugin`은 표준 교체, `VignetteFilterPlugin`만 3필드 결합:

```ts
// 변경 후
validate(params: { intensity: number; size: number; blur: number }): FilterValidationResult {
  const errors = [
    validateNumberInRange(params.intensity, 'intensity', { min: 0, max: 1, combinedMessage: true }),
    validateNumberInRange(params.size, 'size', { min: 0, max: 1, combinedMessage: true }),
    validateNumberInRange(params.blur, 'blur', { min: 0, max: 1, combinedMessage: true }),
  ].flatMap((result) => result.errors ?? []);

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
},
```

`GrayscaleFilterPlugin`/`InvertFilterPlugin`은 무변경.

## 테스트 계약

**신규** — `tests/unit/filters/filter-param-validation.test.ts`: `validateNumberInRange()` 자체의 타입/범위/경고(편측·절대값)/상한 없음/`combinedMessage` 분기와 NaN 통과 부작용을 고정한다.

**무변경(회귀 검증)** — `tests/unit/filters/blur-plugins.test.ts`·`color-plugins.test.ts`·`effect-plugins.test.ts`는 `.valid`/`.warnings` 존재 여부만 검증하고 메시지 문자열은 검증하지 않는다. 12개 plugin 모두 트리거 조건과 결과가 기존과 동일하므로 수정 없이 그대로 통과해야 한다.

## 문서 계약

- `docs/architecture.md` — `src/filters/plugin-system.ts` 행 근처에 `src/filters/filter-param-validation.internal.ts` 행 추가: "숫자 파라미터 범위 검증 단일 소유 — blur/color/effect 12개 plugin의 validate()가 호출".
- `CHANGELOG.md` — **엔트리 없음.** `.internal.ts` 신규 모듈은 어떤 배럴에서도 재노출되지 않고, 12개 plugin의 `validate()` 반환값(값·트리거 조건)이 문자 그대로 동일하다.

## 비범위

- **`createFilterPlugin()` 재구성.** 리포트가 "이름과 달리 아무 것도 안 함"이라 지적했지만, 이 함수는 임의 `TParams`를 받는 범용 factory라 어떤 필드를 검증할지 알 수 없다 — 공유 검증 module을 감싸려면 새 선언적 스키마 파라미터를 추가하는 별도 설계가 필요하다. 삭제는 `expected-public-exports.ts`·`create-filter-plugin.test.ts`가 지키는 공개 API를 깨는 breaking change다. 둘 다 이 카드의 목적(내장 12개 plugin의 중복 제거)을 넘는다.
- **NaN을 막는 방향으로 검증을 "고치는" 것.** 관측 가능한 동작을 바꾸지 않는다는 원칙을 우선한다. NaN 방어가 필요해지면 별도 카드에서 12개 plugin 전체의 동작 변경으로 다룬다.
- **`VignetteFilterPlugin`의 메시지 형태를 표준 2단으로 바꾸는 것.** 반대로 표준 쪽을 결합형으로 바꾸는 것도 아니다 — 기존 두 메시지 형태를 각각 보존한다.

## 재검토 조건

- `createFilterPlugin()`을 실제로 쓰는 외부 소비자가 나타나 "검증도 좀 대신 해달라"는 요청이 들어오면, 이 module을 감싸는 선언적 옵션(예: `numberRanges: Record<string, NumberRangeRule>`)을 추가하는 별도 카드로 다룬다.
- NaN 입력이 실제 버그로 보고되면 12개 plugin 전체에 `Number.isFinite` 가드를 추가하는 별도 카드로 다룬다.
