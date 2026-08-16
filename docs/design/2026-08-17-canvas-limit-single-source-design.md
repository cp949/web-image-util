# canvas 크기 상한, 세 번째 구현을 leaf로 정합

## 배경

`_tmp/arch-review/05.html` 카드 A3("고해상도 클러스터, primary API에서 도달 불가")를 조사하며 원래 서술("이미지 크기 무관")을 코드와 대조한 결과, primary path(`processImage()` → `OutputPipeline` → `single-renderer.internal.ts`)는 무점검이 아니라 이미 대형 canvas 경고를 갖고 있었다 — 2026-08-11 `OnehotRenderer` 승계 커밋(`5240a0a`) 유래, 이번 리뷰보다 앞선다. 다만 이 경고의 임계값(`16384 * 16384` 면적)과, 같은 종류의 검사를 하는 `composition/compose.ts`의 `MAX_CANVAS_DIMENSION = 16384`(per-side, throw)는 둘 다 하드코딩 리터럴이다.

`docs/design/2026-08-15-browser-capability-detector-facade-design.md` 계열로 `src/utils/browser-capabilities/canvas-limits.internal.ts`(A4, `712a031`)가 이미 이 사실의 단일 소유자로 서 있다 — `readMaxSafeCanvasDimension()`, probe 주입 가능, 알려진 브라우저별 실제 값(chrome/firefox/edge 32767, safari 16384, 미상 UA는 fallback 16384). `high-res-detector.internal.ts`의 `getMaxSafeDimension()`은 이 값을 그대로 재노출한다(`docs/architecture.md:61`).

즉 "canvas 한 변/면적이 너무 크다"는 사실을 판정하는 코드가 저장소에 **3곳** 존재한다.

| 위치 | 형태 | leaf와의 관계 |
| --- | --- | --- |
| `src/utils/browser-capabilities/canvas-limits.internal.ts` | per-browser 동적값, probe 주입 가능 | 정의 당사자 |
| `src/base/high-res-detector.internal.ts`(`getMaxSafeDimension`) | 위 값을 재노출만 | leaf 위임 완료(A4) |
| `src/composition/compose.ts`(`resolveCanvasSize`) | `MAX_CANVAS_DIMENSION = 16384` 하드코딩, throw `DIMENSION_TOO_LARGE` | **미위임** — 주석이 "high-res-detector의 default와 동일 값"이라 주장하지만 A4 완료 후 이 주장은 stale(safari 값에 고정된 채 chrome/firefox/edge의 실제 32767을 못 씀) |
| `src/core/single-renderer.internal.ts`(`validateLayout`) | `maxCanvasArea = 16384 * 16384` 하드코딩, `productionLog.warn`만(throw 안 함) | **미위임** |

`CanvasPool.acquire()`(`canvas-pool.internal.ts:60`)는 width/height 검증이 전혀 없다 — 브라우저 실제 한계를 넘으면 canvas가 조용히 깨지고 `drawImage`가 no-op 될 수 있다. primary path는 경고만 하고 차단하지 않으므로, chrome처럼 실제 상한이 32767인 브라우저에서도 안전 마진 없이 16384에서부터 경고가 뜬다 — 반대로 safari(실제 16384)에서는 정확하다.

## 결정

**동작 변화는 accuracy 정정만.** compose.ts의 throw 계약, single-renderer의 warn-only 계약 둘 다 그대로 둔다 — 바뀌는 건 하드코딩 리터럴이 leaf 참조로 바뀌면서 chrome/firefox/edge의 임계값이 16384 → 32767로 넓어지는 것뿐이다(safari/미상 UA는 fallback이 16384로 동일해 무변화).

primary path에 하드 게이트(throw)를 새로 추가하는 확장안은 **이번 카드의 범위가 아니다** — "재검토 조건" 참고.

두 소비자 모두 `browser-capabilities/index` 배럴에서 `readMaxSafeCanvasDimension()`을 직접 import한다(`high-res-detector.internal.ts`가 이미 쓰는 것과 동일 경로). `strategy-policy.internal.ts`의 `exceedsMaxSafeDimension()`은 재사용하지 않는다 — 그 함수는 고해상도 전략 선택 정책의 일부이고, compose/core는 그 정책과 무관한 별도 목적(하나는 생성 전 거부, 하나는 heads-up 경고)이라 정책 모듈에 커플링을 늘릴 이유가 없다.

## 변경 상세

