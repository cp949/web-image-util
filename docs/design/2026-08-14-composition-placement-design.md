# composition 배치 모듈 추출 설계

## 배경

워터마크 배치 구현이 `src/composition/text-watermark.ts`와
`src/composition/image-watermark.ts`에 나뉘어 있다.

- 단일 배치는 두 호출부 모두 `PositionCalculator.calculatePosition()`으로 원점을 구하고,
  `applyRotation()`으로 객체 중심 회전을 적용한 뒤 그린다. 현재 동작은 서로 같다.
- 반복 배치는 두 호출부가 spacing 검증, 타일 범위 계산, stagger 적용, 중첩 루프를 각각 소유한다.
- 텍스트 타일은 프레임 전체를 회전해 연속 대각선 띠를 만든다. 이미지 타일은 격자를 유지하고
  각 타일을 중심 기준으로 회전한다. 두 표현은 의도적으로 다르다.

이미지 반복 배치에는 커버리지 버그가 있다. 현재 루프 패딩은 회전 전
`watermarkWidth`/`watermarkHeight`를 쓴다. 비정사각형 타일을 90도가 아닌 각도로 회전하면 실제
axis-aligned bounding box가 더 커지므로 캔버스 가장자리의 타일이 누락된다. 기존 정사각형 90도
테스트는 회전 전후 bounding size가 같아 이 결함을 드러내지 못한다.

반대 방향도 성립한다. 회전 기준은 타일 중심이므로 bounding box가 원본보다 작아져도(40×20 타일의
90도 회전은 20×40) 타일 점유 범위는 원점에서 `width/2`만큼 밀려 있다. 패딩을 bounding size로
갈아끼우기만 하면 이 경우 오히려 기존보다 좁아져 겹치는 타일을 잃는다. 패딩은 두 크기 중 큰 쪽이다.

## 결정

배치 규칙을 `src/composition/placement.internal.ts`에 모은다. 호출자는 무엇을 그릴지만 callback으로
제공한다. 배치 모듈은 위치 계산, 회전 상태 수명, 타일 범위, spacing 검증, stagger 좌표 생성을
소유한다.

이 seam은 두 워터마크 호출부에 흩어진 배치 복잡성을 한 인터페이스 뒤로 숨긴다. Canvas 스타일
(font, fillStyle, blend mode, alpha)과 실제 draw 호출은 워터마크 호출부에 남긴다.

텍스트의 frame 회전과 이미지의 per-tile 회전은 통일하지 않는다. 같은 좌표 반복 구현만 합치고
표현 차이는 `rotationMode`로 명시한다.

## 모듈 계약

새 파일 `src/composition/placement.internal.ts`.

```ts
placeOnce(ctx, spec: PlaceOnceSpec, draw: (origin: Point) => void): Point
placeTiled(ctx, spec: PlaceTiledSpec, draw: (origin: Point) => void): void
```

`PlaceOnceSpec`은 `containerSize`, `objectSize`, `position`, `customPosition?`, `margin?`,
`rotation?`을 받는다. 구현 순서는 다음과 같다.

1. `PositionCalculator.calculatePosition()`으로 원점을 계산한다.
2. 자체 `withCanvasState()` 범위에서 `applyRotation()`을 호출한다.
3. `draw(origin)`을 호출한다.
4. 계산한 원점을 반환한다.

`PlaceTiledSpec`은 `containerSize`, `tileSize`, `spacing`, `stagger?`, `rotation?`,
`rotationMode: 'frame' | 'per-tile'`, `context`를 받는다. `context`는 기존 `OPTION_INVALID` 오류의
메시지 라벨이다. `placeTiled()`이 `requirePositiveSpacing()`을 호출한다.

내부 계산은 Canvas 상태와 분리한다.

```ts
computeFrameTileBounds(...): TileBounds
computePerTileBounds(...): TileBounds
iterateTileGrid(...): Iterable<Point>
```

- `computeFrameTileBounds()`는 `getOriginRotationCoverageBounds()`로 프레임 회전 시 필요한 역회전
  캔버스 범위를 구한다.
