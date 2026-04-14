import { describe, expect, test } from 'vitest';

// 런타임 생성 스크립트를 직접 검증하기 위해 선언 파일 없이 .mjs 모듈을 불러온다.
// @ts-expect-error 테스트에서 런타임 스크립트를 직접 import한다.
import { renderLlmTxt } from '../../../scripts/llm-txt-generator.mjs';

describe('llm.txt 생성기', () => {
  test('핵심 공개 API 시그니처를 포함한 llm.txt를 생성한다', () => {
    const output = renderLlmTxt({
      packageName: '@cp949/web-image-util',
      readmeText: '# README\nCanvas 기반 브라우저 이미지 처리 라이브러리',
      modules: [
        {
          modulePath: 'dist/index.d.ts',
          moduleSpecifier: '@cp949/web-image-util',
          sourceText: `
declare function processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor;
export interface ThumbnailOptions { size: number; }
          `,
          keySymbols: ['processImage'],
        },
        {
          modulePath: 'dist/presets/index.d.ts',
          moduleSpecifier: '@cp949/web-image-util/presets',
          sourceText: `
declare function createThumbnail(source: ImageSource, options: ThumbnailOptions): Promise<ResultBlob>;
          `,
          keySymbols: ['createThumbnail'],
        },
      ],
    });

    expect(output).toContain('# Library: @cp949/web-image-util');
    expect(output).toContain('- `processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor`');
    expect(output).toContain(
      '- `createThumbnail(source: ImageSource, options: ThumbnailOptions): Promise<ResultBlob>`'
    );
    expect(output).toContain('## Usage Patterns');
    expect(output).toContain('## Constraints');
    expect(output).toContain('## Anti-Patterns');
    expect(output).not.toContain('@cp949/web-image-util: function');
    expect(output).not.toContain('Build-generated `llm.txt`');
  });
});
