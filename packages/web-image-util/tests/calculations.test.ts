/**
 * 계산 및 변환 로직 유닛 테스트
 *
 * @description 이미지 처리에 사용되는 수학적 계산과 변환 로직을 검증하는 테스트
 * Node.js 환경에서 실행 가능한 순수 함수 테스트
 */

import { describe, it, expect } from 'vitest';

describe('이미지 크기 계산', () => {
  describe('비율 유지 리사이징', () => {
    it('가로형 이미지 리사이징', () => {
      const calculateAspectRatioSize = (
        originalWidth: number,
        originalHeight: number,
        targetWidth?: number,
        targetHeight?: number
      ): { width: number; height: number } => {
        const aspectRatio = originalWidth / originalHeight;

        if (targetWidth && targetHeight) {
          // 둘 다 지정된 경우, 비율을 유지하면서 더 작은 값에 맞춤
          const widthRatio = targetWidth / originalWidth;
          const heightRatio = targetHeight / originalHeight;
          const ratio = Math.min(widthRatio, heightRatio);

          return {
            width: Math.round(originalWidth * ratio),
            height: Math.round(originalHeight * ratio)
          };
        } else if (targetWidth) {
          return {
            width: targetWidth,
            height: Math.round(targetWidth / aspectRatio)
          };
        } else if (targetHeight) {
          return {
            width: Math.round(targetHeight * aspectRatio),
            height: targetHeight
          };
        }

        return { width: originalWidth, height: originalHeight };
      };

      // 1920x1080 -> width 800으로 리사이징
      const result1 = calculateAspectRatioSize(1920, 1080, 800);
      expect(result1).toEqual({ width: 800, height: 450 });

      // 1920x1080 -> height 600으로 리사이징
      const result2 = calculateAspectRatioSize(1920, 1080, undefined, 600);
      expect(result2).toEqual({ width: 1067, height: 600 });

      // 1920x1080 -> 800x600 박스에 맞춤
      const result3 = calculateAspectRatioSize(1920, 1080, 800, 600);
      expect(result3).toEqual({ width: 800, height: 450 }); // 가로 기준으로 맞춤
    });

    it('세로형 이미지 리사이징', () => {
      const calculateAspectRatioSize = (
        originalWidth: number,
        originalHeight: number,
        targetWidth?: number,
        targetHeight?: number
      ): { width: number; height: number } => {
        const aspectRatio = originalWidth / originalHeight;

        if (targetWidth && targetHeight) {
          const widthRatio = targetWidth / originalWidth;
          const heightRatio = targetHeight / originalHeight;
          const ratio = Math.min(widthRatio, heightRatio);

          return {
            width: Math.round(originalWidth * ratio),
            height: Math.round(originalHeight * ratio)
          };
        } else if (targetWidth) {
          return {
            width: targetWidth,
            height: Math.round(targetWidth / aspectRatio)
          };
        } else if (targetHeight) {
          return {
            width: Math.round(targetHeight * aspectRatio),
            height: targetHeight
          };
        }

        return { width: originalWidth, height: originalHeight };
      };

      // 1080x1920 (세로형) -> width 400으로 리사이징
      const result1 = calculateAspectRatioSize(1080, 1920, 400);
      expect(result1).toEqual({ width: 400, height: 711 });

      // 1080x1920 -> 400x600 박스에 맞춤
      const result2 = calculateAspectRatioSize(1080, 1920, 400, 600);
      expect(result2).toEqual({ width: 338, height: 600 }); // 세로 기준으로 맞춤
    });

    it('정사각형 이미지 리사이징', () => {
      const calculateAspectRatioSize = (
        originalWidth: number,
        originalHeight: number,
        targetWidth?: number,
        targetHeight?: number
      ): { width: number; height: number } => {
        const aspectRatio = originalWidth / originalHeight;

        if (targetWidth && targetHeight) {
          const ratio = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
          return {
            width: Math.round(originalWidth * ratio),
            height: Math.round(originalHeight * ratio)
          };
        } else if (targetWidth) {
          return {
            width: targetWidth,
            height: Math.round(targetWidth / aspectRatio)
          };
        } else if (targetHeight) {
          return {
            width: Math.round(targetHeight * aspectRatio),
            height: targetHeight
          };
        }

        return { width: originalWidth, height: originalHeight };
      };

      // 1000x1000 -> 500x500
      const result = calculateAspectRatioSize(1000, 1000, 500, 500);
      expect(result).toEqual({ width: 500, height: 500 });
    });
  });

  describe('크롭 영역 계산', () => {
    it('중앙 크롭', () => {
      const calculateCenterCrop = (
        originalWidth: number,
        originalHeight: number,
        targetWidth: number,
        targetHeight: number
      ): { x: number; y: number; width: number; height: number } => {
        const originalRatio = originalWidth / originalHeight;
        const targetRatio = targetWidth / targetHeight;

        let cropWidth: number;
        let cropHeight: number;

        if (originalRatio > targetRatio) {
          // 원본이 더 가로형: 세로 맞춤, 가로 크롭
          cropHeight = originalHeight;
          cropWidth = originalHeight * targetRatio;
        } else {
          // 원본이 더 세로형: 가로 맞춤, 세로 크롭
          cropWidth = originalWidth;
          cropHeight = originalWidth / targetRatio;
        }

        return {
          x: Math.round((originalWidth - cropWidth) / 2),
          y: Math.round((originalHeight - cropHeight) / 2),
          width: Math.round(cropWidth),
          height: Math.round(cropHeight)
        };
      };

      // 1920x1080 이미지를 1:1 비율로 중앙 크롭
      const result1 = calculateCenterCrop(1920, 1080, 1, 1);
      expect(result1).toEqual({
        x: 420, // (1920-1080)/2
        y: 0,
        width: 1080,
        height: 1080
      });

      // 1080x1920 이미지를 16:9 비율로 중앙 크롭
      const result2 = calculateCenterCrop(1080, 1920, 16, 9);
      expect(result2).toEqual({
        x: 0,
        y: 656, // (1920-608)/2 = 656
        width: 1080,
        height: 608 // 1080 / (16/9) ≈ 608
      });
    });

    it('커스텀 위치 크롭', () => {
      const calculateCustomCrop = (
        originalWidth: number,
        originalHeight: number,
        cropWidth: number,
        cropHeight: number,
        position: { x: number; y: number } // 0-1 범위
      ): { x: number; y: number; width: number; height: number } => {
        const maxX = originalWidth - cropWidth;
        const maxY = originalHeight - cropHeight;

        return {
          x: Math.round(maxX * position.x),
          y: Math.round(maxY * position.y),
          width: cropWidth,
          height: cropHeight
        };
      };

      // 좌상단 (0, 0)
      const topLeft = calculateCustomCrop(1000, 800, 500, 400, { x: 0, y: 0 });
      expect(topLeft).toEqual({ x: 0, y: 0, width: 500, height: 400 });

      // 우하단 (1, 1)
      const bottomRight = calculateCustomCrop(1000, 800, 500, 400, { x: 1, y: 1 });
      expect(bottomRight).toEqual({ x: 500, y: 400, width: 500, height: 400 });

      // 중앙 (0.5, 0.5)
      const center = calculateCustomCrop(1000, 800, 500, 400, { x: 0.5, y: 0.5 });
      expect(center).toEqual({ x: 250, y: 200, width: 500, height: 400 });
    });
  });

  describe('패딩 계산', () => {
    it('이미지를 박스에 맞춤 (패딩)', () => {
      const calculatePadding = (
        originalWidth: number,
        originalHeight: number,
        boxWidth: number,
        boxHeight: number
      ): {
        imageWidth: number;
        imageHeight: number;
        x: number;
        y: number;
        paddingTop: number;
        paddingBottom: number;
        paddingLeft: number;
        paddingRight: number;
      } => {
        const scale = Math.min(boxWidth / originalWidth, boxHeight / originalHeight);
        const scaledWidth = Math.round(originalWidth * scale);
        const scaledHeight = Math.round(originalHeight * scale);

        const x = Math.round((boxWidth - scaledWidth) / 2);
        const y = Math.round((boxHeight - scaledHeight) / 2);

        return {
          imageWidth: scaledWidth,
          imageHeight: scaledHeight,
          x,
          y,
          paddingTop: y,
          paddingBottom: boxHeight - scaledHeight - y,
          paddingLeft: x,
          paddingRight: boxWidth - scaledWidth - x
        };
      };

      // 1920x1080 이미지를 800x600 박스에 맞춤
      const result = calculatePadding(1920, 1080, 800, 600);

      expect(result.imageWidth).toBe(800); // 가로 기준으로 스케일
      expect(result.imageHeight).toBe(450); // 비율 유지
      expect(result.x).toBe(0);
      expect(result.y).toBe(75); // (600-450)/2
      expect(result.paddingTop).toBe(75);
      expect(result.paddingBottom).toBe(75);
      expect(result.paddingLeft).toBe(0);
      expect(result.paddingRight).toBe(0);
    });
  });
});

