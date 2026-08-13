/**
 * Blob 기초 facts를 공개 진단·이미지 정보의 MIME 우선 포맷 정책으로 투영한다.
 */

import type { ImageFormat } from '../../types';
import type { BlobSourceFacts } from './source-facts.internal';

/** 알려진 MIME 포맷을 우선하고, MIME이 모호할 때만 파일명 포맷으로 보완한다. */
export function resolveMimeFirstBlobFormat(facts: BlobSourceFacts): ImageFormat | 'unknown' {
  return facts.mimeFormat !== 'unknown' ? facts.mimeFormat : facts.fileNameFormat;
}
