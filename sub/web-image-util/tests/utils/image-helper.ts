/**
 * Image creation utilities for testing
 */

import { createTestCanvas, canvasToBlob } from './canvas-helper';

/**
 * Create test image Blob
 * @param width Image width
 * @param height Image height
 * @param color Background color (default: 'red')
 * @param type Image type (default: 'image/png')
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
 * Create test image HTMLImageElement
 * @param width Image width
 * @param height Image height
 * @param color Background color (default: 'red')
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
 * Create test image Data URL
 * @param width Image width
 * @param height Image height
 * @param color Background color (default: 'red')
 * @param type Image type (default: 'image/png')
 * @returns Data URL string
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
 * Measure actual dimensions of image Blob
 * @param blob Image Blob
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
 * Measure actual dimensions of Canvas
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
 * Compare sizes of two image Blobs (with tolerance)
 * @param blob1 First Blob
 * @param blob2 Second Blob
 * @param tolerance Tolerance ratio (default: 0.01 = 1%)
 * @returns Whether sizes are similar
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