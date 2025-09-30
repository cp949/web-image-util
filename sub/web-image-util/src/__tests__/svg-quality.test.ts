/**
 * SVG 품질 시스템 단위 테스트
 * Phase 2에서 구현된 SVG 복잡도 분석 및 품질 처리 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeSvgComplexity } from '../core/svg-complexity-analyzer';
import { SVGProcessor } from '../advanced/svg-processor';
import { processImage } from '../processor';

describe('SVG Complexity Analyzer', () => {
  describe('기본 복잡도 분석', () => {
    it('단순한 SVG를 올바르게 분석해야 함', () => {
      const simpleSvg = '<svg width="100" height="100"><rect width="50" height="50" fill="red"/></svg>';
      const result = analyzeSvgComplexity(simpleSvg);

      expect(result.complexityScore).toBeLessThan(0.3);
      expect(result.recommendedQuality).toBe('low');
      expect(result.metrics.pathCount).toBe(0);
      expect(result.metrics.gradientCount).toBe(0);
      expect(result.metrics.filterCount).toBe(0);
    });

    it('복잡한 SVG 특성을 감지해야 함', () => {
      const complexSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
            </linearGradient>
            <filter id="blur1">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
            </filter>
            <clipPath id="clip1">
              <circle cx="50" cy="50" r="40"/>
            </clipPath>
          </defs>
          <path d="M10,30 A20,20 0,0,1 50,30 A20,20 0,0,1 90,30 Q90,60 50,90 Q10,60 10,30 z" fill="url(#grad1)" filter="url(#blur1)"/>
          <circle cx="150" cy="50" r="25" clip-path="url(#clip1)"/>
          <text x="50" y="150" font-family="Arial" font-size="16">Sample Text</text>
        </svg>
      `;
      const result = analyzeSvgComplexity(complexSvg);

      expect(result.complexityScore).toBeGreaterThan(0.5);
      expect(result.recommendedQuality).toBeOneOf(['high', 'ultra']);
      expect(result.metrics.pathCount).toBeGreaterThan(0);
      expect(result.metrics.gradientCount).toBeGreaterThan(0);
      expect(result.metrics.filterCount).toBeGreaterThan(0);
      expect(result.metrics.hasClipPath).toBe(true);
      expect(result.metrics.textElementCount).toBeGreaterThan(0);
    });

    it('대용량 SVG를 올바르게 분류해야 함', () => {
      // 큰 SVG 문자열 생성 (50KB 이상)
      const largeSvgContent = '<rect width="10" height="10" fill="blue"/>'.repeat(2000);
      const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">${largeSvgContent}</svg>`;

      const result = analyzeSvgComplexity(largeSvg);

      expect(result.metrics.fileSize).toBeGreaterThan(50000);
      expect(result.recommendedQuality).toBe('ultra');
      expect(result.reasoning).toContain(expect.stringMatching(/대용량 파일/));
    });

    it('잘못된 SVG 입력에 대해 안전하게 처리해야 함', () => {
      const invalidSvg = '<svg><invalidtag></svg>';
      const result = analyzeSvgComplexity(invalidSvg);

      // 에러가 발생해도 기본값 반환
      expect(result).toBeDefined();
      expect(result.recommendedQuality).toBeOneOf(['low', 'medium', 'high', 'ultra']);
      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('품질 레벨 결정 로직', () => {
    it('애니메이션이 있는 SVG에 적절한 품질을 권장해야 함', () => {
      const animatedSvg = `
        <svg width="100" height="100">
          <circle cx="50" cy="50" r="40" fill="blue">
            <animate attributeName="r" values="40;20;40" dur="2s" repeatCount="indefinite"/>
          </circle>
        </svg>
      `;
      const result = analyzeSvgComplexity(animatedSvg);

      expect(result.metrics.animationCount).toBeGreaterThan(0);
      expect(result.reasoning).toContain(expect.stringMatching(/애니메이션/));
    });

    it('텍스트가 많은 SVG에 고품질을 권장해야 함', () => {
      const textHeavySvg = `
        <svg width="400" height="300">
          <text x="10" y="30">제목 텍스트</text>
          <text x="10" y="60">부제목 텍스트</text>
          <text x="10" y="90">본문 내용 1</text>
          <text x="10" y="120">본문 내용 2</text>
          <text x="10" y="150">본문 내용 3</text>
          <text x="10" y="180">본문 내용 4</text>
        </svg>
      `;
      const result = analyzeSvgComplexity(textHeavySvg);

      expect(result.metrics.textElementCount).toBeGreaterThan(5);
      expect(result.recommendedQuality).toBeOneOf(['high', 'ultra']);
    });
  });
});

describe('SVG Processor', () => {
  const simpleSvg = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';

  describe('기본 처리 기능', () => {
    it('자동 품질로 SVG를 처리할 수 있어야 함', async () => {
      const result = await SVGProcessor.processWithQuality(simpleSvg, {
        quality: 'auto',
        format: 'png',
        targetWidth: 200,
        targetHeight: 200
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.actualQuality).toBeOneOf(['low', 'medium', 'high', 'ultra']);
      expect(result.scaleFactor).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.memorySizeMB).toBeGreaterThan(0);
    });

    it('명시적 품질 설정이 동작해야 함', async () => {
      const result = await SVGProcessor.processWithQuality(simpleSvg, {
        quality: 'high',
        format: 'jpeg',
        targetWidth: 300,
        targetHeight: 300,
        jpegQuality: 0.9
      });

      expect(result.actualQuality).toBe('high');
      expect(result.scaleFactor).toBe(3); // high = 3x
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('다양한 출력 포맷을 지원해야 함', async () => {
      const formats: Array<'png' | 'jpeg' | 'webp'> = ['png', 'jpeg', 'webp'];

      for (const format of formats) {
        const result = await SVGProcessor.processWithQuality(simpleSvg, {
          quality: 'medium',
          format,
          targetWidth: 150,
          targetHeight: 150
        });

        expect(result.blob.type).toBe(`image/${format}`);
      }
    });
  });

  describe('고급 옵션', () => {
    it('배경색 설정이 동작해야 함', async () => {
      const result = await SVGProcessor.processWithQuality(simpleSvg, {
        quality: 'medium',
        format: 'jpeg',
        targetWidth: 200,
        targetHeight: 200,
        backgroundColor: '#ffffff',
        preserveTransparency: false
      });

      expect(result.blob.type).toBe('image/jpeg');
      // JPEG는 투명도를 지원하지 않으므로 배경색이 적용되어야 함
    });

    it('투명도 보존 설정이 동작해야 함', async () => {
      const result = await SVGProcessor.processWithQuality(simpleSvg, {
        quality: 'medium',
        format: 'png',
        targetWidth: 200,
        targetHeight: 200,
        preserveTransparency: true
      });

      expect(result.blob.type).toBe('image/png');
    });
  });

  describe('에러 처리', () => {
    it('잘못된 SVG 입력에 대해 적절한 에러를 던져야 함', async () => {
      await expect(
        SVGProcessor.processWithQuality('invalid svg', {
          quality: 'medium',
          format: 'png',
          targetWidth: 200,
          targetHeight: 200
        })
      ).rejects.toThrow();
    });

    it('옵션 검증이 동작해야 함', () => {
      expect(() => {
        SVGProcessor.validateOptions({
          quality: 'medium',
          format: 'png',
          targetWidth: 0, // 잘못된 값
          targetHeight: 200
        });
      }).toThrow('목표 크기는 0보다 커야 합니다');

      expect(() => {
        SVGProcessor.validateOptions({
          quality: 'medium',
          format: 'jpeg',
          targetWidth: 200,
          targetHeight: 200,
          jpegQuality: 1.5 // 잘못된 값
        });
      }).toThrow('JPEG 품질은 0.1~1.0 범위여야 합니다');
    });
  });
});

describe('ImageProcessor SVG 통합', () => {
  const simpleSvg = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>';

  describe('새로운 API 메서드', () => {
    it('.quality() 메서드가 체이닝되어야 함', () => {
      const processor = processImage(simpleSvg);
      const result = processor.quality('high');

      expect(result).toBe(processor); // 체이닝 확인
    });

    it('.svgOptions() 메서드가 체이닝되어야 함', () => {
      const processor = processImage(simpleSvg);
      const result = processor.svgOptions({
        backgroundColor: '#ffffff',
        jpegQuality: 0.9
      });

      expect(result).toBe(processor); // 체이닝 확인
    });

    it('체이닝된 API가 SVG 처리에 적용되어야 함', async () => {
      const result = await processImage(simpleSvg)
        .quality('ultra')
        .resize(400, 400)
        .svgOptions({ backgroundColor: '#f0f0f0' })
        .toBlob({ format: 'jpeg' });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });
  });

  describe('SVG 소스 감지', () => {
    it('SVG XML 문자열을 감지해야 함', async () => {
      const result = await processImage(simpleSvg)
        .resize(200, 200)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('SVG Data URL을 감지해야 함', async () => {
      const base64Svg = btoa(unescape(encodeURIComponent(simpleSvg)));
      const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

      const result = await processImage(dataUrl)
        .resize(150, 150)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);
    });
  });

  describe('호환성 검증', () => {
    it('기존 이미지 처리 API가 여전히 동작해야 함', async () => {
      // SVG가 아닌 소스는 기존 방식으로 처리
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const result = await processImage(canvas)
        .resize(200, 200)
        .blur(2)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });
  });
});

describe('성능 및 메모리 테스트', () => {
  it('메모리 사용량 추정이 합리적이어야 함', () => {
    const memoryMB = SVGProcessor['estimateMemoryUsage'](1000, 1000);

    // 1000x1000 이미지는 대략 4MB (RGBA) + 오버헤드
    expect(memoryMB).toBeGreaterThan(4);
    expect(memoryMB).toBeLessThan(10);
  });

  it('안전한 스케일링 팩터 계산이 동작해야 함', () => {
    const maxScale = SVGProcessor.getMaxSafeScaleFactor(1000, 1000);

    expect(maxScale).toBeGreaterThan(0);
    expect(maxScale).toBeLessThanOrEqual(4);
  });

  it('처리 시간이 측정되어야 함', async () => {
    const simpleSvg = '<svg width="50" height="50"><rect width="25" height="25" fill="green"/></svg>';

    const result = await SVGProcessor.processWithQuality(simpleSvg, {
      quality: 'low',
      format: 'png',
      targetWidth: 100,
      targetHeight: 100
    });

    expect(result.processingTimeMs).toBeGreaterThan(0);
    expect(result.processingTimeMs).toBeLessThan(5000); // 5초 이내
  });
});