**`src/composition/compose.ts`**

```ts
// 변경 전
// 대부분의 브라우저가 지원하는 보수적 한 변 상한 — high-res-detector의 default와 동일 값.
// 초과 시 브라우저는 오류 없이 빈 canvas를 만들 수 있어(특히 파생 크기의 grid) 생성 전에 거부한다.
const MAX_CANVAS_DIMENSION = 16384;

function resolveCanvasSize(width: number, height: number): { width: number; height: number } {
  if (...) { throw ...; }
  const rounded = { width: Math.round(width), height: Math.round(height) };
  if (rounded.width > MAX_CANVAS_DIMENSION || rounded.height > MAX_CANVAS_DIMENSION) {
    throw new ImageProcessError(
      `Canvas size ${rounded.width}x${rounded.height} exceeds the ${MAX_CANVAS_DIMENSION}px per-side browser limit.`,
      'DIMENSION_TOO_LARGE'
    );
  }
  return rounded;
}

// 변경 후
import { readMaxSafeCanvasDimension } from '../utils/browser-capabilities/index';

// 초과 시 브라우저는 오류 없이 빈 canvas를 만들 수 있어(특히 파생 크기의 grid) 생성 전에 거부한다.
// 상한 값 자체는 browser-capabilities/canvas-limits.internal.ts가 단일 소유한다
// (high-res-detector.internal.ts의 getMaxSafeDimension()과 같은 값).

function resolveCanvasSize(width: number, height: number): { width: number; height: number } {
  if (...) { throw ...; }
  const rounded = { width: Math.round(width), height: Math.round(height) };
  const maxSafeDimension = readMaxSafeCanvasDimension();
  if (rounded.width > maxSafeDimension || rounded.height > maxSafeDimension) {
    throw new ImageProcessError(
      `Canvas size ${rounded.width}x${rounded.height} exceeds the ${maxSafeDimension}px per-side browser limit.`,
      'DIMENSION_TOO_LARGE'
    );
  }
  return rounded;
}
```

모듈 top-level 상수를 없애고 함수 안에서 매번 `readMaxSafeCanvasDimension()`을 호출한다 — probe는 값을 캐시하지 않는 순수 조회이고(`canvas-limits.internal.ts` 자체 문서화), 테스트가 probe를 주입/해제하며 같은 프로세스 안에서 값을 바꿔 검증해야 하므로 top-level 상수로 굳히면 안 된다.

**`src/core/single-renderer.internal.ts`**

```ts
// 변경 전
// 16384^2 = 약 2.7억 픽셀, RGBA 기준 약 1GB — 일부 기기에서 메모리 부족 가능
const maxCanvasArea = 16384 * 16384;
if (width * height > maxCanvasArea) {
  productionLog.warn(
    `Warning: Large canvas size (${width}x${height}). This may cause memory issues on some devices.`
  );
}

// 변경 후
import { readMaxSafeCanvasDimension } from '../utils/browser-capabilities/index';

// 상한 값은 browser-capabilities/canvas-limits.internal.ts가 단일 소유한다(compose.ts의
// DIMENSION_TOO_LARGE 게이트, high-res-detector.internal.ts의 getMaxSafeDimension()과 같은 값).
// 면적 = 한 변 상한의 제곱을 메모리 위험 heads-up 임계값으로 쓴다(RGBA 기준).
const maxSafeDimension = readMaxSafeCanvasDimension();
const maxCanvasArea = maxSafeDimension * maxSafeDimension;
if (width * height > maxCanvasArea) {
  productionLog.warn(
    `Warning: Large canvas size (${width}x${height}). This may cause memory issues on some devices.`
  );
}
```

## 테스트 계약

**무변경** — 기존 `compose.test.ts`("canvas 크기가 16384px를 넘으면 DIMENSION_TOO_LARGE를 던진다")·`single-renderer.test.ts`("대형 canvas 경고" 2개)는 jsdom 기본 `navigator.userAgent`가 어떤 known 브라우저에도 안 걸려 probe가 `undefined`를 돌려주고 fallback(16384)으로 떨어진다 — 이전 하드코딩 값과 동일해 그대로 통과한다.

**신규 — `tests/unit/composition/compose.test.ts`**: `setCanvasLimitProbe`/`resetCanvasLimitProbe`를 `../../../src/utils/browser-capabilities/canvas-limits.internal`에서 import, `afterEach`에서 `resetCanvasLimitProbe()`.

