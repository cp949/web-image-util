import { describe, it, expect } from 'vitest';
import { executeFillResize } from './fill';
import { createTestCanvas, getCanvasPixelData } from '../../test-utils/canvas-helper';
import type { FillConfig } from '../../types/resize-config';

describe('Fill Resize Engine', () => {
	describe('basic fill resizing', () => {
		it('should stretch image to exact dimensions ignoring aspect ratio', () => {
			const testCanvas = createTestCanvas(400, 300, 'red'); // 4:3
			const config: FillConfig = { fit: 'fill', width: 200, height: 200 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(200);
		});

		it('should handle landscape to portrait stretching', () => {
			const testCanvas = createTestCanvas(400, 200, 'blue'); // 2:1 가로
			const config: FillConfig = { fit: 'fill', width: 100, height: 200 }; // 1:2 세로
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(200);
		});

		it('should handle portrait to landscape stretching', () => {
			const testCanvas = createTestCanvas(200, 400, 'green'); // 1:2 세로
			const config: FillConfig = { fit: 'fill', width: 300, height: 150 }; // 2:1 가로
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(300);
			expect(result.height).toBe(150);
		});
	});

	describe('aspect ratio changes', () => {
		it('should distort image when aspect ratios differ significantly', () => {
			const testCanvas = createTestCanvas(400, 300, 'red'); // 4:3
			const config: FillConfig = { fit: 'fill', width: 100, height: 400 }; // 1:4
			const result = executeFillResize(testCanvas, config);

			// 비율이 크게 달라도 정확히 목표 크기로 늘림
			expect(result.width).toBe(100);
			expect(result.height).toBe(400);
		});

		it('should maintain content when aspect ratio matches', () => {
			const testCanvas = createTestCanvas(400, 300, 'cyan'); // 4:3
			const config: FillConfig = { fit: 'fill', width: 200, height: 150 }; // 4:3
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(150);

			// 비율이 같으면 왜곡 없음
			const pixelData = getCanvasPixelData(result, 100, 75);
			expect(pixelData.r).toBeLessThan(50); // cyan이므로 빨간색 낮음
			expect(pixelData.g).toBeGreaterThan(200); // cyan이므로 녹색 높음
			expect(pixelData.b).toBeGreaterThan(200); // cyan이므로 파란색 높음
		});
	});

	describe('scaling behavior', () => {
		it('should upscale small images to fill area', () => {
			const testCanvas = createTestCanvas(100, 100, 'purple');
			const config: FillConfig = { fit: 'fill', width: 400, height: 400 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(400);
		});

		it('should downscale large images to exact dimensions', () => {
			const testCanvas = createTestCanvas(800, 600, 'orange');
			const config: FillConfig = { fit: 'fill', width: 200, height: 150 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});

		it('should handle extreme upscaling', () => {
			const testCanvas = createTestCanvas(10, 10, 'magenta');
			const config: FillConfig = { fit: 'fill', width: 1000, height: 1000 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(1000);
			expect(result.height).toBe(1000);
		});

		it('should handle extreme downscaling', () => {
			const testCanvas = createTestCanvas(2000, 2000, 'lime');
			const config: FillConfig = { fit: 'fill', width: 10, height: 10 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(10);
			expect(result.height).toBe(10);
		});
	});

	describe('padding support', () => {
		it('should apply uniform padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'yellow');
			const config: FillConfig = {
				fit: 'fill',
				width: 100,
				height: 100,
				padding: 10,
			};
			const result = executeFillResize(testCanvas, config);

			// 패딩 포함 크기
			expect(result.width).toBe(120); // 100 + 10*2
			expect(result.height).toBe(120);
		});

		it('should apply object padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'teal');
			const config: FillConfig = {
				fit: 'fill',
				width: 100,
				height: 100,
				padding: { top: 5, right: 10, bottom: 15, left: 20 },
			};
			const result = executeFillResize(testCanvas, config);

			// 패딩 포함 크기
			expect(result.width).toBe(130); // 100 + 10 + 20
			expect(result.height).toBe(120); // 100 + 5 + 15
		});

		it('should apply background color with padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: FillConfig = {
				fit: 'fill',
				width: 100,
				height: 100,
				padding: 10,
				background: 'blue',
			};
			const result = executeFillResize(testCanvas, config);

			// 패딩 영역이 파란색인지 확인
			const paddingPixel = getCanvasPixelData(result, 5, 5);
			expect(paddingPixel.b).toBeGreaterThan(200); // 파란색
			expect(paddingPixel.r).toBeLessThan(50); // 빨간색 아님
		});
	});

	describe('edge cases', () => {
		it('should handle very small target dimensions', () => {
			const testCanvas = createTestCanvas(1000, 1000, 'navy');
			const config: FillConfig = { fit: 'fill', width: 10, height: 10 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(10);
			expect(result.height).toBe(10);
		});

		it('should handle very large target dimensions', () => {
			const testCanvas = createTestCanvas(10, 10, 'maroon');
			const config: FillConfig = { fit: 'fill', width: 2000, height: 2000 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(2000);
			expect(result.height).toBe(2000);
		});

		it('should handle extreme aspect ratio differences', () => {
			const testCanvas = createTestCanvas(1000, 100, 'olive'); // 10:1
			const config: FillConfig = { fit: 'fill', width: 100, height: 1000 }; // 1:10
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(1000);
		});

		it('should handle 1x1 pixel image', () => {
			const testCanvas = createTestCanvas(1, 1, 'white');
			const config: FillConfig = { fit: 'fill', width: 100, height: 100 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(100);
		});

		it('should handle rectangular dimensions', () => {
			const testCanvas = createTestCanvas(400, 200, 'silver');
			const config: FillConfig = { fit: 'fill', width: 100, height: 500 };
			const result = executeFillResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(500);
		});
	});

	describe('quality and smoothing', () => {
		it('should produce output even with distortion', () => {
			const testCanvas = createTestCanvas(800, 200, 'red'); // 매우 가로로 긴 이미지
			const config: FillConfig = { fit: 'fill', width: 200, height: 800 }; // 매우 세로로 긴 목표
			const result = executeFillResize(testCanvas, config);

			// 왜곡되더라도 결과 생성
			expect(result).toBeInstanceOf(HTMLCanvasElement);
			expect(result.width).toBe(200);
			expect(result.height).toBe(800);

			const ctx = result.getContext('2d');
			expect(ctx).not.toBeNull();
		});
	});
});