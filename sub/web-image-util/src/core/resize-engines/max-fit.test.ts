import { describe, it, expect } from 'vitest';
import { executeMaxFitResize } from './max-fit';
import { createTestCanvas } from '../../test-utils/canvas-helper';
import type { MaxFitConfig } from '../../types/resize-config';

describe('MaxFit Resize Engine', () => {
	describe('downscale only behavior', () => {
		it('should downscale large image to max width', () => {
			const testCanvas = createTestCanvas(800, 600, 'red');
			const config: MaxFitConfig = { fit: 'maxFit', width: 400 };
			const result = executeMaxFitResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(300); // 비율 유지: 800x600 → 400x300
		});

		it('should downscale large image to max height', () => {
			const testCanvas = createTestCanvas(800, 600, 'blue');
			const config: MaxFitConfig = { fit: 'maxFit', height: 300 };
			const result = executeMaxFitResize(testCanvas, config);

			expect(result.width).toBe(400); // 비율 유지: 800x600 → 400x300
			expect(result.height).toBe(300);
		});

		it('should downscale to fit both width and height constraints', () => {
			const testCanvas = createTestCanvas(800, 600, 'green');
			const config: MaxFitConfig = { fit: 'maxFit', width: 400, height: 200 };
			const result = executeMaxFitResize(testCanvas, config);

			// 더 제한적인 조건(height: 200)에 맞춤
			expect(result.width).toBeLessThanOrEqual(400);
			expect(result.height).toBeLessThanOrEqual(200);
		});
	});

	describe('no upscale behavior', () => {
		it('should not upscale small image with width constraint', () => {
			const testCanvas = createTestCanvas(200, 150, 'purple');
			const config: MaxFitConfig = { fit: 'maxFit', width: 400 };
			const result = executeMaxFitResize(testCanvas, config);

			// 확대하지 않고 원본 크기 유지
			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});

		it('should not upscale small image with height constraint', () => {
			const testCanvas = createTestCanvas(200, 150, 'orange');
			const config: MaxFitConfig = { fit: 'maxFit', height: 300 };
			const result = executeMaxFitResize(testCanvas, config);

			// 확대하지 않고 원본 크기 유지
			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});

		it('should not upscale when smaller than both constraints', () => {
			const testCanvas = createTestCanvas(100, 100, 'cyan');
			const config: MaxFitConfig = { fit: 'maxFit', width: 300, height: 300 };
			const result = executeMaxFitResize(testCanvas, config);

			// 원본 크기 유지
			expect(result.width).toBe(100);
			expect(result.height).toBe(100);
		});
	});

	describe('aspect ratio preservation', () => {
		it('should maintain aspect ratio when downscaling', () => {
			const testCanvas = createTestCanvas(400, 300, 'yellow'); // 4:3
			const config: MaxFitConfig = { fit: 'maxFit', width: 200 };
			const result = executeMaxFitResize(testCanvas, config);

			// 4:3 비율 유지
			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
			expect(result.width / result.height).toBeCloseTo(4 / 3, 2);
		});

		it('should maintain aspect ratio with height constraint', () => {
			const testCanvas = createTestCanvas(600, 400, 'magenta'); // 3:2
			const config: MaxFitConfig = { fit: 'maxFit', height: 200 };
			const result = executeMaxFitResize(testCanvas, config);

			// 3:2 비율 유지
			expect(result.width).toBe(300);
			expect(result.height).toBe(200);
			expect(result.width / result.height).toBeCloseTo(3 / 2, 2);
		});

		it('should maintain aspect ratio with both constraints', () => {
			const testCanvas = createTestCanvas(800, 400, 'lime'); // 2:1
			const config: MaxFitConfig = { fit: 'maxFit', width: 300, height: 300 };
			const result = executeMaxFitResize(testCanvas, config);

			// 2:1 비율 유지하며 300x300 안에 들어감
			expect(result.width).toBeLessThanOrEqual(300);
			expect(result.height).toBeLessThanOrEqual(300);
			expect(result.width / result.height).toBeCloseTo(2, 1);
		});
	});

	describe('limiting dimension selection', () => {
		it('should use width as limiting dimension when it is more restrictive', () => {
			const testCanvas = createTestCanvas(1000, 500, 'teal'); // 2:1
			const config: MaxFitConfig = { fit: 'maxFit', width: 200, height: 300 };
			const result = executeMaxFitResize(testCanvas, config);

			// width가 더 제한적 (1000→200은 5배 축소, 500→300은 1.67배 축소)
			expect(result.width).toBe(200);
			expect(result.height).toBe(100);
		});

		it('should use height as limiting dimension when it is more restrictive', () => {
			const testCanvas = createTestCanvas(500, 1000, 'navy'); // 1:2
			const config: MaxFitConfig = { fit: 'maxFit', width: 300, height: 200 };
			const result = executeMaxFitResize(testCanvas, config);

			// height가 더 제한적
			expect(result.width).toBe(100);
			expect(result.height).toBe(200);
		});
	});

	describe('edge cases', () => {
		it('should handle very small max dimensions', () => {
			const testCanvas = createTestCanvas(1000, 1000, 'maroon');
			const config: MaxFitConfig = { fit: 'maxFit', width: 10 };
			const result = executeMaxFitResize(testCanvas, config);

			expect(result.width).toBe(10);
			expect(result.height).toBe(10);
		});

		it('should handle very large max dimensions with small image', () => {
			const testCanvas = createTestCanvas(10, 10, 'olive');
			const config: MaxFitConfig = { fit: 'maxFit', width: 2000 };
			const result = executeMaxFitResize(testCanvas, config);

			// 확대하지 않고 원본 크기 유지
			expect(result.width).toBe(10);
			expect(result.height).toBe(10);
		});

		it('should handle extreme aspect ratios', () => {
			const testCanvas = createTestCanvas(2000, 100, 'silver'); // 20:1
			const config: MaxFitConfig = { fit: 'maxFit', width: 400 };
			const result = executeMaxFitResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(20); // 비율 유지
		});

		it('should handle 1x1 pixel image', () => {
			const testCanvas = createTestCanvas(1, 1, 'white');
			const config: MaxFitConfig = { fit: 'maxFit', width: 100 };
			const result = executeMaxFitResize(testCanvas, config);

			// 확대하지 않음
			expect(result.width).toBe(1);
			expect(result.height).toBe(1);
		});

		it('should handle exact match dimensions', () => {
			const testCanvas = createTestCanvas(400, 300, 'red');
			const config: MaxFitConfig = { fit: 'maxFit', width: 400, height: 300 };
			const result = executeMaxFitResize(testCanvas, config);

			// 정확히 일치하므로 원본 크기 유지
			expect(result.width).toBe(400);
			expect(result.height).toBe(300);
		});
	});

	describe('padding support', () => {
		it('should apply uniform padding', () => {
			const testCanvas = createTestCanvas(400, 300, 'red');
			const config: MaxFitConfig = {
				fit: 'maxFit',
				width: 200,
				padding: 10,
			};
			const result = executeMaxFitResize(testCanvas, config);

			// 패딩 포함 크기 (200x150 + 패딩 20x20)
			expect(result.width).toBe(220);
			expect(result.height).toBe(170);
		});

		it('should apply object padding', () => {
			const testCanvas = createTestCanvas(400, 300, 'blue');
			const config: MaxFitConfig = {
				fit: 'maxFit',
				width: 200,
				padding: { top: 5, right: 10, bottom: 15, left: 20 },
			};
			const result = executeMaxFitResize(testCanvas, config);

			// 200x150 + 패딩
			expect(result.width).toBe(230); // 200 + 10 + 20
			expect(result.height).toBe(170); // 150 + 5 + 15
		});
	});
});