# 프로세서 인터페이스 출력 표면 정합 설계

## 배경

체이닝 표면을 선언하는 인터페이스가 두 벌 존재한다.

- `src/types/typed-processor.internal.ts:30` `TypedImageProcessor<TState>` — `processImage()`(`src/processor.ts:396`)의 선언된 반환 타입. 출력 메서드 8개(`toBlob`/`toDataURL`/`toFile`/`toCanvas`/`toCanvasDetailed`/`toElement`/`toArrayBuffer`/`toUint8Array`) 전부를 선언한다.
- `src/types/processor-interface.ts:25` `IImageProcessor<TState>` — `ShortcutBuilder`(`src/shortcut/shortcut-builder.ts:42`)가 순환 참조 없이 프로세서를 참조하기 위한 seam. 출력 메서드 4개(`toBlob`/`toDataURL`/`toFile`/`toCanvas`)만 선언한다.

`ImageProcessor` 클래스(`src/processor.ts:53`)는 `implements TypedImageProcessor<TState>, IImageProcessor<TState>`로 두 인터페이스를 동시에 구현하며, 실제로는 8개 메서드 전부를 갖는다.

### 확인된 버그: `.shortcut` 체인의 반환 타입이 4개로 좁아진다

`ShortcutBuilder`의 모든 메서드(`coverBox`/`containBox`/`scale`/... 13개, `shortcut-builder.ts:74-461`)는 `IImageProcessor<AfterResize>`를 반환한다. 런타임 인스턴스는 항상 `ImageProcessor`(8개 메서드 보유)지만, 정적 타입은 `IImageProcessor`라서 4개만 보인다.

```ts
processImage(src).shortcut.coverBox(300, 200).toArrayBuffer();
// 런타임: 정상 동작 (ImageProcessor.toArrayBuffer가 실제로 존재)
// 컴파일: Property 'toArrayBuffer' does not exist on type 'IImageProcessor<AfterResize>'
```

`tests/shortcut/shortcut-types.test.ts:28-36`의 `'should have all output methods'`는 `toBlob`/`toDataURL`/`toCanvas`/`toFile` 4개만 검증한다. `toCanvasDetailed`/`toElement`/`toArrayBuffer`/`toUint8Array`는 `.shortcut` 체인 경로에서 검증된 적이 없다.

### 근본 원인 (git 이력)

`4c5c395 fix: processor 출력 타입 표면 보강`이 `TypedImageProcessor`에만 4개 메서드(`toCanvasDetailed`/`toElement`/`toArrayBuffer`/`toUint8Array`)를 추가했다. 같은 시점에 `IImageProcessor`는 손대지 않았다 — 이번 버그의 직접 origin이다.

`8be9a78 refactor: processor-interface 미러링 축소`는 이 저장소의 확립된 패턴을 보여준다: 미러 인터페이스(`IShortcutBuilder`, 16메서드)를 통째로 지우고 클래스가 공개 타입 표면을 겸하게 했다. `IImageProcessor`/`TypedImageProcessor`도 같은 드리프트 위험을 안고 있지만, 이번 설계는 그 통합(아래 비범위 참고)까지는 하지 않는다.

### 미사용 타입 6개 (grep 검증, `src/` + `tests/` 전체)

| 타입 | 파일 | 참조 |
| --- | --- | --- |
| `CanResize` | `processor-state.internal.ts:39` | 자기 파일의 `EnsureCanResize` 정의 안에서만 (39, 59행) |
| `EnsureCanResize` | `processor-state.internal.ts:58` | 정의 외 참조 0 |
| `ResizeAlreadyCalledError` | `processor-state.internal.ts:49` | `EnsureCanResize` 정의 안에서만 |
| `ProcessorStateType` | `processor-state.internal.ts:34` | 정의 외 참조 0 |
| `GetProcessorState` | `typed-processor.internal.ts:128` | 정의 외 참조 0 |
| `CanCallResize` | `typed-processor.internal.ts:133` | 정의 외 참조 0 |

`ProcessorFactory`(`typed-processor.internal.ts:123`)는 죽은 타입이 아니다 — `tests/unit/processor/typed-processor-jsdom.test.ts:18,80`의 `'ProcessorFactory는 ImageSource만 입력으로 허용한다'` 테스트가 import해서 쓴다. 삭제 대상에서 제외한다.