describe('색상 변환', () => {
  describe('RGB/HSL 변환', () => {
    it('RGB to HSL', () => {
      const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const sum = max + min;

        let h: number, s: number, l: number;

        l = sum / 2;

        if (diff === 0) {
          h = s = 0; // 무채색
        } else {
          s = l > 0.5 ? diff / (2 - sum) : diff / sum;

          switch (max) {
            case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / diff + 2) / 6; break;
            case b: h = ((r - g) / diff + 4) / 6; break;
            default: h = 0;
          }
        }

        return {
          h: Math.round(h * 360),
          s: Math.round(s * 100),
          l: Math.round(l * 100)
        };
      };

      // 빨강
      expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });

      // 초록
      expect(rgbToHsl(0, 255, 0)).toEqual({ h: 120, s: 100, l: 50 });

      // 파랑
      expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 });

      // 흰색
      expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 });

      // 검정
      expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });

      // 회색
      expect(rgbToHsl(128, 128, 128)).toEqual({ h: 0, s: 0, l: 50 });
    });

    it('HSL to RGB', () => {
      const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
        h /= 360;
        s /= 100;
        l /= 100;

        const hueToRgb = (p: number, q: number, t: number): number => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };

        let r: number, g: number, b: number;

        if (s === 0) {
          r = g = b = l; // 무채색
        } else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hueToRgb(p, q, h + 1/3);
          g = hueToRgb(p, q, h);
          b = hueToRgb(p, q, h - 1/3);
        }

        return {
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255)
        };
      };

      // 빨강
      expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 });

      // 초록
      expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 });

      // 파랑
      expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 });

      // 흰색
      expect(hslToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('16진수 색상 변환', () => {
    it('RGB to Hex', () => {
      const rgbToHex = (r: number, g: number, b: number): string => {
        const toHex = (c: number): string => {
          const hex = c.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
      };

      expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
      expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(128, 128, 128)).toBe('#808080');
    });

    it('Hex to RGB', () => {
      const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };

      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 }); // 짧은 형식
      expect(hexToRgb('000')).toEqual({ r: 0, g: 0, b: 0 }); // # 없이
      expect(hexToRgb('invalid')).toBeNull();
    });
  });
});

