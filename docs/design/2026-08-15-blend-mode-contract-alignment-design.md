# BlendMode 계약을 구현과 맞추는 설계

## 배경

`BlendMode`(`src/filters/filter-blend-mode.internal.ts:4-17`)는 CSS Compositing 표준의 12개 블렌드 모드를 공개 enum으로 약속한다.

```ts
export enum BlendMode {
  NORMAL = 'normal',
  MULTIPLY = 'multiply',
  SCREEN = 'screen',
  OVERLAY = 'overlay',
  SOFT_LIGHT = 'soft-light',
  HARD_LIGHT = 'hard-light',
  COLOR_DODGE = 'color-dodge',
  COLOR_BURN = 'color-burn',
  DARKEN = 'darken',
  LIGHTEN = 'lighten',
  DIFFERENCE = 'difference',
  EXCLUSION = 'exclusion',
}
```

이 enum은 `plugin-system.ts`가 `export { BlendMode }`로 재노출하고, `advanced-index.ts`가 `export type { BlendMode, ... }`로 다시 공개 배럴에 얹는다 — 소비자가 12개 값 모두를 쓸 수 있다고 믿을 근거다.

실제 구현 `applyBlendMode()`(`src/filters/filter-blending.internal.ts:8-44`)의 `switch`는 `MULTIPLY`/`SCREEN`/`OVERLAY` 3종만 case를 갖는다. 나머지 9종(`NORMAL` 포함)은 `switch`에 매치되는 case가 없어 루프 진입 전 초기화값 `[rResult, gResult, bResult] = [r2, g2, b2]`(필터 결과 그대로)가 그대로 살아남는다 — 즉 `NORMAL`과 픽셀 단위로 동일하다.

```ts
let [rResult, gResult, bResult] = [r2, g2, b2];
switch (blendMode) {
  case BlendMode.MULTIPLY: /* ... */ break;
  case BlendMode.SCREEN: /* ... */ break;
  case BlendMode.OVERLAY: /* ... */ break;
}
// DARKEN/LIGHTEN/COLOR_DODGE/COLOR_BURN/HARD_LIGHT/SOFT_LIGHT/DIFFERENCE/EXCLUSION →
// 위 세 case 중 어디에도 안 걸려 rResult/gResult/bResult가 r2/g2/b2 그대로.
```

`blend: BlendMode.DIFFERENCE`를 넘겨도 타입체크는 통과하고(`BlendMode`의 유효한 멤버라서), 테스트도 실패하지 않는다(`tests/unit/filters/filter-blending.test.ts`·`plugin-system-application.test.ts` 모두 MULTIPLY/SCREEN/OVERLAY 3종만 검증 — 나머지 9종은 assertion이 아예 없다). 조용한 no-op이다.

호출부 `plugin-system.ts:168-170`은 `blend`가 있고 `NORMAL`이 아니면 무조건 `applyBlendMode()`를 호출한다 — 미구현 9종을 걸러내는 별도 검증이 없다.

```ts
if (filterOptions.blend && filterOptions.blend !== BlendMode.NORMAL) {
  result = applyBlendMode(imageData, result, filterOptions.blend);
}
```

**대안 조사:** 두 방향을 검토했다.

1. CSS Compositing 표준 공식으로 나머지 8종(`DARKEN`/`LIGHTEN`/`COLOR_DODGE`/`COLOR_BURN`/`HARD_LIGHT`/`SOFT_LIGHT`/`DIFFERENCE`/`EXCLUSION`)을 구현한다.
2. enum을 실제 구현된 3종(`NORMAL`/`MULTIPLY`/`SCREEN`/`OVERLAY` — 정확히는 4종)으로 좁히고, `validateFilterChain()`이 나머지를 명시적으로 거부하게 한다.

## 결정

**1안(전량 구현)을 채택한다.** 근거:

