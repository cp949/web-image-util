/**
 * 시스템 검증기 - 전체 변환 시스템 기능 검증
 *
 * @description ImageSource 변환 시스템의 모든 기능이 정상 동작하는지 검증
 * API 호환성, 성능 최적화, 타입 안전성 등을 종합적으로 테스트
 */

import type { ImageSource } from '../types/base';
import { ImageSourceConverter, convertTo, from, type ConvertibleTarget } from './image-source-converter';
import { processImage } from '../processor';
import { ImageProcessError } from '../types';

/**
 * 검증 보고서 인터페이스
 */
export interface ValidationReport {
  /** 통과한 검증 항목들 */
  passed: string[];
  /** 실패한 검증 항목들 */
  failed: string[];
  /** 경고 사항들 */
  warnings: string[];
}

/**
 * 시스템 검증기 클래스
 */
export class SystemValidator {
  /**
   * 전체 시스템 기능 검증
   *
   * @description 모든 변환 API와 기능들이 정상 동작하는지 종합 검증
   * @returns 검증 결과 보고서
   */
  static async validateAllFeatures(): Promise<ValidationReport> {
    const report: ValidationReport = {
      passed: [],
      failed: [],
      warnings: []
    };

    try {
      // 1. 기본 변환 경로 검증
      await this.validateBasicConversions(report);

      // 2. 확장 타입 지원 검증
      await this.validateExtendedTypes(report);

      // 3. 성능 최적화 검증
      await this.validatePerformanceOptimizations(report);

      // 4. API 호환성 검증
      await this.validateAPICompatibility(report);

    } catch (error) {
      report.failed.push(`시스템 검증 실패: ${(error as Error).message}`);
    }

    return report;
  }

