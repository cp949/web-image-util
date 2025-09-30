import { describe, it, expect } from 'vitest';
import {
  type ResizeConfig,
  validateResizeConfig,
  isCoverConfig,
  isContainConfig,
  isFillConfig,
  isMaxFitConfig,
  isMinFitConfig,
} from '../../../src/types/resize-config';
import { ImageProcessError } from '../../../src/types';

describe('ResizeConfig Types', () => {
  describe('validateResizeConfig', () => {
    describe('cover config', () => {
      it('should validate cover config with required width and height', () => {
        const config: ResizeConfig = { fit: 'cover', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for cover config without width', () => {
        const config = { fit: 'cover', height: 200 } as any;
        expect(() => validateResizeConfig(config)).toThrow(ImageProcessError);
        expect(() => validateResizeConfig(config)).toThrow('cover requires both width and height');
      });

      it('should throw error for cover config without height', () => {
        const config = { fit: 'cover', width: 300 } as any;
        expect(() => validateResizeConfig(config)).toThrow(ImageProcessError);
        expect(() => validateResizeConfig(config)).toThrow('cover requires both width and height');
      });

      it('should throw error for cover config with negative width', () => {
        const config = { fit: 'cover', width: -300, height: 200 } as any;
        expect(() => validateResizeConfig(config)).toThrow(ImageProcessError);
        expect(() => validateResizeConfig(config)).toThrow('must be positive numbers');
      });

      it('should throw error for cover config with zero height', () => {
        const config = { fit: 'cover', width: 300, height: 0 } as any;
        expect(() => validateResizeConfig(config)).toThrow(ImageProcessError);
        expect(() => validateResizeConfig(config)).toThrow('must be positive numbers');
      });
    });

    describe('contain config', () => {
      it('should validate contain config with required width and height', () => {
        const config: ResizeConfig = { fit: 'contain', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should validate contain config with trimEmpty option', () => {
        const config: ResizeConfig = {
          fit: 'contain',
          width: 300,
          height: 200,
          trimEmpty: true,
        };
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
        expect(() => validateResizeConfig(config)).toThrow('contain requires both width and height');
      });
    });

    describe('fill config', () => {
      it('should validate fill config with required width and height', () => {
        const config: ResizeConfig = { fit: 'fill', width: 300, height: 200 };
        expect(() => validateResizeConfig(config)).not.toThrow();
      });

      it('should throw error for fill config without height', () => {
        const config = { fit: 'fill', width: 300 } as any;
        expect(() => validateResizeConfig(config)).toThrow('fill requires both width and height');
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
        expect(() => validateResizeConfig(config)).toThrow(ImageProcessError);
        expect(() => validateResizeConfig(config)).toThrow('maxFit requires at least width or height');
      });

      it('should throw error for maxFit config with negative width', () => {
        const config = { fit: 'maxFit', width: -300 } as any;
        expect(() => validateResizeConfig(config)).toThrow('must be positive numbers');
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
        expect(() => validateResizeConfig(config)).toThrow('minFit requires at least width or height');
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
        expect(() => validateResizeConfig(config)).toThrow('padding must be non-negative');
      });

      it('should throw error for negative object padding values', () => {
        const config = {
          fit: 'cover',
          width: 300,
          height: 200,
          padding: { top: -10, right: 20 },
        } as any;
        expect(() => validateResizeConfig(config)).toThrow('padding values must be non-negative');
      });
    });

    describe('all fit modes with proper parameters', () => {
      it('should validate all fit modes', () => {
        const configs: ResizeConfig[] = [
          { fit: 'cover', width: 300, height: 200 },
          { fit: 'contain', width: 300, height: 200, trimEmpty: true },
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

    it('should correctly identify contain config with trimEmpty', () => {
      const config: ResizeConfig = {
        fit: 'contain',
        width: 300,
        height: 200,
        trimEmpty: true,
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
  });

  describe('TypeScript Discriminated Union', () => {
    it('should narrow type based on fit property', () => {
      const config: ResizeConfig = { fit: 'contain', width: 300, height: 200, trimEmpty: true };

      if (isContainConfig(config)) {
        // TypeScript는 여기서 config.trimEmpty를 인식해야 함
        expect(config.trimEmpty).toBe(true);
      } else {
        throw new Error('Type guard should work');
      }
    });

    it('should prevent invalid config combinations at type level', () => {
      // 이 테스트는 컴파일 타임에 타입 체킹을 확인하기 위한 것
      // 실제로 잘못된 타입은 TypeScript 컴파일러가 막음

      // ✅ 올바른 config들
      const validCover: ResizeConfig = { fit: 'cover', width: 300, height: 200 };
      const validContain: ResizeConfig = { fit: 'contain', width: 300, height: 200, trimEmpty: true };
      const validMaxFit: ResizeConfig = { fit: 'maxFit', width: 300 };

      expect(validCover.fit).toBe('cover');
      expect(validContain.fit).toBe('contain');
      expect(validMaxFit.fit).toBe('maxFit');

      // ❌ 잘못된 config는 타입 에러 발생 (컴파일 타임)
      // const invalidCover: ResizeConfig = { fit: 'cover', width: 300 }; // height 누락
      // const invalidMaxFit: ResizeConfig = { fit: 'maxFit' }; // width/height 둘 다 누락
    });
  });
});