- `computePerTileBounds()`는 원본 타일 크기와 회전된 bounding size 중 큰 쪽을 축별로 패딩에 쓴다.
  회전 기준이 타일 중심이므로 bounding size만 쓰면 AABB가 작아지는 경우(40×20 타일의 90도 회전은
  20×40) 패딩이 원본보다 좁아져 오히려 가장자리 타일을 잃는다. rotation 0에서는 두 값이 같다.
- `iterateTileGrid()`는 bounds, spacing, stagger로 draw 원점들을 생성한다.
- frame 모드는 루프 밖에서 `ctx.rotate()`를 한 번 적용한다.
- per-tile 모드는 각 타일을 `withCanvasState()`로 감싸고 `applyRotation()`을 적용한다.

`canvas-drawing.internal.ts`에 다음 leaf 계산을 추가한다.

```ts
getRotatedTileBoundingSize(size: Size, rotation?: number): Size
```

회전된 사각형의 axis-aligned bounding size를 반환한다. 회전이 없으면 입력 크기를 그대로 반환한다.
기존 `applyRotation()`, `getOriginRotationCoverageBounds()`, `withCanvasState()`는 이동하지 않는다.

## 소비자 투영

**`TextWatermark.addToCanvas()` / `ImageWatermark.addToCanvas()`** — 직접 수행하던
`calculatePosition()` + `applyRotation()`을 `placeOnce()`로 바꾼다. 호출자가 소유한 Canvas 스타일
상태 범위 안에서 `placeOnce()`를 호출한다.

**`TextWatermark.addRepeatingPattern()`** — `placeTiled(..., rotationMode: 'frame', ...)`를
사용한다. 프레임 전체 회전 표현을 보존한다.

**`ImageWatermark.addRepeatingPattern()`** —
`placeTiled(..., rotationMode: 'per-tile', ...)`를 사용한다. 타일별 중심 회전을 보존하고 원본 크기와
회전된 bounding size 중 큰 쪽으로 커버리지 패딩을 계산한다.

## 테스트 계약

- `tests/unit/composition/placement.test.ts`: `placeOnce()`의 위치와 회전 호출 순서,
  `computeFrameTileBounds()`/`computePerTileBounds()`/`iterateTileGrid()`의 고정 좌표,
  spacing 검증을 확인한다.
- `tests/unit/composition/canvas-drawing.test.ts`: `getRotatedTileBoundingSize()`의 회전 없음,
  정사각형 90도, 비정사각형 비90도 결과를 확인한다.
- `tests/unit/composition/watermark-image.test.ts`: 비정사각형 회전 타일이 기존 패딩 밖의 필요한
  행·열까지 생성되는 회귀 테스트를 추가한다.
- 기존 워터마크 테스트의 좌표, stagger, `translate()`/`rotate()` 순서와 인자,
  `OPTION_INVALID`/`details: { option }` assertion은 변경 없이 통과해야 한다.

## 문서 계약

- `docs/design/README.md`의 현재 기록에 이 결정을 추가한다.
- `CONTEXT.md`에 「배치 (placement)」 용어를 추가한다.
- `docs/architecture.md` 핵심 모듈 표에는 composition 항목을 새로 추가하지 않는다.

## 비범위

- `compose.ts`의 layers/grid/collage 배치. Position enum과 margin을 쓰지 않는 별도 좌표 모델이다.
- frame 회전과 per-tile 회전의 표현 통일.
- `canvas-drawing.internal.ts`의 `drawImageLayer()`가 `opacity || 1`로 0을 덮어쓰는 문제.
- 공개 composition export 추가. `placement.internal.ts`는 내부 모듈로 유지한다.

## 재검토 조건

- rotation 0 경로의 기존 좌표나 Canvas 호출 순서가 달라지면 등가성 주장이 틀린 것이다. 테스트가
  아니라 구현을 고친다.
- 텍스트와 이미지 외의 호출부가 같은 Position/margin 기반 반복 배치를 요구하면 이 인터페이스의
  소비자로 추가할지 검토한다.
- layers/grid/collage가 같은 배치 의미를 채택하면 `compose.ts` 포함 여부를 별도 설계한다.
