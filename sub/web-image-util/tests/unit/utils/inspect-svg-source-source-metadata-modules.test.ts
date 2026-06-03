import { describe, expect, it } from 'vitest';
import { detectInspectSourceEnvironment } from '../../../src/utils/inspect-svg-source/environment';
import { detectMimeAndExtension } from '../../../src/utils/inspect-svg-source/mime-extension';
import { decideSvgFromSniff } from '../../../src/utils/inspect-svg-source/sniff-decision';
import { detectOriginalKind, estimateSourceBytes } from '../../../src/utils/inspect-svg-source/source-kind';

describe('inspect-svg-source metadata 내부 모듈', () => {
  it('source-kind 모듈은 File을 Blob보다 먼저 분류하고 byte를 추정한다', () => {
    const file = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' });

    expect(detectOriginalKind(file)).toBe('file');
    expect(estimateSourceBytes(file, 'file')).toBe(file.size);
  });

  it('mime-extension 모듈은 URL query/fragment를 제외하고 확장자를 추출한다', () => {
    const result = detectMimeAndExtension('https://example.com/icon.svg?token=SECRET#hash', 'url-string');

    expect(result).toEqual({ mime: null, extension: 'svg' });
  });

  it('sniff-decision 모듈은 SVG MIME과 다른 확장자를 mismatch finding으로 보존한다', () => {
    const result = decideSvgFromSniff({
      originalKind: 'file',
      mime: 'image/svg+xml',
      extension: 'png',
      bytes: 100,
      byteLimit: 10_000,
    });

    expect(result.kind).toBe('svg');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].code).toBe('extension-mismatch');
  });

  it('environment 모듈은 inspect source 환경 문자열만 반환한다', () => {
    expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(detectInspectSourceEnvironment());
  });
});
