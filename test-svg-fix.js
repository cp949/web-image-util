import { processImage } from './sub/web-image-util/dist/index.js';
import fs from 'fs';

async function testSvgFitModes() {
    console.log('🧪 SVG Cover/Contain Fix 테스트 시작');

    // Sample SVG 파일 읽기 (91x114)
    const svgPath = './apps/exam/public/sample-images/sample1.svg';
    const svgContent = fs.readFileSync(svgPath, 'utf-8');

    console.log(`📄 SVG 내용 (첫 100자): ${svgContent.substring(0, 100)}...`);

    try {
        // Cover 모드 테스트 (300x200)
        console.log('\n🔸 Cover 모드 테스트 (300x200, 잘림 예상)');
        const coverResult = await processImage(svgContent)
            .resize(300, 200, { fit: 'cover' })
            .toDataURL();

        console.log(`✅ Cover 결과: ${coverResult.substring(0, 50)}...`);
        console.log(`   길이: ${coverResult.length}자`);

        // Contain 모드 테스트 (300x200)
        console.log('\n🔹 Contain 모드 테스트 (300x200, 패딩 예상)');
        const containResult = await processImage(svgContent)
            .resize(300, 200, { fit: 'contain' })
            .toDataURL();

        console.log(`✅ Contain 결과: ${containResult.substring(0, 50)}...`);
        console.log(`   길이: ${containResult.length}자`);

        // 결과 비교
        console.log('\n🔍 결과 비교:');
        console.log(`Cover와 Contain이 ${coverResult === containResult ? '동일함 ❌' : '다름 ✅'}`);

        if (coverResult !== containResult) {
            console.log('🎉 수정 성공! SVG Cover/Contain이 이제 다르게 동작합니다.');
        } else {
            console.log('⚠️  여전히 동일한 결과입니다. 추가 디버깅이 필요합니다.');
        }

    } catch (error) {
        console.error('❌ 테스트 실패:', error.message);
        console.error(error.stack);
    }
}

testSvgFitModes();