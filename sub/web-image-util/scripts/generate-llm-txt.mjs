import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderLlmTxt } from './llm-txt-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

async function readText(relativePath) {
  return readFile(path.join(packageRoot, relativePath), 'utf8');
}

async function readDistDeclarations() {
  const distDir = path.join(packageRoot, 'dist');
  const entries = await readdir(distDir);
  const declarationFiles = entries.filter((entry) => entry.endsWith('.d.ts')).sort();
  const declarationTexts = await Promise.all(declarationFiles.map((entry) => readText(path.join('dist', entry))));

  return declarationTexts.join('\n');
}

async function main() {
  const packageJson = JSON.parse(await readText('package.json'));
  const readmeText = await readText('README.md');
  const distDeclarations = await readDistDeclarations();

  const modules = await Promise.all([
    {
      modulePath: 'dist/index.d.ts',
      moduleSpecifier: '@cp949/web-image-util',
      keySymbols: ['processImage', 'ResizeConfig'],
    },
    {
      modulePath: 'dist/presets/index.d.ts',
      moduleSpecifier: '@cp949/web-image-util/presets',
      keySymbols: ['createThumbnail', 'createAvatar', 'createSocialImage'],
    },
    {
      modulePath: 'dist/*.d.ts',
      moduleSpecifier: '@cp949/web-image-util/utils',
      keySymbols: [
        'convertToBlob',
        'detectBrowserCapabilities',
        'enhanceSvgForBrowser',
        'getImageDimensions',
        'getImageInfo',
        'isInlineSvg',
        'sanitizeSvg',
      ],
      sourceText: distDeclarations,
    },
  ].map(async (module) => ({
    ...module,
    sourceText: module.sourceText ?? (await readText(module.modulePath)),
  })));

  const output = renderLlmTxt({
    packageName: packageJson.name,
    readmeText,
    modules,
  });

  await writeFile(path.join(packageRoot, 'llm.txt'), output, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