`ResizedProcessor`(`typed-processor.internal.ts:118`)는 타입으로서는 참조 0건이지만, 같은 테스트 파일 35행의 `it()` 설명 문자열("should convert to ResizedProcessor type...")에만 이름이 등장한다 — 실제 타입 참조가 아니라 텍스트다. 대칭 짝인 `InitialProcessor`가 `processImage()` 반환 타입으로 실사용 중이라는 점을 고려해 이번 정리에서는 남긴다(비범위 참고).

## 결정

**Option A**: `IImageProcessor`에 누락된 출력 메서드 4개를 추가해 `TypedImageProcessor`와 표면을 맞추고, 확인된 미사용 타입 6개를 삭제한다. `TypedImageProcessor` 자체는 유지한다.

**하지 않는 것 (Option B)**: `IImageProcessor`/`TypedImageProcessor`를 완전히 통합해 인터페이스 하나로 줄이는 8be9a78 스타일의 확장. `processImage()` 반환 타입 교체와 `ImageProcessor implements` 절 변경까지 번지는 더 큰 diff이고, 이번 카드가 파일:라인 단위로 지정한 범위를 넘는다. 같은 드리프트가 재발할 여지는 남지만, 그 위험은 재검토 조건으로 남긴다.

## 모듈 계약

### `processor-interface.ts` — `IImageProcessor`에 4개 메서드 추가

`toCanvas()` 뒤에, `TypedImageProcessor`와 동일한 시그니처로 추가한다. JSDoc 문구는 `TypedImageProcessor`("Return result as X")가 아니라 `ImageProcessor` 구현부의 요약문("Create/Convert X directly")을 따른다.

```ts
  /**
   * Canvas result with metadata
   */
  toCanvasDetailed(): Promise<ResultCanvas>;

  /**
   * Create HTMLImageElement directly
   */
  toElement(): Promise<HTMLImageElement>;

  /**
   * Convert to ArrayBuffer directly
   */
  toArrayBuffer(): Promise<ArrayBuffer>;

  /**
   * Convert to Uint8Array directly
   */
  toUint8Array(): Promise<Uint8Array>;
```

새 import는 필요 없다 — `HTMLImageElement`/`ArrayBuffer`/`Uint8Array`는 전역 타입이고 `ResultCanvas`는 이미 import되어 있다.

### 타입 삭제

`processor-state.internal.ts`에서 `ProcessorStateType`/`CanResize`/`ResizeAlreadyCalledError`/`EnsureCanResize` 4개, `typed-processor.internal.ts`에서 `GetProcessorState`/`CanCallResize` 2개를 삭제한다. 둘 다 export 삭제만으로 끝난다 — `ProcessorFactory`가 `ImageSource`를 계속 쓰므로 import 정리는 필요 없다.

`types/index.ts:93`의 내부 타입 주석에서 삭제된 `EnsureCanResize`/`CanResize` 언급을 지운다. `AfterResizeCall`은 유지(실사용, `processor.ts:24,95,99`).

## 테스트 계약

- `tests/shortcut/shortcut-types.test.ts`의 `'should have all output methods'`(28-36행)에 `toCanvasDetailed`/`toElement`/`toArrayBuffer`/`toUint8Array` 4개 assertion을 추가한다. 수정 전에는 `pnpm typecheck`가 이 4줄에서 실패한다(vitest 자체는 esbuild가 타입을 지우고 실행하므로 실패하지 않는다 — 이 카드의 회귀는 `tsc`로만 잡힌다).

### 카드가 제안한 세 번째 이득은 성립하지 않는다 — `@ts-expect-error`로 resize 1회를 "고정"할 수 없다

카드 07의 solution 블록은 "`@ts-expect-error` 타입 테스트로 resize 1회 고정"을 이득으로 들었다. 직접 확인하니 전제가 틀렸다.

```ts
processImage(src)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .resize({ fit: 'contain', width: 300, height: 300 });
```

`pnpm typecheck`에서 이 코드는 **에러 없이 통과한다** (`tsc --noEmit`, exit 0 확인). `ResizedProcessor`(`TypedImageProcessor<AfterResize>`)를 `InitialProcessor`(`TypedImageProcessor<BeforeResize>`) 타입 변수에 직접 대입해도 통과한다 — 두 인스턴스화가 구조적으로 서로 대입 가능하다.

