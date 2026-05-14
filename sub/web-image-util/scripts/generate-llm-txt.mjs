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
  const declarationFiles = [];

  async function collectDeclarationFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await collectDeclarationFiles(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.d.ts')) {
        declarationFiles.push(path.relative(packageRoot, fullPath));
      }
    }
  }

  await collectDeclarationFiles(distDir);
  declarationFiles.sort();

  const declarationTexts = await Promise.all(declarationFiles.map((entry) => readText(entry)));

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
      keySymbols: ['processImage', 'unsafe_processImage', 'ProcessorOptions', 'SvgSanitizerMode', 'ResizeConfig'],
      sourceText: distDeclarations,
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
        'blobToDataURL',
        'dataURLToBlob',
        'decodeSvgDataURL',
        'detectBrowserCapabilities',
        'detectImageSourceInfo',
        'detectImageSourceType',
        'detectImageStringSourceInfo',
        'detectImageStringSourceType',
        'enhanceBrowserCompatibility',
        'enhanceSvgForBrowser',
        'ensureBlob',
        'ensureBlobDetailed',
        'ensureDataURL',
        'ensureDataURLDetailed',
        'ensureFile',
        'ensureFileDetailed',
        'ensureImageElement',
        'ensureImageElementDetailed',
        'estimateDataURLPayloadByteLength',
        'estimateDataURLSize',
        'fetchImageFormat',
        'fetchImageSourceBlob',
        'formatToMimeType',
        'getImageAspectRatio',
        'getImageDimensions',
        'getImageFormat',
        'getImageInfo',
        'getImageOrientation',
        'getOutputFilename',
        'hasTransparency',
        'isDataURLString',
        'isInlineSvg',
        'isSupportedOutputFormat',
        'mimeTypeToImageFormat',
        'mimeTypeToOutputFormat',
        'replaceImageExtension',
        'resolveOutputFormat',
        'sanitizeSvg',
        'sanitizeSvgForRendering',
        'SvgOptimizer',
      ],
      sourceText: distDeclarations,
    },
    {
      modulePath: 'dist/svg-sanitizer/index.d.ts',
      moduleSpecifier: '@cp949/web-image-util/svg-sanitizer',
      keySymbols: ['sanitizeSvgStrict', 'sanitizeSvgStrictDetailed'],
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
