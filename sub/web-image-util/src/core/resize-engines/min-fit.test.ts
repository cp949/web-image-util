import { describe, it, expect } from 'vitest';
import { executeMinFitResize } from './min-fit';
import { createTestCanvas } from '../../test-utils/canvas-helper';
import type { MinFitConfig } from '../../types/resize-config';

describe('MinFit Resize Engine', () => {
	describe('upscale only behavior', () => {
		it('should upscale small image to min width', () => {
			const testCanvas = createTestCanvas(200, 150, 'red');
			const config: MinFitConfig = { fit: 'minFit', width: 400 };
			const result = executeMinFitResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(300); // 비율 유지: 200x150 → 400x300
		});

		it('should upscale small image to min height', () => {
			const testCanvas = createTestCanvas(200, 150, 'blue');
			const config: MinFitConfig = { fit: 'minFit', height: 300 };
			const result = executeMinFitResize(testCanvas, config);

			expect(result.width).toBe(400); // 비율 유지: 200x150 → 400x300
			expect(result.height).toBe(300);
		});

		it('should upscale to meet both width and height minimums', () => {
			const testCanvas = createTestCanvas(100, 100, 'green');
			const config: MinFitConfig = { fit: 'minFit', width: 300, height: 400 };
			const result = executeMinFitResize(testCanvas, config);

			// 더 큰 확대 요구사항(height: 400)에 맞춤
			expect(result.width).toBeGreaterThanOrEqual(300);
			expect(result.height).toBeGreaterThanOrEqual(400);
		});
	});

	describe('no downscale behavior', () => {
		it('should not downscale large image with width constraint', () => {
			const testCanvas = createTestCanvas(800, 600, 'purple');
			const config: MinFitConfig = { fit: 'minFit', width: 400 };
			const result = executeMinFitResize(testCanvas, config);

			// 축소하지 않고 원본 크기 유지
			expect(result.width).toBe(800);
			expect(result.height).toBe(600);
		});

		it('should not downscale large image with height constraint', () => {
			const testCanvas = createTestCanvas(800, 600, 'orange');
			const config: MinFitConfig = { fit: 'minFit', height: 300 };
			const result = executeMinFitResize(testCanvas, config);

			// 축소하지 않고 원본 크기 유지
			expect(result.width).toBe(800);
			expect(result.height).toBe(600);
		});

		it('should not downscale when larger than both constraints', () => {
			const testCanvas = createTestCanvas(500, 500, 'cyan');
			const config: MinFitConfig = { fit: 'minFit', width: 300, height: 300 };
			const result = executeMinFitResize(testCanvas, config);

			// 원본 크기 유지
			expect(result.width).toBe(500);
			expect(result.height).toBe(500);
		});
	});

	describe('aspect ratio preservation', () => {
		it('should maintain aspect ratio when upscaling', () => {
			const testCanvas = createTestCanvas(200, 150, 'yellow'); // 4:3
			const config: MinFitConfig = { fit: 'minFit', width: 400 };
			const result = executeMinFitResize(testCanvas, config);

			// 4:3 비율 유지
			expect(result.width).toBe(400);
			expect(result.height).toBe(300);
			expect(result.width / result.height).toBeCloseTo(4 / 3, 2);
		});

		it('should maintain aspect ratio with height constraint', () => {
			const testCanvas = createTestCanvas(300, 200, 'magenta'); // 3:2
			const config: MinFitConfig = { fit: 'minFit', height: 400 };
			const result = executeMinFitResize(testCanvas, config);

			// 3:2 비율 유지
			expect(result.width).toBe(600);
			expect(result.height).toBe(400);
			expect(result.width / result.height).toBeCloseTo(3 / 2, 2);
		});

		it('should maintain aspect ratio with both constraints', () => {
			const testCanvas = createTestCanvas(100, 200, 'lime'); // 1:2
			const config: MinFitConfig = { fit: 'minFit', width: 300, height: 300 };
			const result = executeMinFitResize(testCanvas, config);

			// 1:2 비율 유지하며 최소 조건 만족
			expect(result.width).toBeGreaterThanOrEqual(300);
			expect(result.height).toBeGreaterThanOrEqual(300);
			expect(result.width / result.height).toBeCloseTo(0.5, 1);
		});
	});

	describe('minimum dimension selection', () => {
		it('should use width as minimum dimension when it requires more upscaling', () => {
			const testCanvas = createTestCanvas(100, 200, 'teal'); // 1:2
			const config: MinFitConfig = { fit: 'minFit', width: 400, height: 300 };
			const result = executeMinFitResize(testCanvas, config);

			// width가 더 많은 확대 필요 (100→400은 4배, 200→300은 1.5배)
			expect(result.width).toBe(400);
			expect(result.height).toBe(800); // 비율 유지
		});

		it('should use height as minimum dimension when it requires more upscaling', () => {
			const testCanvas = createTestCanvas(200, 100, 'navy'); // 2:1
			const config: MinFitConfig = { fit: 'minFit', width: 300, height: 400 };
			const result = executeMinFitResize(testCanvas, config);

			// height가 더 많은 확대 필요
			expect(result.width).toBe(800); // 비율 유지
			expect(result.height).toBe(400);
		});
	});

	describe('edge cases', () => {
		it('should handle very large min dimensions', () => {
			const testCanvas = createTestCanvas(10, 10, 'maroon');
			const config: MinFitConfig = { fit: 'minFit', width: 2000 };
			const result = executeMinFitResize(testCanvas, config);

			expect(result.width).toBe(2000);
			expect(result.height).toBe(2000);
		});

		it('should handle very small min dimensions with large image', () => {
			const testCanvas = createTestCanvas(2000, 2000, 'olive');
			const config: MinFitConfig = { fit: 'minFit', width: 10 };
			const result = executeMinFitResize(testCanvas, config);

			// 축소하지 않고 원본 크기 유지
			expect(result.width).toBe(2000);
			expect(result.height).toBe(2000);
		});

		it('should handle extreme aspect ratios', () => {
			const testCanvas = createTestCanvas(100, 2000, 'silver'); // 1:20
			const config: MinFitConfig = { fit: 'minFit', width: 400 };
			const result = executeMinFitResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(8000); // 비율 유지
		});

		it('should handle 1x1 pixel image', () => {
			const testCanvas = createTestCanvas(1, 1, 'white');
			const config: MinFitConfig = { fit: 'minFit', width: 100 };
			const result = executeMinFitResize(testCanvas, config);

			// 확대
			expect(result.width).toBe(100);
			expect(result.height).toBe(100);
		});

		it('should handle exact match dimensions', () => {
			const testCanvas = createTestCanvas(400, 300, 'red');
			const config: MinFitConfig = { fit: 'minFit', width: 400, height: 300 };
			const result = executeMinFitResize(testCanvas, config);

			// 정확히 일치하므로 원본 크기 유지
			expect(result.width).toBe(400);
			expect(result.height).toBe(300);
		});
	});

	describe('padding support', () => {
		it('should apply uniform padding', () => {
			const testCanvas = createTestCanvas(200, 150, 'red');
			const config: MinFitConfig = {
				fit: 'minFit',
				width: 400,
				padding: 10,
			};
			const result = executeMinFitResize(testCanvas, config);

			// 패딩 포함 크기 (400x300 + 패딩 20x20)
			expect(result.width).toBe(420);
			expect(result.height).toBe(320);
		});

		it('should apply object padding', () => {
			const testCanvas = createTestCanvas(200, 150, 'blue');
			const config: MinFitConfig = {
				fit: 'minFit',
				width: 400,
				padding: { top: 5, right: 10, bottom: 15, left: 20 },
			};
			const result = executeMinFitResize(testCanvas, config);

			// 400x300 + 패딩
			expect(result.width).toBe(430); // 400 + 10 + 20
			expect(result.height).toBe(320); // 300 + 5 + 15
		});
	});

	describe('quality and upscaling', () => {
		it('should produce high quality upscaled output', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: MinFitConfig = { fit: 'minFit', width: 500 };
			const result = executeMinFitResize(testCanvas, config);

			// 5배 확대
			expect(result).toBeInstanceOf(HTMLCanvasElement);
			expect(result.width).toBe(500);
			expect(result.height).toBe(500);

			const ctx = result.getContext('2d');
			expect(ctx).not.toBeNull();
		});
	});
});