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
    .replace(/^(declare\s+|export\s+)+/g, '')
    .replace(/^function\s+/, '')
    .replace(/\s*;\s*$/, '');
}

function extractDeclarationText(sourceText, symbolName) {
  const sourceFile = ts.createSourceFile('declarations.d.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  for (const statement of sourceFile.statements) {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === symbolName
    ) {
      return normalizeDeclarationText(printNode(statement, sourceFile));
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === symbolName) {
          return normalizeDeclarationText(printNode(statement, sourceFile));
        }
      }
    }
  }

  throw new Error(`Public declaration not found for symbol: ${symbolName}`);
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
    '',
    '## Examples',
    "- `const blob = await processImage(file).resize({ fit: 'cover', width: 300, height: 200 }).toBlob({ format: 'webp', quality: 0.85 });`",
    "- `const avatar = await createAvatar(file, { size: 128, format: 'png' });`",
    "- `const safeSvg = sanitizeSvg(svgString);`",
    "- `const blob = await convertToBlob(canvas);`",
    "- `const info = await detectImageSourceInfo(file);`",
    "- `const format = await fetchImageFormat('https://example.com/image-without-extension');`",
    "- `const format = resolveOutputFormat('avif', { supported: ['webp', 'png'] });`",
    '',
    '## Constraints',
    '- Only use exported public APIs from the package root or exported subpaths.',
    '- `resize()` should be used as a single resize step in one processing chain.',
    '- `maxFit` and `minFit` require at least one of `width` or `height`.',
    '- SVG safety-sensitive input should be sanitized before use when the source is untrusted.',
    '- Source detection helpers and `getImageFormat()` do not fetch remote URLs; use `fetchImageFormat()` when URL body sniffing is required.',
    '- This library targets browser environments with Canvas 2D API support.',
    '',
    '## Anti-Patterns',
    "- Do not invent unsupported chain methods such as `crop()`, `rotate()`, or `sharpen()`.",
    "- Do not call `resize()` multiple times in the same chain.",
    "- Do not rely on internal `dist/chunk-*` files or non-exported symbols.",
    "- Do not describe this package as a Node.js image pipeline.",
    '',
    '## Notes',
    '- `createAvatar()` defaults to PNG-oriented avatar output.',
    '- `createSocialImage()` applies platform-oriented sizing rules through `SocialImageOptions`.',
    '- `sanitizeSvg()` removes dangerous SVG content, it does not rasterize the image by itself.',
  ];

  return `${sections.join('\n')}\n`;
}