describe('이미지 품질 및 압축', () => {
  describe('품질 계산', () => {
    it('파일 크기 기반 품질 추정', () => {
      const estimateQualityFromSize = (
        originalSize: number,
        targetSize: number,
        currentQuality: number = 0.8
      ): number => {
        const ratio = targetSize / originalSize;
        let newQuality = currentQuality * Math.sqrt(ratio);

        // 품질 범위 제한
        newQuality = Math.max(0.1, Math.min(1.0, newQuality));

        return Math.round(newQuality * 100) / 100;
      };

      expect(estimateQualityFromSize(1000000, 500000)).toBe(0.57); // 반으로 줄이기
      expect(estimateQualityFromSize(1000000, 250000)).toBe(0.4);  // 1/4로 줄이기
      expect(estimateQualityFromSize(1000000, 2000000)).toBe(1.0); // 커지는 경우 최대 1.0
      expect(estimateQualityFromSize(1000000, 10000)).toBe(0.1);   // 너무 작으면 최소 0.1
    });

    it('해상도 기반 품질 조정', () => {
      const adjustQualityForResolution = (
        width: number,
        height: number,
        baseQuality: number = 0.8
      ): number => {
        const pixels = width * height;
        const megapixels = pixels / (1000 * 1000);

        // 고해상도일수록 품질을 약간 높임 (디테일 보존)
        let qualityBonus = 0;
        if (megapixels > 10) qualityBonus = 0.1;      // 10MP 이상
        else if (megapixels > 5) qualityBonus = 0.05; // 5-10MP

        const adjustedQuality = baseQuality + qualityBonus;
        return Math.min(1.0, adjustedQuality);
      };

      // 저해상도
      expect(adjustQualityForResolution(800, 600)).toBe(0.8);

      // 중간 해상도 (약 8MP)
      expect(adjustQualityForResolution(3264, 2448)).toBeCloseTo(0.85, 2);

      // 고해상도 (약 20MP)
      expect(adjustQualityForResolution(5472, 3648)).toBe(0.9);
    });
  });

  describe('압축률 예측', () => {
    it('포맷별 압축률', () => {
      const getCompressionRatio = (format: string, quality: number): number => {
        const baseRatios: Record<string, number> = {
          png: 0.3,    // 무손실, 압축률 낮음
          jpeg: 0.1,   // 손실, 높은 압축률
          webp: 0.08,  // 더 좋은 압축률
          avif: 0.05   // 최고 압축률
        };

        const baseRatio = baseRatios[format.toLowerCase()] || 0.2;

        // 품질에 따른 조정 (JPEG, WebP, AVIF만)
        if (['jpeg', 'webp', 'avif'].includes(format.toLowerCase())) {
          const qualityFactor = 0.5 + (quality * 0.5); // 0.5 ~ 1.0
          return baseRatio * qualityFactor;
        }

        return baseRatio;
      };

      expect(getCompressionRatio('png', 1.0)).toBe(0.3);
      expect(getCompressionRatio('jpeg', 0.8)).toBeCloseTo(0.09, 3);  // 0.1 * (0.5 + 0.8*0.5)
      expect(getCompressionRatio('jpeg', 0.5)).toBeCloseTo(0.075, 3); // 0.1 * (0.5 + 0.5*0.5)
      expect(getCompressionRatio('webp', 0.8)).toBeCloseTo(0.072, 3); // 더 좋은 압축률
      expect(getCompressionRatio('avif', 0.8)).toBeCloseTo(0.045, 3); // 최고 압축률
    });

    it('예상 파일 크기 계산', () => {
      const estimateFileSize = (
        width: number,
        height: number,
        format: string,
        quality: number = 0.8
      ): number => {
        const pixels = width * height;
        const rawSize = pixels * 4; // RGBA

        const compressionRatios: Record<string, (q: number) => number> = {
          png: () => 0.3,
          jpeg: (q) => 0.1 * (0.5 + q * 0.5),
          webp: (q) => 0.08 * (0.5 + q * 0.5),
          avif: (q) => 0.05 * (0.5 + q * 0.5)
        };

        const getRatio = compressionRatios[format.toLowerCase()] || (() => 0.2);
        const compressionRatio = getRatio(quality);

        return Math.round(rawSize * compressionRatio);
      };

      // 1920x1080 이미지
      const width = 1920, height = 1080;
      const rawSize = width * height * 4; // 8,294,400 bytes

      expect(estimateFileSize(width, height, 'png')).toBe(Math.round(rawSize * 0.3));
      expect(estimateFileSize(width, height, 'jpeg', 0.8)).toBeLessThan(estimateFileSize(width, height, 'png'));
      expect(estimateFileSize(width, height, 'webp', 0.8)).toBeLessThan(estimateFileSize(width, height, 'jpeg', 0.8));
      expect(estimateFileSize(width, height, 'avif', 0.8)).toBeLessThan(estimateFileSize(width, height, 'webp', 0.8));
    });
  });
});