원인: `resize(this: TypedImageProcessor<BeforeResize>, ...)`의 `this` 제약은 `TState`에 의존하지 않고 항상 고정된 `BeforeResize`를 요구하므로, 호출 시점엔 "리시버 타입이 `TypedImageProcessor<BeforeResize>`에 대입 가능한가"만 검사된다. `__resizeState: 'before' | 'after'` 브랜드는 `shortcut`/`blur`/`resize`가 전부 `TState`를 다시 제네릭으로 감싸 반환하는 자기 참조 구조 뒤에 숨어 있어, 이 대입 가능성 검사에서 실제로 표면화되지 않는다. `IImageProcessor.resize()`도 동일한 `this` 패턴이라 같은 문제를 그대로 안고 있다.

즉 resize 1회 제약은 **순수하게 런타임**(`LazyRenderPipeline`이 두 번째 호출에서 `ImageProcessError`를 던짐, `tests/unit/processor/typed-processor-jsdom.test.ts:189-198`)으로만 지켜진다. `processor.ts`의 JSDoc(43-46행, 85-88행)이 예시로 든 "❌ Compilation error: duplicate resize() calls" 주석은 검증된 적 없는 아스퍼레이션이다.

이 갭은 이번 카드("타입 의례를 줄인다")와 다른 문제다 — 표면이 장황한 게 아니라 브랜드 타입 자체가 실제로는 아무것도 막지 못한다는, 더 근본적인 타입 안전성 결함이다. 고치려면 `TState`가 재귀적 래핑 없이 실제로 비교 가능한 형태로 노출되도록 상태 판별 방식을 바꿔야 하는데(예: 브랜드를 각 메서드 반환 타입이 아니라 별도 판별 프로퍼티로 승격), 이는 별도 설계가 필요한 규모라 이번 계획에서 다루지 않는다. "resize 1회 고정" 관련 테스트 태스크는 계획에서 제외한다.

## 문서 계약

없음. 새 도메인 개념을 도입하지 않는다 — 기존 seam의 타입 선언을 실제 구현과 맞추는 정정이다. `docs/architecture.md`/`CONTEXT.md`에 새 항목을 추가하지 않는다.

## 비범위

- `IImageProcessor`/`TypedImageProcessor` 완전 통합(Option B).
- `ResizedProcessor` 삭제.
- `ImageProcessor` 클래스 구현·JSDoc 변경 — 카드 원문의 "주의": 도달하지 않는 타입 표면만 줄인다.
- 두 인터페이스가 다시 갈라지는 걸 막는 구조적 동치 가드(예: `IImageProcessor<T> extends TypedImageProcessor<T> ? ... : never` 컴파일 타임 assert). 이번 카드 범위 밖이라 추가하지 않는다 — 재검토 조건 참고.
- `IImageProcessor`/`InitialProcessorInterface`/`ResizedProcessorInterface`를 루트 배럴(`src/index.ts`)에 새로 export하는 것. 현재도 export되지 않으며 이번 변경도 export를 추가하지 않는다.
- **resize 1회 제약의 컴파일 타임 미보호.** 위에서 확인했듯 `TypedImageProcessor`/`IImageProcessor`의 `this: X<BeforeResize>` 브랜드 제약은 실제로 아무 타입 에러도 내지 않는다. 이 카드의 "타입 표면을 실제 구현과 맞춘다"는 목적과는 다른, 별도의 타입 안전성 결함이라 이번 계획에서 고치지 않는다.

## 재검토 조건

- `ImageProcessor`에 출력 메서드가 또 추가되면 `IImageProcessor`와 `TypedImageProcessor` 양쪽에 반영해야 한다 — 하나만 고치면 이번과 같은 버그가 재발한다. 두 번째 재발이 생기면 Option B(완전 통합) 또는 구조적 동치 가드를 재고한다.
- `ResizedProcessor`를 정말 쓰지 않는 채로 한 사이클 더 지나면 별도로 삭제를 검토한다.
- resize 1회 제약을 실제로 컴파일 타임에 강제할 필요가 커지면(현재는 런타임 `ImageProcessError`만으로 보호됨) 브랜드 판별 방식 자체를 다시 설계하는 별도 카드를 연다.
