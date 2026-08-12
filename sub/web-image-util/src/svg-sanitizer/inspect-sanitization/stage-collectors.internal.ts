import {
  decodeSvgDataImageRef,
  isRecognizedDataUrlMimeType,
  isSafeRasterDataImageRef,
  parseSvgDataUrlRef,
} from '../../utils/svg-data-url-policy.internal';
import {
  collectSvgCssReferenceSignals,
  collectSvgDomSecuritySignals,
  isReferenceAttribute,
  MAX_SAMPLE_LENGTH,
  MAX_SAMPLES_PER_STAGE,
  readReferenceAttribute,
} from '../../utils/svg-inspection';
import type { InspectSvgSanitizationStage, InspectSvgSanitizationStageCode } from './types.internal';

/** doctype 선언 정규식. */
const DOCTYPE_PATTERN = /<!DOCTYPE\b/gi;
/** entity 선언 정규식. */
const ENTITY_PATTERN = /<!ENTITY\b/gi;

/**
 * stage 단위 누적 상태. count는 발생 수, samples는 발생 순서 중복 제거(Set) 후 최대 3개.
 */
interface StageAccumulator {
  count: number;
  samples: Set<string>;
}

function createAccumulator(): StageAccumulator {
  return { count: 0, samples: new Set<string>() };
}

/** samples Set에 토큰을 추가한다. 32자 초과는 잘라낸다. */
function addSample(acc: StageAccumulator, sample: string): void {
  if (acc.samples.size >= MAX_SAMPLES_PER_STAGE) return;
  const normalized = sample.length > MAX_SAMPLE_LENGTH ? sample.slice(0, MAX_SAMPLE_LENGTH) : sample;
  acc.samples.add(normalized);
}

/** count > 0 이면 stage를 결과 배열에 추가한다. samples 길이 상한은 addSample이 보장한다. */
function pushStage(
  stages: InspectSvgSanitizationStage[],
  code: InspectSvgSanitizationStageCode,
  acc: StageAccumulator
): void {
  if (acc.count <= 0) return;
  stages.push({
    code,
    count: acc.count,
    samples: Array.from(acc.samples),
  });
}

/**
 * count > 0 이면 미리 계산된 count/samples로 stage를 추가한다.
 * 공통 DOM 보안 신호 helper가 산출한 결과를 그대로 stage로 옮길 때 사용한다.
 */
function pushCountStage(
  stages: InspectSvgSanitizationStage[],
  code: InspectSvgSanitizationStageCode,
  count: number,
  samples: string[] = []
): void {
  if (count <= 0) return;
  stages.push({ code, count, samples });
}

/**
 * `script-removed` / `foreign-object-removed` / `event-handler-removed` / `external-href-removed`
 * stage를 공통 DOM 보안 신호 helper로 수집한다.
 *
 * external-href 판정은 helper가 담당한다. 위협 정책의 URI allowlist가 모드 무관으로
 * 통일된 뒤로 정책 구분 없이 같은 기준으로 센다. `data:` 값은 embedded image stage가
 * 별도로 처리하므로 본 stage에서는 제외돼 중복 카운트가 발생하지 않는다.
 */
function collectDomSecurityStages(doc: Document, stages: InspectSvgSanitizationStage[]): void {
  const signals = collectSvgDomSecuritySignals(doc);
  pushCountStage(stages, 'script-removed', signals.scriptElementCount, ['script']);
  pushCountStage(stages, 'foreign-object-removed', signals.foreignObjectElementCount, ['foreignobject']);
  pushCountStage(
    stages,
    'event-handler-removed',
    signals.eventHandlerAttributeCount,
    signals.eventHandlerAttributeSamples
  );
  pushCountStage(stages, 'external-href-removed', signals.externalHrefCount, signals.externalHrefSamples);
}

/**
 * `external-css-removed` 카운트를 공통 CSS 참조 신호 helper로 수집한다.
 * 위협 정책의 CSS 판정이 모드 무관으로 통일되어 정책 구분 없이
 * style·presentation 속성과 `<style>` 본문 양쪽을 검사한다.
 */
function collectExternalCssStage(doc: Document, stages: InspectSvgSanitizationStage[]): void {
  const signals = collectSvgCssReferenceSignals(doc);
  pushCountStage(stages, 'external-css-removed', signals.externalCssCount, signals.externalCssSamples);
}

/**
 * 원본 svgString의 `<!DOCTYPE>` / `<!ENTITY>` 매치 수로 stage를 수집한다.
 *
 * lightweight sanitizer는 DOCTYPE/ENTITY를 제거하지 않으므로 호출 정책 컨텍스트가
 * `'lightweight'` 또는 `'skip'`이면 본 함수는 어떤 stage도 추가하지 않는다. 두 stage는
 * 향후 strict 정책 컨텍스트에서만 등장한다.
 */
function collectDoctypeAndEntityStages(
  svgString: string,
  policy: 'lightweight' | 'skip' | 'strict',
  stages: InspectSvgSanitizationStage[]
): void {
  if (policy !== 'strict') return;

  const doctypeMatches = svgString.match(DOCTYPE_PATTERN);
  if (doctypeMatches && doctypeMatches.length > 0) {
    const acc = createAccumulator();
    acc.count = doctypeMatches.length;
    addSample(acc, 'doctype');
    pushStage(stages, 'doctype-removed', acc);
  }

  const entityMatches = svgString.match(ENTITY_PATTERN);
  if (entityMatches && entityMatches.length > 0) {
    const acc = createAccumulator();
    acc.count = entityMatches.length;
    addSample(acc, 'entity');
    pushStage(stages, 'entity-removed', acc);
  }
}

