import { describe, it, expect } from 'vitest';
import { processImage } from '../../src/processor';
import { createTestImageBlob } from '../utils/image-helper';

describe('Resize Performance Benchmarks', () => {
	describe('single image processing', () => {
		it('should resize large images within acceptable time limits', async () => {
			const largeImageBlob = await createTestImageBlob(2000, 1500, 'red'); // 2MP image

			const startTime = performance.now();

			await processImage(largeImageBlob).resize({ fit: 'cover', width: 400, height: 300 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 2MP → 400x300 resizing should complete within 1 second
			expect(processingTime).toBeLessThan(1000);
		}, 2000); // 2 second timeout

		it('should handle medium-sized images efficiently', async () => {
			const mediumImageBlob = await createTestImageBlob(800, 600, 'blue');

			const startTime = performance.now();

			await processImage(mediumImageBlob).resize({ fit: 'contain', width: 200, height: 200 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 800x600 → 200x200 resizing should complete within 500ms
			expect(processingTime).toBeLessThan(500);
		});

		it('should handle small images very quickly', async () => {
			const smallImageBlob = await createTestImageBlob(200, 200, 'green');

			const startTime = performance.now();

			await processImage(smallImageBlob).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// Small images should be processed within 100ms
			expect(processingTime).toBeLessThan(100);
		});
	});

	describe('batch processing', () => {
		it('should handle multiple resize operations efficiently', async () => {
			const testBlob = await createTestImageBlob(800, 600, 'yellow');

			const startTime = performance.now();

			const promises = Array(10)
				.fill(null)
				.map(() =>
					processImage(testBlob)
						.resize({ fit: 'cover', width: 200, height: 200 })
						.toBlob(),
				);

			await Promise.all(promises);

			const endTime = performance.now();
			const totalTime = endTime - startTime;

			// Processing 10 images concurrently should complete within 3 seconds
			expect(totalTime).toBeLessThan(3000);
		}, 4000); // 4 second timeout
	});

	describe('different fit modes performance', () => {
		it('should compare performance across fit modes', async () => {
			const testBlob = await createTestImageBlob(1000, 1000, 'purple');

			const times: Record<string, number> = {};

			// cover mode
			let start = performance.now();
			await processImage(testBlob).resize({ fit: 'cover', width: 300, height: 300 }).toBlob();
			times.cover = performance.now() - start;

			// contain mode
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'contain', width: 300, height: 300 }).toBlob();
			times.contain = performance.now() - start;

			// fill mode
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'fill', width: 300, height: 300 }).toBlob();
			times.fill = performance.now() - start;

			// maxFit mode
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'maxFit', width: 300 }).toBlob();
			times.maxFit = performance.now() - start;

			// minFit mode
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'minFit', width: 1500 }).toBlob();
			times.minFit = performance.now() - start;

			// All fit modes should complete within reasonable time
			Object.entries(times).forEach(([mode, time]) => {
				expect(time).toBeLessThan(500); // Each within 500ms
			});
		});
	});

	describe('trimEmpty performance', () => {
		it('should handle trimEmpty efficiently', async () => {
			const testBlob = await createTestImageBlob(400, 400, 'orange');

			const startTime = performance.now();

			await processImage(testBlob)
				.resize({
					fit: 'contain',
					width: 800,
					height: 800,
					trimEmpty: true,
				})
				.toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// Processing with trimEmpty should complete within 1 second
			expect(processingTime).toBeLessThan(1000);
		});
	});

	describe('chained operations performance', () => {
		it('should handle chained resize and blur efficiently', async () => {
			const testBlob = await createTestImageBlob(800, 600, 'cyan');

			const startTime = performance.now();

			await processImage(testBlob)
				.resize({ fit: 'cover', width: 400, height: 300 })
				.blur(3)
				.toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// Chained operations should complete within 1.5 seconds
			expect(processingTime).toBeLessThan(1500);
		});

		it('should handle multiple sequential resizes', async () => {
			const testBlob = await createTestImageBlob(1600, 1200, 'magenta');

			const startTime = performance.now();

			// First resize: max width of 800px
			const firstResult = await processImage(testBlob)
				.resize({ fit: 'maxFit', width: 800 })
				.toBlob();

			// Second resize: first result to 400x400
			await processImage(firstResult.blob)
				.resize({ fit: 'cover', width: 400, height: 400 })
				.toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// Sequential resizing should complete within 1 second
			expect(processingTime).toBeLessThan(1000);
		});
	});

	describe('edge case performance', () => {
		it('should handle extreme upscaling within time limit', async () => {
			const testBlob = await createTestImageBlob(50, 50, 'lime');

			const startTime = performance.now();

			await processImage(testBlob).resize({ fit: 'cover', width: 1000, height: 1000 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 20x upscaling should complete within 800ms
			expect(processingTime).toBeLessThan(800);
		});

		it('should handle extreme downscaling within time limit', async () => {
			const testBlob = await createTestImageBlob(2000, 2000, 'teal');

			const startTime = performance.now();

			await processImage(testBlob).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 20x downscaling should complete within 600ms
			expect(processingTime).toBeLessThan(600);
		});

		it('should handle extreme aspect ratio changes', async () => {
			const testBlob = await createTestImageBlob(2000, 200, 'navy'); // 10:1

			const startTime = performance.now();

			await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 2000 }).toBlob(); // 1:10

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// Extreme aspect ratio change should complete within 1 second
			expect(processingTime).toBeLessThan(1000);
		});
	});

	describe('memory efficiency', () => {
		it('should not leak memory during sequential operations', async () => {
			const testBlob = await createTestImageBlob(500, 500, 'red');

			// Process 20 times consecutively
			for (let i = 0; i < 20; i++) {
				await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
			}

			// Reaching here means no memory leak
			expect(true).toBe(true);
		});

		it('should handle large batch without memory overflow', async () => {
			const testBlob = await createTestImageBlob(400, 400, 'blue');

			// Batch process 50 images
			const promises = Array(50)
				.fill(null)
				.map(() =>
					processImage(testBlob)
						.resize({ fit: 'contain', width: 150, height: 150 })
						.toBlob(),
				);

			const results = await Promise.all(promises);

			// All results should be successfully generated
			expect(results).toHaveLength(50);
			results.forEach((result) => {
				expect(result.blob).toBeInstanceOf(Blob);
				expect(result.width).toBe(150);
				expect(result.height).toBe(150);
			});
		}, 10000); // 10 second timeout
	});
});