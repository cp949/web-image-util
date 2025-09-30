import { describe, it, expect } from 'vitest';
import { executeCoverResize } from './cover';
import { createTestCanvas, getCanvasPixelData } from '../../test-utils/canvas-helper';
import type { CoverConfig } from '../../types/resize-config';

describe('Cover Resize Engine', () => {
	describe('basic cover resizing', () => {
		it('should resize to exact dimensions maintaining aspect ratio', () => {
			const testCanvas = createTestCanvas(400, 300, 'red'); // 4:3 비율
			const config: CoverConfig = { fit: 'cover', width: 200, height: 200 };
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(200);
		});

		it('should handle landscape to portrait conversion', () => {
			const testCanvas = createTestCanvas(400, 200, 'blue'); // 2:1 가로
			const config: CoverConfig = { fit: 'cover', width: 100, height: 200 }; // 1:2 세로
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(200);
		});

		it('should handle portrait to landscape conversion', () => {
			const testCanvas = createTestCanvas(200, 400, 'green'); // 1:2 세로
			const config: CoverConfig = { fit: 'cover', width: 300, height: 150 }; // 2:1 가로
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(300);
			expect(result.height).toBe(150);
		});
	});

	describe('cropping behavior', () => {
		it('should crop image when aspect ratios differ', () => {
			const testCanvas = createTestCanvas(400, 300, 'red'); // 4:3
			const config: CoverConfig = { fit: 'cover', width: 100, height: 200 }; // 1:2
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(200);

			// 이미지가 잘렸더라도 빨간색 유지
			const pixelData = getCanvasPixelData(result, 50, 100);
			expect(pixelData.r).toBeGreaterThan(200); // 빨간색
		});

		it('should center crop the image', () => {
			const testCanvas = createTestCanvas(400, 200, 'yellow');
			const config: CoverConfig = { fit: 'cover', width: 200, height: 200 }; // 정사각형으로 자르기
			const result = executeCoverResize(testCanvas, config);

			// 정사각형으로 잘렸고 중앙 부분이 보여야 함
			expect(result.width).toBe(200);
			expect(result.height).toBe(200);
		});
	});

	describe('scaling behavior', () => {
		it('should upscale small images to fill area', () => {
			const testCanvas = createTestCanvas(100, 100, 'purple');
			const config: CoverConfig = { fit: 'cover', width: 400, height: 400 };
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(400);
		});

		it('should downscale large images to fit area', () => {
			const testCanvas = createTestCanvas(800, 600, 'orange');
			const config: CoverConfig = { fit: 'cover', width: 200, height: 150 };
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});

		it('should handle same aspect ratio without cropping', () => {
			const testCanvas = createTestCanvas(400, 300, 'cyan'); // 4:3
			const config: CoverConfig = { fit: 'cover', width: 200, height: 150 }; // 4:3
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});
	});

	describe('padding support', () => {
		it('should apply uniform padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: CoverConfig = {
				fit: 'cover',
				width: 100,
				height: 100,
				padding: 10,
			};
			const result = executeCoverResize(testCanvas, config);

			// 패딩 포함 크기
			expect(result.width).toBe(120); // 100 + 10*2
			expect(result.height).toBe(120);
		});

		it('should apply object padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'green');
			const config: CoverConfig = {
				fit: 'cover',
				width: 100,
				height: 100,
				padding: { top: 5, right: 10, bottom: 15, left: 20 },
			};
			const result = executeCoverResize(testCanvas, config);

			// 패딩 포함 크기
			expect(result.width).toBe(130); // 100 + 10 + 20
			expect(result.height).toBe(120); // 100 + 5 + 15
		});

		it('should apply background color with padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: CoverConfig = {
				fit: 'cover',
				width: 100,
				height: 100,
				padding: 10,
				background: 'blue',
			};
			const result = executeCoverResize(testCanvas, config);

			// 패딩 영역이 파란색인지 확인
			const paddingPixel = getCanvasPixelData(result, 5, 5);
			expect(paddingPixel.b).toBeGreaterThan(200); // 파란색
			expect(paddingPixel.r).toBeLessThan(50); // 빨간색 아님
		});
	});

	describe('edge cases', () => {
		it('should handle very small target dimensions', () => {
			const testCanvas = createTestCanvas(1000, 1000, 'magenta');
			const config: CoverConfig = { fit: 'cover', width: 10, height: 10 };
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(10);
			expect(result.height).toBe(10);
		});

		it('should handle very large target dimensions', () => {
			const testCanvas = createTestCanvas(10, 10, 'lime');
			const config: CoverConfig = { fit: 'cover', width: 2000, height: 2000 };
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(2000);
			expect(result.height).toBe(2000);
		});

		it('should handle extreme aspect ratio differences', () => {
			const testCanvas = createTestCanvas(1000, 100, 'teal'); // 10:1
			const config: CoverConfig = { fit: 'cover', width: 100, height: 1000 }; // 1:10
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(1000);
		});

		it('should handle 1x1 pixel image', () => {
			const testCanvas = createTestCanvas(1, 1, 'black');
			const config: CoverConfig = { fit: 'cover', width: 100, height: 100 };
			const result = executeCoverResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(100);
		});
	});

	describe('quality and smoothing', () => {
		it('should produce high quality output', () => {
			const testCanvas = createTestCanvas(800, 600, 'red');
			const config: CoverConfig = { fit: 'cover', width: 400, height: 300 };
			const result = executeCoverResize(testCanvas, config);

			// 결과 캔버스가 생성되고 크기가 맞는지 확인
			expect(result).toBeInstanceOf(HTMLCanvasElement);
			expect(result.width).toBe(400);
			expect(result.height).toBe(300);

			// 컨텍스트가 생성 가능한지 확인
			const ctx = result.getContext('2d');
			expect(ctx).not.toBeNull();
		});
	});
});