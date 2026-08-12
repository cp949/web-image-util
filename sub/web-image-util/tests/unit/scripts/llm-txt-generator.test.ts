import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  test('utils 핵심 API 목록에 이미지 정보와 SVG 감지 유틸을 포함한다', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/generate-llm-txt.mjs'), 'utf8');

    expect(script).toContain("'blobToDataURL'");
    expect(script).toContain("'dataURLToBlob'");
    expect(script).toContain("'decodeSvgDataURL'");
    expect(script).toContain("'detectImageSourceInfo'");
    expect(script).toContain("'estimateDataURLPayloadByteLength'");
    expect(script).toContain("'formatToMimeType'");
    expect(script).toContain("'getImageAspectRatio'");
    expect(script).toContain("'getImageDimensions'");
    expect(script).toContain("'getImageFormat'");
    expect(script).toContain("'getImageInfo'");
    expect(script).toContain("'hasTransparency'");
    expect(script).toContain("'fetchImageFormat'");
    expect(script).toContain("'fetchImageSourceBlob'");
    expect(script).not.toContain("'getOrFetchImageFormat'");
    expect(script).toContain("'isInlineSvg'");
    expect(script).toContain("'resolveOutputFormat'");
  });

  test('해시가 붙은 dist 선언 파일명을 하드코딩하지 않는다', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/generate-llm-txt.mjs'), 'utf8');

    expect(script).not.toContain('dist/svg-sanitizer-');
  });

  test('모든 모듈이 sourceText를 직접 지정하므로 modulePath 폴백 읽기를 쓰지 않는다', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/generate-llm-txt.mjs'), 'utf8');

    expect(script).not.toContain('module.sourceText ??');
  });

  test('서로 다른 dist 파일에 동일한 이름의 선언이 충돌하면 llm.txt 생성을 실패시킨다', () => {
    // sourceText는 generate-llm-txt.mjs에서 dist 전체 .d.ts를 이어붙인 한 문자열(distDeclarations)이므로,
    // 서로 다른 원본 파일의 선언도 여기서는 같은 sourceText 안에 함께 존재한다.
    expect(() =>
      renderLlmTxt({
        packageName: '@cp949/web-image-util',
        readmeText: '# README',
        modules: [
          {
            modulePath: 'dist/utils/index.d.ts',
            moduleSpecifier: '@cp949/web-image-util/utils',
            sourceText: `
export interface SvgOptimizer { optimize(svg: string): string; }
export declare class SvgOptimizer { run(svg: string): string; }
            `,
            keySymbols: ['SvgOptimizer'],
          },
        ],
      })
    ).toThrow(/SvgOptimizer/);
  });

  test('동일한 함수의 오버로드 시그니처는 충돌로 취급하지 않는다', () => {
    const output = renderLlmTxt({
      packageName: '@cp949/web-image-util',
      readmeText: '# README',
      modules: [
        {
          modulePath: 'dist/index.d.ts',
          moduleSpecifier: '@cp949/web-image-util',
          sourceText: `
declare function isDataURLString(value: string): boolean;
declare function isDataURLString(value: unknown): value is string;
          `,
          keySymbols: ['isDataURLString'],
        },
      ],
    });

    expect(output).toContain('- `isDataURLString(value: string): boolean`');
  });

  test('여러 dist 청크에 걸쳐 완전히 동일한 선언이 중복돼도 충돌로 취급하지 않는다', () => {
    const output = renderLlmTxt({
      packageName: '@cp949/web-image-util',
      readmeText: '# README',
      modules: [
        {
          modulePath: 'dist/index.d.ts',
          moduleSpecifier: '@cp949/web-image-util',
          sourceText: `
export interface ThumbnailOptions { size: number; }
export interface ThumbnailOptions { size: number; }
          `,
          keySymbols: ['ThumbnailOptions'],
        },
      ],
    });

    expect(output).toContain('- `interface ThumbnailOptions { size: number; }`');
  });
});
