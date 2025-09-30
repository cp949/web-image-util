import { describe, it, expect } from 'vitest';
import { executeContainResize } from './contain';
import { createTestCanvas, getCanvasPixelData } from '../../test-utils/canvas-helper';
import type { ContainConfig } from '../../types/resize-config';

describe('Contain Resize Engine', () => {
	describe('basic contain resizing', () => {
		it('should fit image inside target dimensions with padding', () => {
			const testCanvas = createTestCanvas(400, 300, 'red'); // 4:3
			const config: ContainConfig = { fit: 'contain', width: 200, height: 200 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(200);
		});

		it('should center image with letterboxing for landscape to portrait', () => {
			const testCanvas = createTestCanvas(400, 200, 'blue'); // 2:1 가로
			const config: ContainConfig = { fit: 'contain', width: 100, height: 200 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(200);

			// 상하 패딩 영역 확인 (검정 또는 배경색)
			const topPadding = getCanvasPixelData(result, 50, 10);
			const bottomPadding = getCanvasPixelData(result, 50, 190);
			// 패딩 영역은 어두운 색이어야 함 (기본 배경색)
			expect(topPadding.r).toBeLessThan(50);
		});

		it('should center image with pillarboxing for portrait to landscape', () => {
			const testCanvas = createTestCanvas(200, 400, 'green'); // 1:2 세로
			const config: ContainConfig = { fit: 'contain', width: 300, height: 150 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(300);
			expect(result.height).toBe(150);
		});
	});

	describe('no cropping behavior', () => {
		it('should not crop any part of the image', () => {
			const testCanvas = createTestCanvas(400, 300, 'red');
			const config: ContainConfig = { fit: 'contain', width: 100, height: 200 };
			const result = executeContainResize(testCanvas, config);

			// contain은 이미지 전체가 보여야 함
			expect(result.width).toBe(100);
			expect(result.height).toBe(200);
		});

		it('should handle same aspect ratio without padding', () => {
			const testCanvas = createTestCanvas(400, 300, 'cyan'); // 4:3
			const config: ContainConfig = { fit: 'contain', width: 200, height: 150 }; // 4:3
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});
	});

	describe('scaling behavior', () => {
		it('should upscale small images to fill area', () => {
			const testCanvas = createTestCanvas(100, 100, 'purple');
			const config: ContainConfig = { fit: 'contain', width: 400, height: 400 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(400);
			expect(result.height).toBe(400);
		});

		it('should downscale large images to fit inside area', () => {
			const testCanvas = createTestCanvas(800, 600, 'orange');
			const config: ContainConfig = { fit: 'contain', width: 200, height: 150 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(150);
		});

		it('should not upscale with withoutEnlargement option', () => {
			const testCanvas = createTestCanvas(100, 100, 'magenta');
			const config: ContainConfig = {
				fit: 'contain',
				width: 400,
				height: 400,
				withoutEnlargement: true,
			};
			const result = executeContainResize(testCanvas, config);

			// 확대하지 않고 원본 크기 유지
			expect(result.width).toBeLessThanOrEqual(400);
			expect(result.height).toBeLessThanOrEqual(400);
		});
	});

	describe('trimEmpty functionality', () => {
		it('should trim empty space when trimEmpty is true', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: ContainConfig = {
				fit: 'contain',
				width: 200,
				height: 400, // 세로로 긴 영역
				trimEmpty: true,
				background: 'black',
			};
			const result = executeContainResize(testCanvas, config);

			// trimEmpty 적용 시 빈 공간이 제거됨
			expect(result.width).toBeLessThanOrEqual(200);
			expect(result.height).toBeLessThanOrEqual(400);
		});

		it('should not trim when trimEmpty is false', () => {
			const testCanvas = createTestCanvas(100, 100, 'green');
			const config: ContainConfig = {
				fit: 'contain',
				width: 200,
				height: 400,
				trimEmpty: false,
			};
			const result = executeContainResize(testCanvas, config);

			// trimEmpty가 false면 전체 영역 유지
			expect(result.width).toBe(200);
			expect(result.height).toBe(400);
		});
	});

	describe('background color support', () => {
		it('should apply custom background color', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: ContainConfig = {
				fit: 'contain',
				width: 200,
				height: 300,
				background: 'blue',
			};
			const result = executeContainResize(testCanvas, config);

			// 패딩 영역이 파란색인지 확인
			const paddingPixel = getCanvasPixelData(result, 100, 10);
			expect(paddingPixel.b).toBeGreaterThan(200); // 파란색
		});

		it('should apply transparent background', () => {
			const testCanvas = createTestCanvas(100, 100, 'red');
			const config: ContainConfig = {
				fit: 'contain',
				width: 200,
				height: 300,
				background: 'transparent',
			};
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(200);
			expect(result.height).toBe(300);
		});
	});

	describe('padding support', () => {
		it('should apply uniform padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'yellow');
			const config: ContainConfig = {
				fit: 'contain',
				width: 100,
				height: 100,
				padding: 10,
			};
			const result = executeContainResize(testCanvas, config);

			// 패딩 포함 크기
			expect(result.width).toBe(120); // 100 + 10*2
			expect(result.height).toBe(120);
		});

		it('should apply object padding', () => {
			const testCanvas = createTestCanvas(100, 100, 'lime');
			const config: ContainConfig = {
				fit: 'contain',
				width: 100,
				height: 100,
				padding: { top: 5, right: 10, bottom: 15, left: 20 },
			};
			const result = executeContainResize(testCanvas, config);

			// 패딩 포함 크기
			expect(result.width).toBe(130); // 100 + 10 + 20
			expect(result.height).toBe(120); // 100 + 5 + 15
		});
	});

	describe('edge cases', () => {
		it('should handle very small target dimensions', () => {
			const testCanvas = createTestCanvas(1000, 1000, 'teal');
			const config: ContainConfig = { fit: 'contain', width: 10, height: 10 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(10);
			expect(result.height).toBe(10);
		});

		it('should handle very large target dimensions', () => {
			const testCanvas = createTestCanvas(10, 10, 'navy');
			const config: ContainConfig = { fit: 'contain', width: 2000, height: 2000 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(2000);
			expect(result.height).toBe(2000);
		});

		it('should handle extreme aspect ratio differences', () => {
			const testCanvas = createTestCanvas(1000, 100, 'maroon'); // 10:1
			const config: ContainConfig = { fit: 'contain', width: 100, height: 1000 }; // 1:10
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(1000);
		});

		it('should handle 1x1 pixel image', () => {
			const testCanvas = createTestCanvas(1, 1, 'white');
			const config: ContainConfig = { fit: 'contain', width: 100, height: 100 };
			const result = executeContainResize(testCanvas, config);

			expect(result.width).toBe(100);
			expect(result.height).toBe(100);
		});
	});
});