describe('좌표 및 변환 수학', () => {
  describe('회전 변환', () => {
    it('점 회전', () => {
      const rotatePoint = (
        x: number,
        y: number,
        centerX: number,
        centerY: number,
        angleDegrees: number
      ): { x: number; y: number } => {
        const angleRad = (angleDegrees * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        const dx = x - centerX;
        const dy = y - centerY;

        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        };
      };

      // 90도 회전
      const result90 = rotatePoint(100, 50, 50, 50, 90);
      expect(result90.x).toBeCloseTo(50, 0);
      expect(result90.y).toBeCloseTo(100, 0);

      // 180도 회전
      const result180 = rotatePoint(100, 50, 50, 50, 180);
      expect(result180.x).toBeCloseTo(0, 0);
      expect(result180.y).toBeCloseTo(50, 0);

      // 360도 회전 (원점 복귀)
      const result360 = rotatePoint(100, 50, 50, 50, 360);
      expect(result360.x).toBeCloseTo(100, 0);
      expect(result360.y).toBeCloseTo(50, 0);
    });

    it('사각형 바운딩 박스 계산', () => {
      const calculateRotatedBounds = (
        width: number,
        height: number,
        angleDegrees: number
      ): { width: number; height: number } => {
        const angleRad = (angleDegrees * Math.PI) / 180;
        const cos = Math.abs(Math.cos(angleRad));
        const sin = Math.abs(Math.sin(angleRad));

        const newWidth = width * cos + height * sin;
        const newHeight = width * sin + height * cos;

        return {
          width: Math.ceil(newWidth),
          height: Math.ceil(newHeight)
        };
      };

      // 90도 회전 - 가로세로 바뀜
      expect(calculateRotatedBounds(100, 50, 90)).toEqual({ width: 51, height: 100 });

      // 45도 회전 - 대각선 길이
      const result45 = calculateRotatedBounds(100, 100, 45);
      expect(result45.width).toBeCloseTo(142, 0); // 100 * √2
      expect(result45.height).toBeCloseTo(142, 0);

      // 0도 회전 - 변화 없음
      expect(calculateRotatedBounds(100, 50, 0)).toEqual({ width: 100, height: 50 });
    });
  });

  describe('스케일링 변환', () => {
    it('중심점 기준 스케일링', () => {
      const scaleFromCenter = (
        x: number,
        y: number,
        centerX: number,
        centerY: number,
        scaleX: number,
        scaleY: number = scaleX
      ): { x: number; y: number } => {
        const dx = x - centerX;
        const dy = y - centerY;

        return {
          x: centerX + dx * scaleX,
          y: centerY + dy * scaleY
        };
      };

      // 2배 확대
      const result = scaleFromCenter(100, 60, 50, 50, 2);
      expect(result).toEqual({ x: 150, y: 70 }); // (50 + 50*2, 50 + 10*2)

      // 0.5배 축소
      const result2 = scaleFromCenter(100, 60, 50, 50, 0.5);
      expect(result2).toEqual({ x: 75, y: 55 }); // (50 + 50*0.5, 50 + 10*0.5)

      // 비균등 스케일링
      const result3 = scaleFromCenter(100, 60, 50, 50, 2, 0.5);
      expect(result3).toEqual({ x: 150, y: 55 }); // x는 2배, y는 0.5배
    });
  });
});