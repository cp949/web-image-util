#!/usr/bin/env node

// SVG 판정 로직 테스트 스크립트
import { detectSourceType } from './sub/web-image-util/dist/index.js';

console.log('🧪 SVG 판정 로직 테스트 시작...\n');

const testCases = [
  // ✅ 정상적인 SVG 케이스들
  {
    input: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
    expected: 'svg',
    description: '기본 SVG 마크업'
  },
  {
    input: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',
    expected: 'svg',
    description: 'XML 선언이 있는 SVG'
  },
  {
    input: '<!-- comment -->\n<?xml version="1.0"?>\n<!-- another comment -->\n<svg><circle cx="50" cy="50" r="40"/></svg>',
    expected: 'svg',
    description: '주석과 XML 선언이 있는 SVG'
  },
  {
    input: '\uFEFF<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M10,10 L20,20"/></svg>',
    expected: 'svg',
    description: 'BOM이 있는 SVG'
  },
  {
    input: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIi8+PC9zdmc+',
    expected: 'svg',
    description: 'Base64 인코딩된 SVG Data URL'
  },
  {
    input: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="50" cy="50" r="40"/%3E%3C/svg%3E',
    expected: 'svg',
    description: 'URL 인코딩된 SVG Data URL'
  },
  {
    input: 'https://example.com/image.svg',
    expected: 'svg',
    description: 'SVG 확장자 URL'
  },
  {
    input: '/path/to/image.svg',
    expected: 'svg',
    description: 'SVG 확장자 로컬 경로'
  },

  // ❌ SVG가 아닌 케이스들 (이전에 오판정되던 것들)
  {
    input: '<html><body><svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg></body></html>',
    expected: 'path', // HTML 문서는 SVG로 판정되지 않아야 함
    description: 'HTML 내 SVG (오판정 방지)'
  },
  {
    input: '<?xml version="1.0"?><root><data>some xml content</data></root>',
    expected: 'path', // 일반 XML은 SVG로 판정되지 않아야 함
    description: '일반 XML (오판정 방지)'
  },
  {
    input: 'This text contains <svg> but is not svg',
    expected: 'path', // 텍스트 내 <svg>는 SVG로 판정되지 않아야 함
    description: '텍스트 내 <svg> 문자열 (오판정 방지)'
  },
  {
    input: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    expected: 'dataurl',
    description: 'PNG Data URL'
  },
  {
    input: 'https://example.com/image.png',
    expected: 'url',
    description: 'PNG 확장자 URL'
  }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  try {
    const result = detectSourceType(testCase.input);
    if (result === testCase.expected) {
      console.log(`✅ ${testCase.description}: ${result}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.description}: 예상=${testCase.expected}, 실제=${result}`);
      failed++;
    }
  } catch (error) {
    console.log(`💥 ${testCase.description}: 오류 - ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 테스트 결과: ${passed}개 성공, ${failed}개 실패`);

if (failed === 0) {
  console.log('🎉 모든 테스트 통과!');
  process.exit(0);
} else {
  console.log('🚨 일부 테스트 실패');
  process.exit(1);
}