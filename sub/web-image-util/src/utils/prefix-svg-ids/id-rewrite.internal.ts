/**
 * doc 내 id 속성이 있는(빈 문자열 제외) 모든 요소를 수집한다. 순회 순서 보존.
 */
export function collectIdElements(doc: Document): Element[] {
  const all = doc.getElementsByTagName('*');
  const result: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const id = all[i].getAttribute('id');
    if (id !== null && id !== '') {
      result.push(all[i]);
    }
  }
  return result;
}

/**
 * 1차 패스: idempotent 분류. 2차 패스: collision 검사.
 * 결정론적 처리를 위해 수집 순서대로 후보를 등록하고, 이미 결정된 후보 또는 기존 doc id와 충돌하면 제외한다.
 */
export function planIdRewrites(
  elements: Element[],
  prefix: string
): { rewrites: Map<string, string>; warnings: { idempotent: number; collision: number } } {
  const warnings = { idempotent: 0, collision: 0 };
  const rewrites = new Map<string, string>();

  // 원본 doc의 전체 id 집합
  const existingIds = new Set<string>(elements.map((el) => el.getAttribute('id') as string));

  // 이미 결정된 후보 결과 id 집합(충돌 검사용)
  const assignedCandidates = new Set<string>();

  for (const el of elements) {
    const originalId = el.getAttribute('id') as string;
    const prefixedId = `${prefix}-${originalId}`;

    // idempotent: 이미 prefix가 붙어 있음
    if (originalId.startsWith(`${prefix}-`)) {
      warnings.idempotent += 1;
      continue;
    }

    // collision: 후보 결과 id가 기존 doc id 또는 이미 결정된 후보와 충돌
    if (existingIds.has(prefixedId) || assignedCandidates.has(prefixedId)) {
      warnings.collision += 1;
      continue;
    }

    rewrites.set(originalId, prefixedId);
    assignedCandidates.add(prefixedId);
  }

  return { rewrites, warnings };
}

/**
 * rewrites에 등재된 id를 가진 요소의 id attribute를 새 값으로 변경한다. 변경한 요소 개수 반환.
 * 같은 originalId가 두 요소에 등장하는 비정상 입력에서는 첫 요소만 rewrite하고 나머지는 건너뛴다
 * (planIdRewrites가 후속 요소를 이미 collision으로 분류한다 — D12).
 */
export function applyIdRewrites(elements: Element[], rewrites: Map<string, string>): number {
  let count = 0;
  const processed = new Set<string>();
  for (const el of elements) {
    const originalId = el.getAttribute('id') as string;
    if (processed.has(originalId)) continue;
    const newId = rewrites.get(originalId);
    if (newId !== undefined) {
      el.setAttribute('id', newId);
      processed.add(originalId);
      count += 1;
    }
  }
  return count;
}
