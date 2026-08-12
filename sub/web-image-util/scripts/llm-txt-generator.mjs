import ts from 'typescript';

function printNode(node, sourceFile) {
  const printer = ts.createPrinter({ removeComments: true });
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeDeclarationText(text) {
  return collapseWhitespace(text)
    .replace(/\s+private\s+[^;]+;/g, '')
    .replace(/^(declare\s+|export\s+)+/g, '')
    .replace(/^function\s+/, '')
    .replace(/\s*;\s*$/, '');
}

function extractDeclarationText(sourceText, symbolName) {
  const sourceFile = ts.createSourceFile(
    'declarations.d.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const matches = [];

  for (const statement of sourceFile.statements) {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === symbolName
    ) {
      matches.push(statement);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === symbolName) {
          matches.push(statement);
        }
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(`Public declaration not found for symbol: ${symbolName}`);
  }

  const normalizedTexts = matches.map((statement) => normalizeDeclarationText(printNode(statement, sourceFile)));
  const isFunctionOverloadSet = matches.every((statement) => ts.isFunctionDeclaration(statement));

  if (!isFunctionOverloadSet && new Set(normalizedTexts).size > 1) {
    // sourceText는 dist 전체 .d.ts를 이어붙인 문자열이라 원본 파일 경계가 없다.
    // 서로 다른 파일이 같은 이름으로 다른 선언을 노출하면 첫 매치를 조용히 반환하는 대신
    // 여기서 실패시켜 llm.txt에 엉뚱한 시그니처가 삽입되는 것을 막는다.
    throw new Error(
      `Ambiguous public declaration for symbol: ${symbolName} (${new Set(normalizedTexts).size} conflicting declarations found across dist/*.d.ts)`
    );
  }

  return normalizedTexts[0];
}

function renderKeyApis(modules) {
  const lines = [];

  for (const module of modules) {
    for (const symbolName of module.keySymbols) {
      const signature = extractDeclarationText(module.sourceText, symbolName);
      lines.push(`- \`${signature}\``);
    }
  }

  return lines;
}

export function renderLlmTxt({ packageName, readmeText, modules }) {
  const hasSvg = /svg/i.test(readmeText);
  const overview = [
    '- Browser-side image processing library built on Canvas 2D API.',
    '- Primary workflow is an async chainable processor returned by `processImage(...)`.',
    hasSvg
      ? '- Includes preset helpers plus SVG sanitizing, conversion, and browser-capability utilities.'
      : '- Includes preset helpers and utility subpaths for conversion and capability detection.',
  ];

  const keyApis = renderKeyApis(modules);

  const sections = [
    `# Library: ${packageName}`,
    '',
    '## Overview',
    '- Browser image processing library built on Canvas 2D API.',
    '- Main workflow is async image processing through a chain returned by `processImage(...)`.',
    hasSvg
      ? '- Provides preset helpers and SVG/conversion utilities for browser-safe image workflows.'
      : '- Provides preset helpers and conversion utilities for browser image workflows.',
    '',
    '## Key APIs',
    ...keyApis,
    '',
    '## Usage Patterns',
    '- Use `processImage(...)` for resize and output generation.',
    '- The processing chain is lazy until an output method such as `toBlob()`, `toCanvas()`, `toDataURL()`, or `toFile()` is called.',
    '- The main processing flow is async.',
    '- Preset helpers return `Promise<ResultBlob>` directly.',
    '- Utility functions are better for conversion, Data URL handling, source detection, metadata lookup, format resolution, transparency checks, or SVG sanitizing.',
    "- Use `processImage(source, { svgSanitizer: 'strict' })` when untrusted SVG input should be sanitized only after the source is confirmed as SVG.",
    '- Use the `@cp949/web-image-util/svg-sanitizer` subpath when you need explicit strict SVG sanitizing before processing.',
    '',
    '## Examples',
    "- `const blob = await processImage(file).resize({ fit: 'cover', width: 300, height: 200 }).toBlob({ format: 'webp', quality: 0.85 });`",
    "- `const avatar = await createAvatar(file, { size: 128, format: 'png' });`",
    '- `const safeSvg = sanitizeSvg(svgString);`',
    "- `const strictBlob = await processImage(untrustedSvg, { svgSanitizer: 'strict' }).toBlob();`",
    '- `const strictSvg = sanitizeSvgStrict(svgString);`',
    "- `const blob = await ensureBlob(canvas, { format: 'webp', quality: 0.85 });`",
    '- `const info = await detectImageSourceInfo(file);`',
    "- `const format = await fetchImageFormat('https://example.com/image-without-extension');`",
    "- `const format = resolveOutputFormat('avif', { supported: ['webp', 'png'] });`",
    '',
    '## Constraints',
    '- Only use exported public APIs from the package root or exported subpaths.',
    '- `resize()` should be used as a single resize step in one processing chain.',
    '- `maxFit` and `minFit` require at least one of `width` or `height`.',
    "- SVG input uses `svgSanitizer: 'lightweight'` by default; choose `'strict'` for untrusted SVG or `'skip'` only after trusted prior sanitizing.",
    "- `unsafe_processImage()` is a compatibility escape hatch and is not the same as `svgSanitizer: 'skip'`.",
    '- Source detection helpers and `getImageFormat()` do not fetch remote URLs; use `fetchImageFormat()` when URL body sniffing is required.',
    '- This library targets browser environments with Canvas 2D API support.',
    '',
    '## Anti-Patterns',
    '- Do not invent unsupported chain methods such as `crop()`, `rotate()`, or `sharpen()`.',
    '- Do not call `resize()` multiple times in the same chain.',
    '- Do not rely on internal `dist/chunk-*` files or non-exported symbols.',
    '- Do not describe this package as a Node.js image pipeline.',
    '',
    '## Notes',
    '- `createAvatar()` defaults to PNG-oriented avatar output.',
    '- `createSocialImage()` applies platform-oriented sizing rules through `SocialImageOptions`.',
    '- `sanitizeSvg()` removes dangerous SVG content, it does not rasterize the image by itself.',
  ];

  return `${sections.join('\n')}\n`;
}
