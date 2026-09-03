import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findAllowedViolations } from './browser-compat-checker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const srcDir = path.join(packageRoot, 'src');
  const allowlistPath = path.join(packageRoot, 'browser-compat-allowlist.json');

  const [filePaths, allowlistText] = await Promise.all([collectSourceFiles(srcDir), readFile(allowlistPath, 'utf8')]);
  const allowlist = JSON.parse(allowlistText);

  const sources = await Promise.all(
    filePaths.map(async (filePath) => ({
      filePath: path.relative(packageRoot, filePath).split(path.sep).join('/'),
      sourceText: await readFile(filePath, 'utf8'),
    }))
  );

  const violations = findAllowedViolations(sources, allowlist);

  if (violations.length === 0) {
    console.log('[check-browser-compat] Chrome 75 미지원 런타임 API 위반 없음.');
    return;
  }

  console.error('[check-browser-compat] Chrome 75 미만에서 지원하지 않는 API 사용을 발견했습니다:');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  ${violation.api} (Chrome ${violation.minChrome}+)`);
  }
  console.error(
    '\ntypeof 가드 또는 ponyfill로 대응한 뒤 browser-compat-allowlist.json에 { file, api, reason }을 등록하세요.'
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
