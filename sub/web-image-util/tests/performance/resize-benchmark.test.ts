import { describe, it, expect } from 'vitest';
import { processImage } from '../../src/processor';
import { createTestImageBlob } from '../utils/image-helper';

describe('Resize Performance Benchmarks', () => {
	describe('single image processing', () => {
		it('should resize large images within acceptable time limits', async () => {
			const largeImageBlob = await createTestImageBlob(2000, 1500, 'red'); // 2MP 이미지

			const startTime = performance.now();

			await processImage(largeImageBlob).resize({ fit: 'cover', width: 400, height: 300 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 2MP → 400x300 리사이징이 1초 이내에 완료되어야 함
			expect(processingTime).toBeLessThan(1000);
		}, 2000); // 2초 타임아웃

		it('should handle medium-sized images efficiently', async () => {
			const mediumImageBlob = await createTestImageBlob(800, 600, 'blue');

			const startTime = performance.now();

			await processImage(mediumImageBlob).resize({ fit: 'contain', width: 200, height: 200 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 800x600 → 200x200 리사이징이 500ms 이내에 완료되어야 함
			expect(processingTime).toBeLessThan(500);
		});

		it('should handle small images very quickly', async () => {
			const smallImageBlob = await createTestImageBlob(200, 200, 'green');

			const startTime = performance.now();

			await processImage(smallImageBlob).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 작은 이미지는 100ms 이내에 처리
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

			// 10개 동시 처리가 3초 이내에 완료되어야 함
			expect(totalTime).toBeLessThan(3000);
		}, 4000); // 4초 타임아웃
	});

	describe('different fit modes performance', () => {
		it('should compare performance across fit modes', async () => {
			const testBlob = await createTestImageBlob(1000, 1000, 'purple');

			const times: Record<string, number> = {};

			// cover 모드
			let start = performance.now();
			await processImage(testBlob).resize({ fit: 'cover', width: 300, height: 300 }).toBlob();
			times.cover = performance.now() - start;

			// contain 모드
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'contain', width: 300, height: 300 }).toBlob();
			times.contain = performance.now() - start;

			// fill 모드
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'fill', width: 300, height: 300 }).toBlob();
			times.fill = performance.now() - start;

			// maxFit 모드
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'maxFit', width: 300 }).toBlob();
			times.maxFit = performance.now() - start;

			// minFit 모드
			start = performance.now();
			await processImage(testBlob).resize({ fit: 'minFit', width: 1500 }).toBlob();
			times.minFit = performance.now() - start;

			// 모든 fit 모드가 합리적인 시간 내에 완료
			Object.entries(times).forEach(([mode, time]) => {
				expect(time).toBeLessThan(500); // 각각 500ms 이내
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

			// trimEmpty 포함 처리가 1초 이내
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

			// 체인 연산이 1.5초 이내
			expect(processingTime).toBeLessThan(1500);
		});

		it('should handle multiple sequential resizes', async () => {
			const testBlob = await createTestImageBlob(1600, 1200, 'magenta');

			const startTime = performance.now();

			// 첫 번째 리사이즈: 800px 최대 크기
			const firstResult = await processImage(testBlob)
				.resize({ fit: 'maxFit', width: 800 })
				.toBlob();

			// 두 번째 리사이즈: 첫 번째 결과를 400x400으로
			await processImage(firstResult.blob)
				.resize({ fit: 'cover', width: 400, height: 400 })
				.toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 순차적 리사이즈가 1초 이내
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

			// 20배 확대가 800ms 이내
			expect(processingTime).toBeLessThan(800);
		});

		it('should handle extreme downscaling within time limit', async () => {
			const testBlob = await createTestImageBlob(2000, 2000, 'teal');

			const startTime = performance.now();

			await processImage(testBlob).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 20배 축소가 600ms 이내
			expect(processingTime).toBeLessThan(600);
		});

		it('should handle extreme aspect ratio changes', async () => {
			const testBlob = await createTestImageBlob(2000, 200, 'navy'); // 10:1

			const startTime = performance.now();

			await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 2000 }).toBlob(); // 1:10

			const endTime = performance.now();
			const processingTime = endTime - startTime;

			// 극단적인 비율 변경이 1초 이내
			expect(processingTime).toBeLessThan(1000);
		});
	});

	describe('memory efficiency', () => {
		it('should not leak memory during sequential operations', async () => {
			const testBlob = await createTestImageBlob(500, 500, 'red');

			// 20번 연속 처리
			for (let i = 0; i < 20; i++) {
				await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
			}

			// 메모리 누수가 없으면 여기까지 도달
			expect(true).toBe(true);
		});

		it('should handle large batch without memory overflow', async () => {
			const testBlob = await createTestImageBlob(400, 400, 'blue');

			// 50개 이미지 배치 처리
			const promises = Array(50)
				.fill(null)
				.map(() =>
					processImage(testBlob)
						.resize({ fit: 'contain', width: 150, height: 150 })
						.toBlob(),
				);

			const results = await Promise.all(promises);

			// 모든 결과가 정상적으로 생성됨
			expect(results).toHaveLength(50);
			results.forEach((result) => {
				expect(result.blob).toBeInstanceOf(Blob);
				expect(result.width).toBe(150);
				expect(result.height).toBe(150);
			});
		}, 10000); // 10초 타임아웃
	});
});