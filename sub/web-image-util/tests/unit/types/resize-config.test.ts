import { describe, expect, it } from 'vitest';
import {
  isContainConfig,
  isCoverConfig,
  isFillConfig,
  isMaxFitConfig,
  isMinFitConfig,
  isScaleConfig,
  type ResizeConfig,
  validateResizeConfig,
} from '../../../src/types/resize-config';

describe('ResizeConfig Types', () => {
  describe('validateResizeConfig', () => {
    describe('cover config', () => {
      it('should validate cover config with required width and height', () => {
        const config: ResizeConfig = { fit: 'cover', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for cover config without width', () => {
        const config = { fit: 'cover', height: 200 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('should throw error for cover config without height', () => {
        const config = { fit: 'cover', width: 300 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('should throw error for cover config with negative width', () => {
        const config = { fit: 'cover', width: -300, height: 200 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('should throw error for cover config with zero height', () => {
        const config = { fit: 'cover', width: 300, height: 0 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('contain config', () => {
      it('should validate contain config with required width and height', () => {
        const config: ResizeConfig = { fit: 'contain', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate contain config with withoutEnlargement option', () => {
        const config: ResizeConfig = {
          fit: 'contain',
          width: 300,
          height: 200,
          withoutEnlargement: true,
        };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for contain config without width', () => {
        const config = { fit: 'contain', height: 200 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('fill config', () => {
      it('should validate fill config with required width and height', () => {
        const config: ResizeConfig = { fit: 'fill', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('width만 지정한 fill config를 허용한다 (height는 렌더 시점에 원본 비율로 계산)', () => {
        const config: ResizeConfig = { fit: 'fill', width: 300 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('height만 지정한 fill config를 허용한다', () => {
        const config: ResizeConfig = { fit: 'fill', height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('width·height 모두 없는 fill config는 거부한다', () => {
        const config = { fit: 'fill' } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('음수 width의 fill config는 거부한다', () => {
        const config = { fit: 'fill', width: -300 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('scale config', () => {
      it('균일 배율 scale config를 허용한다', () => {
        const config: ResizeConfig = { fit: 'scale', scale: 1.5 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('축별 배율 scale config를 허용한다', () => {
        const configs: ResizeConfig[] = [
          { fit: 'scale', scale: { sx: 2 } },
          { fit: 'scale', scale: { sy: 0.5 } },
          { fit: 'scale', scale: { sx: 2, sy: 0.75 } },
        ];
        configs.forEach((config) => {
          expect(() => validateResizeConfig(config)).not.toThrow();
        });
      });

      it('0 이하의 균일 배율은 거부한다', () => {
        const config = { fit: 'scale', scale: 0 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('유한하지 않은 배율은 거부한다', () => {
        const config = { fit: 'scale', scale: Number.POSITIVE_INFINITY } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('0 이하의 축별 배율은 거부한다', () => {
        const config = { fit: 'scale', scale: { sx: -1 } } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('sx·sy가 모두 없는 객체 배율은 거부한다', () => {
        const config = { fit: 'scale', scale: {} } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('maxFit config', () => {
      it('should validate maxFit config with only width', () => {
        const config: ResizeConfig = { fit: 'maxFit', width: 300 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate maxFit config with only height', () => {
        const config: ResizeConfig = { fit: 'maxFit', height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate maxFit config with both width and height', () => {
        const config: ResizeConfig = { fit: 'maxFit', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for maxFit config without width or height', () => {
        const config = { fit: 'maxFit' } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('should throw error for maxFit config with negative width', () => {
        const config = { fit: 'maxFit', width: -300 } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('minFit config', () => {
      it('should validate minFit config with only width', () => {
        const config: ResizeConfig = { fit: 'minFit', width: 300 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate minFit config with only height', () => {
        const config: ResizeConfig = { fit: 'minFit', height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate minFit config with both width and height', () => {
        const config: ResizeConfig = { fit: 'minFit', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for minFit config without width or height', () => {
        const config = { fit: 'minFit' } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('padding validation', () => {
      it('should validate config with number padding', () => {
        const config: ResizeConfig = {
          fit: 'cover',
          width: 300,
          height: 200,
          padding: 10,
        };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate config with object padding', () => {
        const config: ResizeConfig = {
          fit: 'cover',
          width: 300,
          height: 200,
          padding: { top: 10, right: 20, bottom: 10, left: 20 },
        };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for negative number padding', () => {
        const config = {
          fit: 'cover',
          width: 300,
          height: 200,
          padding: -10,
        } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });

      it('should throw error for negative object padding values', () => {
        const config = {
          fit: 'cover',
          width: 300,
          height: 200,
          padding: { top: -10, right: 20 },
        } as any;
        expect(() => validateResizeConfig(config)).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
      });
    });

    describe('all fit modes with proper parameters', () => {
      it('should validate all fit modes', () => {
        const configs: ResizeConfig[] = [
          { fit: 'cover', width: 300, height: 200 },
          { fit: 'contain', width: 300, height: 200, withoutEnlargement: true },
          { fit: 'fill', width: 300, height: 200 },
          { fit: 'maxFit', width: 300 },
          { fit: 'minFit', height: 200 },
        ];

        configs.forEach((config) => {
          expect(() => validateResizeConfig(config)).not.toThrow();
        });
      });
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify cover config', () => {
      const config: ResizeConfig = { fit: 'cover', width: 300, height: 200 };
      expect(isCoverConfig(config)).toBe(true);
      expect(isContainConfig(config)).toBe(false);
      expect(isFillConfig(config)).toBe(false);
      expect(isMaxFitConfig(config)).toBe(false);
      expect(isMinFitConfig(config)).toBe(false);
    });

    it('should correctly identify contain config with withoutEnlargement', () => {
      const config: ResizeConfig = {
        fit: 'contain',
        width: 300,
        height: 200,
        withoutEnlargement: true,
      };
      expect(isContainConfig(config)).toBe(true);
      expect(isCoverConfig(config)).toBe(false);
    });

    it('should correctly identify fill config', () => {
      const config: ResizeConfig = { fit: 'fill', width: 300, height: 200 };
      expect(isFillConfig(config)).toBe(true);
      expect(isCoverConfig(config)).toBe(false);
      expect(isContainConfig(config)).toBe(false);
    });

    it('should correctly identify maxFit config', () => {
      const config: ResizeConfig = { fit: 'maxFit', width: 300 };
      expect(isMaxFitConfig(config)).toBe(true);
      expect(isCoverConfig(config)).toBe(false);
      expect(isMinFitConfig(config)).toBe(false);
    });

    it('should correctly identify minFit config', () => {
      const config: ResizeConfig = { fit: 'minFit', height: 200 };
      expect(isMinFitConfig(config)).toBe(true);
      expect(isCoverConfig(config)).toBe(false);
      expect(isMaxFitConfig(config)).toBe(false);
    });

    it('scale config를 정확히 식별한다', () => {
      const config: ResizeConfig = { fit: 'scale', scale: 2 };
      expect(isScaleConfig(config)).toBe(true);
      expect(isCoverConfig(config)).toBe(false);
      expect(isFillConfig(config)).toBe(false);
    });
  });

  describe('TypeScript Discriminated Union', () => {
    it('should narrow type based on fit property', () => {
      const config: ResizeConfig = { fit: 'contain', width: 300, height: 200, withoutEnlargement: true };

      if (isContainConfig(config)) {
        // TypeScript should recognize config.withoutEnlargement here
        expect(config.withoutEnlargement).toBe(true);
      } else {
        throw new Error('Type guard should work');
      }
    });

    it('should prevent invalid config combinations at type level', () => {
      // This test is to verify type checking at compile time
      // Invalid types are blocked by the TypeScript compiler

      // ✅ Valid configs
      const validCover: ResizeConfig = { fit: 'cover', width: 300, height: 200 };
      const validContain: ResizeConfig = { fit: 'contain', width: 300, height: 200, withoutEnlargement: true };
      const validMaxFit: ResizeConfig = { fit: 'maxFit', width: 300 };

      expect(validCover.fit).toBe('cover');
      expect(validContain.fit).toBe('contain');
      expect(validMaxFit.fit).toBe('maxFit');

      // ❌ Invalid configs would cause type errors (at compile time)
      // const invalidCover: ResizeConfig = { fit: 'cover', width: 300 }; // missing height
      // const invalidMaxFit: ResizeConfig = { fit: 'maxFit' }; // missing both width/height
    });

    it('should reject removed trimEmpty option at type level', () => {
      // @ts-expect-error trimEmpty는 contain 옵션에서 제거됐다.
      const invalidContain: ResizeConfig = { fit: 'contain', width: 300, height: 200, trimEmpty: true };

      expect(invalidContain).toBeDefined();
    });
  });
});