- 8종 모두 순수 픽셀 함수다 — `original: ImageData`, `filtered: ImageData`를 받아 새 `ImageData`를 반환하는 이미 존재하는 시그니처 안에서 끝난다. 카드 7(`ResizePerformanceOptions` 유령 필드)이 구현 대신 삭제를 택한 이유였던 "전역 싱글톤 충돌"·"per-인스턴스 정책을 흘려보낼 배선이 없음" 같은 제약이 여기엔 없다.
- 8종 모두 [CSS Compositing and Blending Level 1](https://www.w3.org/TR/compositing-1/#blendingnormal) 표준 공식이 고정돼 있다 — 자체 설계가 필요 없고, 기존 3종(`MULTIPLY`/`SCREEN`/`OVERLAY`)도 이미 같은 표준을 따르고 있어 일관된 확장이다.
- enum을 좁히는 2안은 이미 공개 배럴(`advanced-index.ts`)이 재노출 중인 표면을 축소하는 **breaking change**이자 기능 삭제 방향이다. 반면 1안은 breaking change 없이 이미 약속된 기능을 채운다.
- deletion test 관점: 신규 8개 case는 기존 3개 case와 구조적으로 동일한 "표준 공식 하나씩 매핑"이다. 새 추상화나 새 seam이 아니라 기존 패턴의 순수 확장이다.

**추가 결정 — exhaustive guard.** `switch`에 `BlendMode.NORMAL` 명시 case와 `default` 가드를 추가한다. `default`는 `src/core/source-converter/loaders/string.internal.ts:152`가 이미 쓰는 관례(`const unhandled: never = value`)를 재사용해, 향후 `BlendMode`에 값이 추가되면 컴파일 타임에 드러나게 한다. 런타임에 도달하면(타입을 우회한 호출) `createUnsupportedBlendModeError()`로 예외를 던진다 — 카드 4가 지적한 "타입체크도 테스트도 못 잡는 트랩"이 앞으로 재발하지 않게 하는 조치다.

`NORMAL` case는 로직 추가가 없다(초기값 `r2/g2/b2`가 이미 정답). 하지만 case를 명시하지 않으면 `default`의 `never` 단언이 `blendMode: BlendMode.NORMAL`을 좁히지 못해 컴파일이 깨진다 — 명시가 필수다.

**deletion test:** 8개 case를 지우면 `pnpm typecheck`가 `default` 분기에서 `Type 'BlendMode.DARKEN' is not assignable to type 'never'` 류 에러를 낸다 — exhaustive guard가 실제로 감시하고 있다는 실측 증거다.

## 변경 상세

**`src/filters/filter-errors.internal.ts`**

- `createUnsupportedBlendModeError(blendMode: string): Error` 추가. 기존 두 factory(`createFilterNotFoundError`, `createInvalidFilterParamsError`)와 같은 스타일 — plain `Error`, 메시지에 값 인용.

**`src/filters/filter-blending.internal.ts`**

- module-private 헬퍼 4개 추가: `colorDodge(cb, cs)`, `colorBurn(cb, cs)`, `softLightD(x)`, `softLight(cb, cs)`. 세 채널(R/G/B)에 같은 공식을 반복 적용할 때 분기 로직을 한 곳에 두기 위함 — `MULTIPLY`/`SCREEN`/`OVERLAY`처럼 분기 없는 공식은 기존 스타일대로 채널마다 인라인 전개한다.
- `applyBlendMode()`의 `switch`에 `NORMAL`(명시 no-op) + 8개 case + exhaustive `default`를 추가한다. 기존 `MULTIPLY`/`SCREEN`/`OVERLAY` case는 변경하지 않는다.
- `import { createUnsupportedBlendModeError } from './filter-errors.internal';` 추가.

각 공식(Cb=`original`, Cs=`filtered`, CSS Compositing 표준):

| BlendMode | 공식 |
| --- | --- |
| `DARKEN` | `min(Cb, Cs)` |
| `LIGHTEN` | `max(Cb, Cs)` |
| `COLOR_DODGE` | `Cb=0→0`; `Cs=1→1`; 그 외 `min(1, Cb/(1-Cs))` |
| `COLOR_BURN` | `Cb=1→1`; `Cs=0→0`; 그 외 `1-min(1,(1-Cb)/Cs)` |
| `HARD_LIGHT` | `Cs<0.5 → 2·Cb·Cs`, 아니면 `1-2·(1-Cb)·(1-Cs)`(=`OVERLAY(Cs,Cb)`) |
| `SOFT_LIGHT` | `Cs≤0.5 → Cb-(1-2Cs)·Cb·(1-Cb)`, 아니면 `Cb+(2Cs-1)·(D(Cb)-Cb)`, `D(x)=x≤0.25 → ((16x-12)x+4)x`, 아니면 `√x` |
| `DIFFERENCE` | `\|Cb-Cs\|` |
| `EXCLUSION` | `Cb+Cs-2·Cb·Cs` |

`HARD_LIGHT`는 기존 `OVERLAY` 공식과 좌우(Cb/Cs)가 뒤바뀐 관계다 — `OVERLAY`는 `Cb`(원본) 기준으로 분기하고, `HARD_LIGHT`는 `Cs`(필터 결과) 기준으로 분기한다. 표준 정의(`HardLight(Cb,Cs) = Overlay(Cs,Cb)`) 그대로다.

## 테스트 계약

**`tests/unit/filters/filter-blending.test.ts`**

기존 스타일(포뮬러를 `Math.round(...)` 표현식으로 직접 써서 기대값을 유도 — 매직 넘버 없음)을 따른다. 추가 테스트 12개:

- `DARKEN`/`LIGHTEN`/`DIFFERENCE`: 분기 없는 공식 — `Math.min`/`Math.max`/`Math.abs`를 인라인으로 쓴다. 픽셀: `original=(200,100,50)`, `filtered=(100,180,210)`.
- `EXCLUSION`: 같은 픽셀 쌍, 인라인 산술식.
- `HARD_LIGHT`: 같은 픽셀 쌍 — `filtered`의 R채널(100/255≈0.39)이 `<0.5` 분기, G/B채널(180,210)이 `≥0.5` 분기를 타 두 분기를 한 테스트에서 커버한다.
- `SOFT_LIGHT`: 같은 픽셀 쌍 — R채널은 `Cs≤0.5` 분기, G/B채널은 `Cs>0.5` 분기를 타고, G채널의 `D(Cb)`는 `Cb=100/255≈0.39>0.25`(sqrt 분기), B채널은 `Cb=50/255≈0.20≤0.25`(다항식 분기)를 타 `D(x)`의 두 하위 분기까지 한 테스트에서 커버한다.
- `COLOR_DODGE` 일반 케이스: `original=(120,90,60)`, `filtered=(80,150,100)` — 세 채널 모두 경계값 아닌 일반 분기.
- `COLOR_DODGE` 경계 케이스: `original=(0,100,50)`, `filtered=(200,255,80)` — R채널 `Cb=0`, G채널 `Cs=1`(255) 두 조기 반환 분기를 커버. 기대값은 고정 배열 `[0, 255, 73, 255]`(B채널만 일반식).
- `COLOR_BURN` 일반 케이스: `original=(180,90,60)`, `filtered=(220,200,245)`.
- `COLOR_BURN` 경계 케이스: `original=(255,90,180)`, `filtered=(50,0,220)` — R채널 `Cb=1`(255), G채널 `Cs=0` 두 조기 반환 분기를 커버. 기대값 `[255, 0, 168, 255]`.
- `NORMAL` 명시 케이스: `applyBlendMode(original, filtered, BlendMode.NORMAL)`이 `filtered`를 그대로 반환한다 — `original=(10,20,30)`, `filtered=(40,50,60)` → `[40, 50, 60, 255]`.
- 미지원 값 예외: `applyBlendMode(original, filtered, 'not-a-real-mode' as BlendMode)`가 `"Blend mode 'not-a-real-mode' is not supported."`를 던진다.

**`tests/unit/filters/plugin-system-application.test.ts`**

`applyFilter({ blend })` 레벨 회귀 가드 — 카드 4가 지적한 "타입체크·테스트 둘 다 못 잡는 트랩"이 통합 레벨에서도 재발하지 않게 한다. 기존 `BlendMode.MULTIPLY`/`SCREEN`/`OVERLAY` 테스트(46-80행)와 같은 스타일로 8개 모드 각각의 `it()`을 추가한다(순회 루프가 아니라 개별 테스트 — 기존 파일이 이미 이 스타일이다).

`createDummyPlugin('adder')`는 R채널에만 `params.value`를 더한다(G/B는 원본 그대로 — 자기 자신과 블렌딩되어 무동작과 구분되지 않는다). 각 테스트는 R채널의 원본(Cb)·필터 결과(Cs)를 "무동작이면 결과가 `Cs`(필터 값)와 같아진다"는 함정을 피하도록 고른다:

- `DARKEN`은 `Cb<Cs`일 때만 `min(Cb,Cs)=Cb≠Cs`다 — 원본 100 + value 80 → 필터 180.
- `LIGHTEN`은 `Cb>Cs`일 때만 `max(Cb,Cs)=Cb≠Cs`다 — 원본 200 + value -80 → 필터 120.
  - (`DARKEN`/`LIGHTEN`은 구조상 항상 한쪽만 이 함정에 걸린다 — `Cs`가 크면 `LIGHTEN(Cb,Cs)=Cs`, 작으면 `DARKEN(Cb,Cs)=Cs`. 그래서 두 모드가 서로 다른 방향의 오프셋을 쓴다.)
- `COLOR_DODGE`: 원본 120 + value -40 → 필터 80(일반 분기, 경계값 아님).
- `COLOR_BURN`: 원본 180 + value 40 → 필터 220(일반 분기, 경계값 아님).
- `HARD_LIGHT`: 원본 200 + value -100 → 필터 100(`Cs<0.5` 분기).
- `SOFT_LIGHT`: 원본 200 + value -100 → 필터 100(`Cs≤0.5` 분기).
- `DIFFERENCE`: 원본 200 + value -60 → 필터 140(`Cb=2·Cs`가 되는 조합은 우연히 `\|Cb-Cs\|=Cs`가 되므로 피한다).
- `EXCLUSION`: 원본 200 + value -100 → 필터 100.

각 테스트는 기대값을 `Math.round(공식(Cb,Cs) * 255)`로 표현식으로 유도한다(매직 넘버 없음, 기존 MULTIPLY/SCREEN/OVERLAY 테스트와 같은 관례).

## 문서 계약

`CHANGELOG.md` `[Unreleased]` > `### 수정`에 Fixed 항목 1개 추가(마지막 항목, 129행 앞). Breaking이 아니다 — 기존 4종(`NORMAL`/`MULTIPLY`/`SCREEN`/`OVERLAY`) 동작은 그대로고, 나머지 8종은 이전에 `NORMAL`과 동일한 무동작이었던 것이 이제 실제로 블렌딩한다(사용자가 관찰 가능한 유일한 변화는 "그동안 아무 효과가 없던 옵션이 이제 효과를 낸다"). 예외로 바뀌는 경로(`BlendMode`에 없는 문자열을 타입 우회로 넘기는 경우)는 TypeScript 사용자에게는 애초에 도달 불가능하다.