```ts
it('probe가 chrome급 상한(32767)을 돌려주면 그 값을 실제 거부 기준으로 쓴다', async () => {
  setCanvasLimitProbe({ read: () => 32767 });

  // 이전 하드코딩 상한(16384)은 넘지만 새 상한(32767)은 안 넘는다 — 더 이상 거부되지 않는다
  const canvas = await composeImages({ type: 'layers', width: 20000, height: 100, layers: [] });
  expect(canvas.width).toBe(20000);

  // 새 상한(32767)도 넘으면 여전히 거부한다
  await expect(composeImages({ type: 'layers', width: 40000, height: 100, layers: [] })).rejects.toMatchObject({
    code: 'DIMENSION_TOO_LARGE',
  });
});
```

**신규 — `tests/unit/core/single-renderer.test.ts`**: 같은 probe import, `afterEach`에서 `resetCanvasLimitProbe()`.

```ts
describe('대형 canvas 경고', () => {
  // ... 기존 2개 유지 ...

  it('probe가 더 큰 상한을 돌려주면 이전에 경고하던 크기가 더 이상 경고하지 않는다', () => {
    setCanvasLimitProbe({ read: () => 40000 }); // maxCanvasArea = 1.6e9
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    const source = createDrawableSource(100, 100);

    // 20000x20000 = 4e8 — 옛 기본 상한(16384^2 ≈ 2.68e8)은 넘지만 새 상한은 안 넘는다
    const lease = renderLayout(source, makeLayout({ width: 20000, height: 20000 }));

    expect(warnSpy).not.toHaveBeenCalled();
    lease.detach();
  });

  it('probe가 더 작은 상한을 돌려주면 이전에 경고하지 않던 크기도 경고한다', () => {
    setCanvasLimitProbe({ read: () => 1000 }); // maxCanvasArea = 1e6
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    const source = createDrawableSource(100, 100);

    // 2000x2000 = 4e6 — 옛 기본 상한으로는 경고 안 뜨던 크기
    const lease = renderLayout(source, makeLayout({ width: 2000, height: 2000 }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    lease.release();
  });
});
```

## 문서 계약

- `docs/architecture.md:61` — `canvas-limits.internal.ts` 행 설명에 "`composition/compose.ts`의 canvas 크기 상한 검증(`DIMENSION_TOO_LARGE`)과 `core/single-renderer.internal.ts`의 대형 canvas 경고도 이 값을 직접 참조한다" 추가.
- `CHANGELOG.md` `[Unreleased]` → `### 수정`: chrome/firefox/edge에서 `composeImages()`의 `DIMENSION_TOO_LARGE` 거부 기준과 core 출력 경로의 대형 canvas 경고 임계값이 16384px(safari 기준)에서 브라우저 실제 상한(32767px)으로 넓어짐을 기재. safari/미상 브라우저는 무변화. Breaking 아님 — 이전에 거부/경고되던 입력이 더 이상 거부/경고되지 않는 방향으로만 바뀐다(반대 방향 없음).

## 비범위

- primary path(single-renderer)에 하드 게이트(throw) 추가. A3 원안의 확장안이지만, 기존 "경고만, throw 안 함" 계약(테스트로 고정됨)을 깨는 breaking change라 실사용 근거 없이 진행하지 않는다.
- `strategy-policy.internal.ts`의 `exceedsMaxSafeDimension()`을 compose.ts/single-renderer에서 재사용하는 것. 그 함수는 고해상도 전략 선택 정책 전용이고, 이번 두 소비자는 그 정책과 무관하다.
- `high-res-manager.ts`/`high-res-detector.internal.ts` 쪽 로직. 이미 A4에서 leaf로 전환 완료 — 이 카드의 대상이 아니다.
- compose.ts와 single-renderer.internal.ts의 검증 함수 자체를 하나로 합치는 것. 목적이 다르다(하나는 생성 전 거부, 하나는 heads-up 경고) — 강제 통합은 새 결합만 만든다.

## 재검토 조건

- primary path가 실제로 "경고만 뜨고 결과 이미지가 비어있다"는 사용자 리포트를 받으면, 하드 게이트(throw로 격상) 확장안을 별도 카드로 착수한다.
- compose.ts와 core 출력 경로가 향후 동일한 에러 코드·메시지 스키마를 요구하는 사건이 생기면, 두 검증 함수의 공용화를 별도 카드로 다룬다.
