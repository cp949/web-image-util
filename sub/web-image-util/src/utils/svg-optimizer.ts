/**
 * SVG 벡터 최적화 알고리즘
 * SVG 렌더링 품질 향상을 위한 전처리 최적화 시스템
 */

import { productionLog } from './debug';

export interface SvgOptimizationOptions {
  /** 메타데이터(주석, 불필요한 속성) 제거 */
  removeMetadata: boolean;
  /** 패스 데이터 단순화 (소수점 자릿수 줄이기, 공백 정리) */
  simplifyPaths: boolean;
  /** 중복 그라데이션 병합 및 최적화 */
  optimizeGradients: boolean;
  /** 유사한 요소 병합 */
  mergeElements: boolean;
  /** 사용하지 않는 정의(defs) 제거 */
  removeUnusedDefs: boolean;
  /** 수치 정밀도 (소수점 자릿수) */
  precision: number;
}

export interface OptimizationResult {
  /** 원본 SVG 크기 (문자열 길이) */
  originalSize: number;
  /** 최적화된 SVG 크기 */
  optimizedSize: number;
  /** 압축률 (0-1) */
  compressionRatio: number;
  /** 적용된 최적화 목록 */
  optimizations: string[];
  /** 처리 시간 (밀리초) */
  processingTimeMs: number;
}

/**
 * SVG 최적화 엔진
 * 벡터 그래픽의 렌더링 품질 향상을 위한 전처리 최적화
 */
export class SvgOptimizer {
  /**
   * 기본 최적화 옵션
   */
  static getDefaultOptions(): SvgOptimizationOptions {
    return {
      removeMetadata: true,
      simplifyPaths: true,
      optimizeGradients: true,
      mergeElements: false, // 안전을 위해 기본값은 false
      removeUnusedDefs: true,
      precision: 3, // 3자리 소수점 유지
    };
  }

  /**
   * SVG 최적화 실행
   * @param svgString 원본 SVG 문자열
   * @param options 최적화 옵션
   * @returns 최적화된 SVG와 결과 정보
   */
  static optimize(
    svgString: string,
    options: SvgOptimizationOptions = this.getDefaultOptions()
  ): { optimizedSvg: string; result: OptimizationResult } {
    const startTime = performance.now();
    const originalSize = svgString.length;
    let optimizedSvg = svgString;
    const optimizations: string[] = [];

    try {
      // 1. 메타데이터 제거
      if (options.removeMetadata) {
        optimizedSvg = this.removeMetadata(optimizedSvg);
        optimizations.push('메타데이터 제거');
      }

      // 2. 패스 단순화
      if (options.simplifyPaths) {
        optimizedSvg = this.simplifyPaths(optimizedSvg, options.precision);
        optimizations.push('패스 단순화');
      }

      // 3. 그라데이션 최적화
      if (options.optimizeGradients) {
        optimizedSvg = this.optimizeGradients(optimizedSvg);
        optimizations.push('그라데이션 최적화');
      }

      // 4. 사용하지 않는 정의 제거
      if (options.removeUnusedDefs) {
        optimizedSvg = this.removeUnusedDefs(optimizedSvg);
        optimizations.push('미사용 정의 제거');
      }

      // 5. 전체 공백 정리
      optimizedSvg = this.cleanupWhitespace(optimizedSvg);
      optimizations.push('공백 정리');

      const optimizedSize = optimizedSvg.length;
      const processingTimeMs = performance.now() - startTime;

      return {
        optimizedSvg,
        result: {
          originalSize,
          optimizedSize,
          compressionRatio: (originalSize - optimizedSize) / originalSize,
          optimizations,
          processingTimeMs,
        },
      };
    } catch (error) {
      // 최적화 실패 시 원본 반환
      productionLog.warn('SVG 최적화 중 오류 발생:', error);
      const processingTimeMs = performance.now() - startTime;

      return {
        optimizedSvg: svgString,
        result: {
          originalSize,
          optimizedSize: originalSize,
          compressionRatio: 0,
          optimizations: ['최적화 실패 - 원본 반환'],
          processingTimeMs,
        },
      };
    }
  }

  /**
   * 메타데이터 제거 (XML 주석, 불필요한 속성)
   */
  private static removeMetadata(svgString: string): string {
    let cleaned = svgString;

    // XML 주석 제거
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // DOCTYPE 선언 제거
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

    // XML 프로세싱 지시문 제거
    cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, '');

