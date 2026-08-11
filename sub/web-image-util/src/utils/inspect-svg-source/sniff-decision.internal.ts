// 타입만 import — JS 런타임 순환 차단. 런타임 값 import 추가 시 순환이 남는다.
import type { InspectSvgSourceFinding, InspectSvgSourceKind, InspectSvgSourceMeta } from './types.internal';

export interface DecideSvgFromSniffParams {
  originalKind: InspectSvgSourceMeta['originalKind'];
  mime: string | null;
  extension: string | null;
  bytes: number | null;
  byteLimit: number;
}

/**
 * MIME / 확장자 / originalKind / byte 크기를 종합해 kind 1차 분기를 결정한다.
 * fetch와 본문 도출은 수행하지 않는다.
 */
export function decideSvgFromSniff({ originalKind, mime, extension, bytes, byteLimit }: DecideSvgFromSniffParams): {
  kind: InspectSvgSourceKind;
  findings: InspectSvgSourceFinding[];
} {
  const findings: InspectSvgSourceFinding[] = [];

  // byte 초과 시 본문 sniff 불가 → 'unknown'으로 보수적 처리.
  if (bytes !== null && bytes > byteLimit) {
    findings.push({
      code: 'byte-limit-exceeded',
      message: `Input size (${bytes} bytes) exceeds byte limit (${byteLimit} bytes).`,
      details: { bytes, byteLimit },
    });
    return { kind: 'unknown', findings };
  }

  // MIME이 'image/svg+xml'이면 SVG로 확정한다.
  if (mime === 'image/svg+xml') {
    if (extension !== null && extension !== 'svg') {
      findings.push({
        code: 'extension-mismatch',
        message: `MIME type is image/svg+xml but file extension is .${extension}.`,
        details: { mime, extension },
      });
    }
    return { kind: 'svg', findings };
  }

  // 확장자가 'svg'이면 SVG로 확정한다.
  if (extension === 'svg') {
    if (mime !== null && mime !== 'image/svg+xml') {
      findings.push({
        code: 'mime-mismatch',
        message: `File extension is .svg but MIME type is ${mime}.`,
        details: { mime, extension },
      });
    }
    return { kind: 'svg', findings };
  }

  // inline string은 본문 sniff(extractSvgBody → inspectSvg)에서 확정한다.
  if (originalKind === 'string') {
    return { kind: 'unknown', findings };
  }

  return { kind: 'not-svg-source', findings };
}