/**
 * embedded image stage 3개를 한 번의 DOM 순회로 수집한다.
 *
 * 모든 element를 순회하며 `href` / `xlink:href` / `src` 속성값 후보(`getAttributeNS` 우선 +
 * `getAttribute` 폴백)에 대해 다음 분기를 수행한다.
 *
 * 1. `value.trim().toLowerCase()`이 `data:`로 시작하지 않으면 본 헬퍼 범위 밖(외부 URL / 내부
 *    fragment / 일반 상대 경로는 `collectDomSecurityStages`의 `external-href-removed` 또는 보존
 *    대상).
 * 2. `parseSvgDataUrlRef(value)`의 mimeType이 `'image/svg+xml'`이면 `nested-svg-resanitized`로
 *    카운트하고 samples에 `'image/svg+xml'`를 추가한다.
 * 3. `isSafeRasterDataImageRef(value)`가 true면 `data-image-preserved`로 카운트하고 samples에
 *    `info.mimeType`(소문자)을 추가한다.
 * 4. 그 외 `data:` 시작 값은 `data-image-blocked`로 카운트한다. samples에는 `info.mimeType`이
 *    인식된 MIME(`isRecognizedDataUrlMimeType`)일 때만 그 값을, 아니면 `'unknown'`을 추가한다
 *    (metadata 위치의 임의 입력 누출 차단). 미허용 MIME, 크기 초과, base64 디코딩 실패,
 *    파싱 실패 모두 본 분기로 모인다.
 *
 * `parseSvgDataUrlRef`는 한 attribute 값당 한 번만 호출해 mimeType 분기와 blocked samples를
 * 같이 결정한다(중복 manual parse 방지).
 *
 * `xlink:href`는 공통 DOM 보안 신호 helper와 동일하게 namespace lookup을 우선한다.
 */
export function collectEmbeddedImageStages(doc: Document): InspectSvgSanitizationStage[] {
  const preserved = createAccumulator();
  const blocked = createAccumulator();
  const nested = createAccumulator();

  const elements = doc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element) continue;

    const attrNames = element.getAttributeNames();
    for (const attrName of attrNames) {
      if (!isReferenceAttribute(element, attrName)) continue;

      const value = readReferenceAttribute(element, attrName) ?? '';
      if (value === '') continue;
      if (!value.trim().toLowerCase().startsWith('data:')) continue;

      const info = parseSvgDataUrlRef(value);
      if (info?.mimeType === 'image/svg+xml' && decodeSvgDataImageRef(value) !== null) {
        nested.count += 1;
        addSample(nested, 'image/svg+xml');
      } else if (isSafeRasterDataImageRef(value)) {
        // info는 isSafeRasterDataImageRef 내부에서 다시 파싱되지만, 본 분기에 진입했다는 것은
        // 해당 호출이 non-null info를 얻었다는 뜻이므로 외부 info도 mimeType을 보장한다.
        preserved.count += 1;
        addSample(preserved, info?.mimeType ?? 'unknown');
      } else {
        // info.mimeType은 data: metadata 위치의 무검증 값이므로, 인식된 MIME일 때만 sample로
        // echo하고 그 외(공격자가 심은 임의 텍스트 포함)는 'unknown'으로 치환해 누출을 막는다.
        blocked.count += 1;
        addSample(blocked, info && isRecognizedDataUrlMimeType(info.mimeType) ? info.mimeType : 'unknown');
      }
    }
  }

  const stages: InspectSvgSanitizationStage[] = [];
  pushStage(stages, 'data-image-preserved', preserved);
  pushStage(stages, 'data-image-blocked', blocked);
  pushStage(stages, 'nested-svg-resanitized', nested);
  return stages;
}

/**
 * 일반 정책 stage 7개를 수집한다(`script-removed` / `foreign-object-removed` /
 * `event-handler-removed` / `external-href-removed` / `external-css-removed` /
 * `doctype-removed` / `entity-removed`).
 *
 * DOM 기반 수집은 doc이 non-null일 때만 수행한다. 파싱 실패 또는 non-svg 루트 입력은
 * 빈 stages를 반환한다(doctype/entity는 호출 정책 컨텍스트로 분기되며 lightweight/skip에서는
 * 어차피 결과에서 제외된다).
 *
 * embedded image stage(`data-image-*`, `nested-svg-resanitized`)는 본 헬퍼 범위 밖이며,
 * `collectEmbeddedImageStages`가 별도로 수집해 합쳐진다.
 */
export function collectGeneralStages(
  svgString: string,
  doc: Document | null,
  policy: 'lightweight' | 'skip' | 'strict'
): InspectSvgSanitizationStage[] {
  const stages: InspectSvgSanitizationStage[] = [];

  if (doc !== null) {
    collectDomSecurityStages(doc, stages);
    collectExternalCssStage(doc, stages);
  }

  collectDoctypeAndEntityStages(svgString, policy, stages);

  return stages;
}
