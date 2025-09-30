/**
 * 테스트용 이미지 생성 유틸리티
 */

import { createTestCanvas, canvasToBlob } from './canvas-helper';

/**
 * 테스트용 이미지 Blob 생성
 * @param width 이미지 너비
 * @param height 이미지 높이
 * @param color 배경 색상 (기본: 'red')
 * @param type 이미지 타입 (기본: 'image/png')
 * @returns Blob Promise
 */
export async function createTestImageBlob(
	width: number,
	height: number,
	color: string = 'red',
	type: string = 'image/png',
): Promise<Blob> {
	const canvas = createTestCanvas(width, height, color);
	return canvasToBlob(canvas, type);
}

/**
 * 테스트용 이미지 HTMLImageElement 생성
 * @param width 이미지 너비
 * @param height 이미지 높이
 * @param color 배경 색상 (기본: 'red')
 * @returns HTMLImageElement Promise
 */
export async function createTestImageElement(
	width: number,
	height: number,
	color: string = 'red',
): Promise<HTMLImageElement> {
	const canvas = createTestCanvas(width, height, color);
	const blob = await canvasToBlob(canvas);
	const url = URL.createObjectURL(blob);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};
		img.src = url;
	});
}

/**
 * 테스트용 이미지 Data URL 생성
 * @param width 이미지 너비
 * @param height 이미지 높이
 * @param color 배경 색상 (기본: 'red')
 * @param type 이미지 타입 (기본: 'image/png')
 * @returns Data URL 문자열
 */
export function createTestImageDataUrl(
	width: number,
	height: number,
	color: string = 'red',
	type: string = 'image/png',
): string {
	const canvas = createTestCanvas(width, height, color);
	return canvas.toDataURL(type);
}

/**
 * 이미지 Blob의 실제 크기 측정
 * @param blob 이미지 Blob
 * @returns { width, height } Promise
 */
export async function getImageDimensions(
	blob: Blob,
): Promise<{ width: number; height: number }> {
	const url = URL.createObjectURL(blob);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve({ width: img.width, height: img.height });
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image for dimension measurement'));
		};
		img.src = url;
	});
}

/**
 * Canvas의 실제 크기 측정
 * @param canvas HTMLCanvasElement
 * @returns { width, height }
 */
export function getCanvasDimensions(
	canvas: HTMLCanvasElement,
): { width: number; height: number } {
	return {
		width: canvas.width,
		height: canvas.height,
	};
}

/**
 * 두 이미지 Blob의 크기 비교 (허용 오차 포함)
 * @param blob1 첫 번째 Blob
 * @param blob2 두 번째 Blob
 * @param tolerance 허용 오차 비율 (기본: 0.01 = 1%)
 * @returns 유사 여부
 */
export function compareBlobSizes(
	blob1: Blob,
	blob2: Blob,
	tolerance: number = 0.01,
): boolean {
	const size1 = blob1.size;
	const size2 = blob2.size;
	const diff = Math.abs(size1 - size2);
	const maxSize = Math.max(size1, size2);
	return diff / maxSize <= tolerance;
}