    // 불필요한 네임스페이스 속성 제거 (기본 svg, xlink 제외)
    const unnecessaryNamespaces = [
      /xmlns:dc="[^"]*"/g,
      /xmlns:cc="[^"]*"/g,
      /xmlns:rdf="[^"]*"/g,
      /xmlns:svg="[^"]*"/g,
      /xmlns:sodipodi="[^"]*"/g,
      /xmlns:inkscape="[^"]*"/g,
    ];

    unnecessaryNamespaces.forEach((regex) => {
      cleaned = cleaned.replace(regex, '');
    });

    // 메타데이터 요소들 제거
    const metadataElements = [
      /<metadata[\s\S]*?<\/metadata>/gi,
      /<title[\s\S]*?<\/title>/gi,
      /<desc[\s\S]*?<\/desc>/gi,
      /<sodipodi:[^>]*>/gi,
      /<inkscape:[^>]*>/gi,
    ];

    metadataElements.forEach((regex) => {
      cleaned = cleaned.replace(regex, '');
    });

    // 불필요한 속성 제거
    const unnecessaryAttrs = [
      /xml:space="[^"]*"/g,
      /data-[^=]*="[^"]*"/g,
      /id="[^"]*"/g, // ID 속성도 렌더링에 불필요하면 제거
      /style=""/g, // 빈 스타일 속성
      /transform=""/g, // 빈 트랜스폼 속성
    ];

    unnecessaryAttrs.forEach((regex) => {
      cleaned = cleaned.replace(regex, '');
    });

    return cleaned;
  }

  /**
   * 패스 데이터 단순화
   */
  private static simplifyPaths(svgString: string, precision: number): string {
    return svgString.replace(/d="([^"]+)"/g, (match, pathData) => {
      // 패스 데이터 단순화
      let simplified = pathData;

      // 소수점 자릿수 제한
      const precisionRegex = new RegExp(`(\\d+\\.\\d{${precision + 1},})`, 'g');
      simplified = simplified.replace(precisionRegex, (numMatch: string) => {
        return parseFloat(numMatch).toFixed(precision);
      });

      // 불필요한 소수점 0 제거 (1.000 → 1)
      simplified = simplified.replace(/\.0+\b/g, '');

      // 연속 공백을 단일 공백으로 변경
      simplified = simplified.replace(/\s+/g, ' ');

      // 숫자 사이에 쉼표 추가 (공백을 쉼표로 변경)
      simplified = simplified.replace(/(\d)\s+(\d)/g, '$1,$2');

      // 명령어 뒤의 공백 제거 (더 강력한 패턴)
      simplified = simplified.replace(/([MmLlHhVvCcSsQqTtAaZz])\s+/g, '$1');

      // 명령어 앞의 공백도 제거
      simplified = simplified.replace(/\s+([MmLlHhVvCcSsQqTtAaZz])/g, '$1');

      // 쉼표 주변 공백 정리
      simplified = simplified.replace(/\s*,\s*/g, ',');

      // 시작과 끝 공백 제거
      simplified = simplified.trim();

      return `d="${simplified}"`;
    });
  }

  /**
   * 그라데이션 최적화 (중복 제거 및 병합)
   */
  private static optimizeGradients(svgString: string): string {
    try {
      // Node.js 환경에서 DOMParser 사용 가능 여부 확인
      if (typeof DOMParser === 'undefined') {
        productionLog.warn('DOMParser가 사용할 수 없는 환경입니다. 그라데이션 최적화를 건너뜁니다.');
        return svgString;
      }

      // DOM 파서를 사용해 SVG 파싱
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');

      // 파싱 에러 체크
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        return svgString; // 파싱 실패 시 원본 반환
      }

      const gradients = doc.querySelectorAll('linearGradient, radialGradient');
      const gradientMap = new Map<string, Element>();
      const replacementMap = new Map<string, string>();

      // 중복 그라데이션 감지 및 매핑
      gradients.forEach((gradient) => {
        const hash = this.hashGradient(gradient);
        const currentId = gradient.getAttribute('id');

        if (!currentId) return;

        if (!gradientMap.has(hash)) {
          gradientMap.set(hash, gradient);
        } else {
          // 중복 그라데이션 발견
          const originalGradient = gradientMap.get(hash)!;
          const originalId = originalGradient.getAttribute('id');

          if (originalId) {
            replacementMap.set(currentId, originalId);
            gradient.remove(); // 중복 제거
          }
        }
      });

      // 참조 업데이트
      replacementMap.forEach((newId, oldId) => {
        const elements = doc.querySelectorAll(`[fill="url(#${oldId})"], [stroke="url(#${oldId})"]`);
        elements.forEach((element) => {
          if (element.getAttribute('fill') === `url(#${oldId})`) {
            element.setAttribute('fill', `url(#${newId})`);
          }
          if (element.getAttribute('stroke') === `url(#${oldId})`) {
            element.setAttribute('stroke', `url(#${newId})`);
          }
        });
      });

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      productionLog.warn('그라데이션 최적화 실패:', error);
      return svgString; // 실패 시 원본 반환
    }
  }

  /**
   * 그라데이션 해시 생성 (중복 감지용)
   */
  private static hashGradient(gradient: Element): string {
    const type = gradient.tagName;
    const stops = Array.from(gradient.querySelectorAll('stop'))
      .map((stop) => {
        const offset = stop.getAttribute('offset') || '0';
        const color = stop.getAttribute('stop-color') || '#000000';
        const opacity = stop.getAttribute('stop-opacity') || '1';
        return `${offset}:${color}:${opacity}`;
      })
      .join(',');

    // 그라데이션 특성 (방향, 크기 등)
    const attrs = ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy']
      .map((attr) => gradient.getAttribute(attr) || '')
      .filter((val) => val !== '')
      .join(',');

    return `${type}:${attrs}:${stops}`;
  }

  /**
   * 사용하지 않는 정의(defs) 제거
   */
  private static removeUnusedDefs(svgString: string): string {
    try {
      // Node.js 환경에서 DOMParser 사용 가능 여부 확인
      if (typeof DOMParser === 'undefined') {
        productionLog.warn('DOMParser가 사용할 수 없는 환경입니다. 미사용 정의 제거를 건너뜁니다.');
        return svgString;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');

      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        return svgString;
      }

      const defs = doc.querySelector('defs');
      if (!defs) {
        return svgString;
      }

      // defs 내의 모든 요소 ID 수집
      const definedIds = new Set<string>();
      defs.querySelectorAll('[id]').forEach((element) => {
        const id = element.getAttribute('id');
        if (id) definedIds.add(id);
      });

      // 사용되는 ID 찾기
      const usedIds = new Set<string>();
      const svgContent = doc.documentElement;

      definedIds.forEach((id) => {
        const references = svgContent.querySelectorAll(
          `[fill="url(#${id})"], [stroke="url(#${id})"], [filter="url(#${id})"], ` +
            `[clip-path="url(#${id})"], [mask="url(#${id})"], [marker-start="url(#${id})"], ` +
            `[marker-mid="url(#${id})"], [marker-end="url(#${id})"], [href="#${id}"]`
        );

        if (references.length > 0) {
          usedIds.add(id);
        }
      });

      // 사용하지 않는 정의 제거
      definedIds.forEach((id) => {
        if (!usedIds.has(id)) {
          const unusedElement = defs.querySelector(`[id="${id}"]`);
          if (unusedElement) {
            unusedElement.remove();
          }
        }
      });

      // defs가 비었으면 defs 자체도 제거
      if (defs.children.length === 0) {
        defs.remove();
      }

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      productionLog.warn('미사용 정의 제거 실패:', error);
      return svgString;
    }
  }

  /**
   * 전체 공백 정리
   */
  private static cleanupWhitespace(svgString: string): string {
    return (
      svgString
        // 태그 사이의 불필요한 공백 제거
        .replace(/>\s+</g, '><')
        // 연속된 공백을 하나로 통합 (속성값 내부 제외)
        .replace(/(\s)\s+/g, '$1')
        // 속성 주변 공백 정리 (등호 주변)
        .replace(/\s*=\s*/g, '=')
        // 속성 간 공백 정리
        .replace(/"\s+([a-zA-Z-])/g, '" $1')
        // 시작과 끝 공백 제거
        .trim()
    );
  }
}