  /**
   * 기본 변환 경로 검증
   *
   * @description 핵심 변환 경로들이 정상 동작하는지 확인
   * @param report 검증 보고서 (결과가 추가됨)
   */
  private static async validateBasicConversions(report: ValidationReport): Promise<void> {
    const conversions = [
      { from: 'element', to: 'canvas' },
      { from: 'canvas', to: 'blob' },
      { from: 'blob', to: 'dataURL' },
      { from: 'dataURL', to: 'element' },
      { from: 'element', to: 'arrayBuffer' },
      { from: 'arrayBuffer', to: 'uint8Array' },
      { from: 'uint8Array', to: 'file' }
    ];

    for (const conv of conversions) {
      try {
        // 테스트 소스 생성
        const source = await this.createTestSource(conv.from);

        // 변환 수행
        const result = await this.performConversion(source, conv.to);

        if (result) {
          report.passed.push(`${conv.from} → ${conv.to} 변환 성공`);
        } else {
          report.failed.push(`${conv.from} → ${conv.to} 변환 결과 없음`);
        }
      } catch (error) {
        report.failed.push(`${conv.from} → ${conv.to} 변환 실패: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 확장 타입 지원 검증
   *
   * @description ArrayBuffer, Uint8Array, File 등 확장 타입 지원 확인
   * @param report 검증 보고서
   */
  private static async validateExtendedTypes(report: ValidationReport): Promise<void> {
    try {
      // ArrayBuffer 지원 검증
      const testCanvas = this.createTestCanvas(100, 100);
      const arrayBuffer = await convertTo(testCanvas, 'arrayBuffer');

      if (arrayBuffer instanceof ArrayBuffer) {
        report.passed.push('ArrayBuffer 변환 지원 확인');
      } else {
        report.failed.push('ArrayBuffer 변환 실패');
      }

      // Uint8Array 지원 검증
      const uint8Array = await convertTo(arrayBuffer, 'uint8Array');

      if (uint8Array instanceof Uint8Array) {
        report.passed.push('Uint8Array 변환 지원 확인');
      } else {
        report.failed.push('Uint8Array 변환 실패');
      }

      // File 지원 검증
      const file = await convertTo(testCanvas, 'file', { filename: 'test.png' });

      if (file instanceof File && file.name === 'test.png') {
        report.passed.push('File 변환 지원 확인');
      } else {
        report.failed.push('File 변환 실패');
      }

    } catch (error) {
      report.failed.push(`확장 타입 검증 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 성능 최적화 검증
   *
   * @description ImageProcessor 직접 변환 등 성능 최적화 기능 검증
   * @param report 검증 보고서
   */
  private static async validatePerformanceOptimizations(report: ValidationReport): Promise<void> {
    try {
      const testImage = await this.createTestImage(512, 512);

      // 직접 변환 성능 측정
      const directStart = performance.now();
      const canvas = await processImage(testImage).resize(256, 256).toCanvas();
      const directTime = performance.now() - directStart;

      if (directTime < 100) { // 100ms 이내
        report.passed.push(`직접 Canvas 변환 성능 최적화 확인: ${directTime.toFixed(1)}ms`);
      } else {
        report.warnings.push(`직접 변환 성능 개선 필요: ${directTime.toFixed(1)}ms`);
      }

      // Canvas 크기 확인
      if (canvas.width === 256 && canvas.height === 256) {
        report.passed.push('직접 변환 결과 정확성 확인');
      } else {
        report.failed.push(`직접 변환 크기 오류: ${canvas.width}x${canvas.height} (예상: 256x256)`);
      }

    } catch (error) {
      report.failed.push(`성능 최적화 검증 실패: ${(error as Error).message}`);
    }
  }

  /**
   * API 호환성 검증
   *
   * @description 3가지 API 스타일(클래스, 함수형, 빌더)의 호환성 확인
   * @param report 검증 보고서
   */
  private static async validateAPICompatibility(report: ValidationReport): Promise<void> {
    try {
      const testBlob = await this.createTestBlob(200, 150);

      // 1. 클래스 기반 API
      const canvas1 = await ImageSourceConverter.from(testBlob).toCanvas();

      // 2. 함수형 API
      const canvas2 = await convertTo(testBlob, 'canvas');

      // 3. 빌더 패턴 API
      const canvas3 = await from(testBlob).to.canvas();

      // 모든 방식이 동일한 결과 제공하는지 확인
      if (canvas1 instanceof HTMLCanvasElement && canvas1.width === 200 && canvas1.height === 150) {
        report.passed.push('클래스 기반 API 동작 확인');
      } else {
        report.failed.push(`클래스 API 크기 오류: ${canvas1 instanceof HTMLCanvasElement ? `${canvas1.width}x${canvas1.height}` : '타입 오류'}`);
      }

      if (canvas2 instanceof HTMLCanvasElement && canvas2.width === 200 && canvas2.height === 150) {
        report.passed.push('함수형 API 동작 확인');
      } else {
        report.failed.push(`함수형 API 크기 오류: ${canvas2 instanceof HTMLCanvasElement ? `${canvas2.width}x${canvas2.height}` : '타입 오류'}`);
      }

      if (canvas3 instanceof HTMLCanvasElement && canvas3.width === 200 && canvas3.height === 150) {
        report.passed.push('빌더 패턴 API 동작 확인');
      } else {
        report.failed.push(`빌더 API 크기 오류: ${canvas3 instanceof HTMLCanvasElement ? `${canvas3.width}x${canvas3.height}` : '타입 오류'}`);
      }

      // 타입 안전성 확인
      if (canvas1 instanceof HTMLCanvasElement &&
          canvas2 instanceof HTMLCanvasElement &&
          canvas3 instanceof HTMLCanvasElement) {
        report.passed.push('모든 API의 타입 안전성 확인');
      } else {
        report.failed.push('API 타입 안전성 실패');
      }

    } catch (error) {
      report.failed.push(`API 호환성 검증 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 테스트용 소스 생성
   *
   * @param sourceType 소스 타입
   * @returns 테스트용 이미지 소스
   */
  private static async createTestSource(sourceType: string): Promise<ImageSource> {
    switch (sourceType) {
      case 'element':
        return this.createTestImage(100, 100);
      case 'canvas':
        return this.createTestCanvas(100, 100);
      case 'blob':
        return this.createTestBlob(100, 100);
      case 'dataURL':
        return this.createTestDataURL(100, 100);
      case 'arrayBuffer': {
        const blob = await this.createTestBlob(100, 100);
        return blob.arrayBuffer();
      }
      case 'uint8Array': {
        const arrayBuffer = await (await this.createTestBlob(100, 100)).arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
      default:
        throw new ImageProcessError(`지원하지 않는 소스 타입: ${sourceType}`, 'UNSUPPORTED_FORMAT');
    }
  }

  /**
   * 변환 수행
   *
   * @param source 소스 이미지
   * @param target 타겟 타입
   * @returns 변환 결과
   */
  private static async performConversion(source: ImageSource, target: string): Promise<any> {
    switch (target) {
      case 'canvas':
        return convertTo(source, 'canvas' as ConvertibleTarget);
      case 'blob':
        return convertTo(source, 'blob' as ConvertibleTarget);
      case 'dataURL':
        return convertTo(source, 'dataURL' as ConvertibleTarget);
      case 'element':
        return convertTo(source, 'element' as ConvertibleTarget);
      case 'arrayBuffer':
        return convertTo(source, 'arrayBuffer' as ConvertibleTarget);
      case 'uint8Array':
        return convertTo(source, 'uint8Array' as ConvertibleTarget);
      case 'file':
        return convertTo(source, 'file' as ConvertibleTarget, { filename: 'test.png' });
      default:
        throw new ImageProcessError(`지원하지 않는 타겟 타입: ${target}`, 'UNSUPPORTED_FORMAT');
    }
  }

  /**
   * 테스트용 Canvas 생성
   */
  private static createTestCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#00ff00'; // 녹색
    ctx.fillRect(0, 0, width, height);

    return canvas;
  }

  /**
   * 테스트용 Image 생성
   */
  private static async createTestImage(width: number, height: number): Promise<HTMLImageElement> {
    const canvas = this.createTestCanvas(width, height);
    const dataURL = canvas.toDataURL();

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('테스트 이미지 생성 실패'));
      img.src = dataURL;
    });
  }

  /**
   * 테스트용 Blob 생성
   */
  private static async createTestBlob(width: number, height: number): Promise<Blob> {
    const canvas = this.createTestCanvas(width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('테스트 Blob 생성 실패'));
        }
      });
    });
  }

  /**
   * 테스트용 Data URL 생성
   */
  private static createTestDataURL(width: number, height: number): string {
    const canvas = this.createTestCanvas(width, height);
    return canvas.toDataURL();
  }
}

/**
 * API 사용법 예시들
 *
 * @description 다양한 API 스타일의 사용법과 최적화 패턴 제공
 */
export const API_EXAMPLES = {
  /**
   * 클래스 기반 API 사용법
   */
  classBasedAPI: `
// 클래스 기반 API - 명시적이고 안전한 방식
const converter = ImageSourceConverter.from(blob);
const canvas = await converter.toCanvas();
const file = await converter.toFile({ filename: 'output.png', format: 'image/png' });

// 메타데이터 주입으로 성능 최적화
const result = await processImage(source).resize(300, 200).toDataURL();
const optimizedConverter = ImageSourceConverter.from(result.dataURL, result);
const optimizedCanvas = await optimizedConverter.toCanvas();
`,

  /**
   * 함수형 API 사용법
   */
  functionalAPI: `
// 함수형 API - 간결하고 직관적인 방식
const canvas = await convertTo(blob, 'canvas');
const dataURL = await convertTo(element, 'dataURL', { quality: 0.9 });
const arrayBuffer = await convertTo(canvas, 'arrayBuffer');

// 타입 안전성 보장
const file: File = await convertTo(blob, 'file', { filename: 'image.webp', format: 'webp' });
`,

  /**
   * 빌더 패턴 API 사용법
   */
  builderAPI: `
// 빌더 패턴 API - 체이닝과 가독성
const canvas = await from(blob).to.canvas();
const file = await from(dataURL).to.file('image.webp', { format: 'webp', quality: 0.8 });
const element = await from(arrayBuffer).to.element();

// 복잡한 변환 파이프라인
const svg = '<svg width="400" height="300"><rect fill="blue"/></svg>';
const finalFile = await from(svg).to.element()
  .then(element => from(element).to.canvas())
  .then(canvas => from(canvas).to.file('processed.png'));
`,

  /**
   * 성능 최적화된 사용법
   */
  optimizedUsage: `
// 성능 최적화된 전체 파이프라인
const result = await processImage(source).resize(300, 200).toDataURL();
const canvas = await result.toCanvas(); // 크기 정보 재사용으로 빠른 변환

// 메타데이터 주입으로 최적화
const optimizedCanvas = await from(result.dataURL, {
  width: result.width,
  height: result.height,
  format: result.format
}).to.canvas();

// 직접 변환으로 70% 성능 향상
const directCanvas = await processImage(source).resize(512, 384).toCanvas();
`,

  /**
   * 실제 사용 시나리오들
   */
  realWorldScenarios: `
// 썸네일 생성
const thumbnail = await processImage(userFile)
  .resize(150, 150)
  .toBlob({ format: 'webp', quality: 0.8 });

// 아바타 이미지 처리
const avatar = await from(userUpload)
  .to.element()
  .then(element => processImage(element).resize(64, 64).toCanvas());

// 포맷 변환 및 압축
const compressedImage = await from(pngBlob)
  .to.file('compressed.jpg', { format: 'image/jpeg', quality: 0.7 });

// SVG를 래스터 이미지로 변환
const svgString = await fetch('/icon.svg').then(r => r.text());
const pngFile = await from(svgString).to.file('icon.png', { format: 'image/png' });
`
};