/**
 * Canvas creation and pixel data validation utilities for testing
 */

/**
 * Canvas creation utility for testing
 * @param width Canvas width
 * @param height Canvas height
 * @param fillColor Fill color (default: 'red')
 * @returns Generated HTMLCanvasElement
 */
export function createTestCanvas(
	width: number,
	height: number,
	fillColor: string = 'red',
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Cannot create canvas context');
	}

	ctx.fillStyle = fillColor;
	ctx.fillRect(0, 0, width, height);

	return canvas;
}

/**
 * Get pixel data at specific position from Canvas
 * @param canvas Target Canvas
 * @param x X coordinate
 * @param y Y coordinate
 * @returns RGBA values object
 */
export function getCanvasPixelData(
	canvas: HTMLCanvasElement,
	x: number,
	y: number,
): { r: number; g: number; b: number; a: number } {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Cannot get canvas context');
	}

	const imageData = ctx.getImageData(x, y, 1, 1);
	const [r, g, b, a] = imageData.data;

	return { r, g, b, a };
}

/**
 * Check if two Canvases are visually identical
 * @param canvas1 First Canvas
 * @param canvas2 Second Canvas
 * @param tolerance Tolerance threshold (default: 5)
 * @returns Whether they are identical
 */
export function compareCanvases(
	canvas1: HTMLCanvasElement,
	canvas2: HTMLCanvasElement,
	tolerance: number = 5,
): boolean {
	if (canvas1.width !== canvas2.width || canvas1.height !== canvas2.height) {
		return false;
	}

	const ctx1 = canvas1.getContext('2d');
	const ctx2 = canvas2.getContext('2d');

	if (!ctx1 || !ctx2) {
		return false;
	}

	const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
	const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;

	for (let i = 0; i < data1.length; i++) {
		if (Math.abs(data1[i] - data2[i]) > tolerance) {
			return false;
		}
	}

	return true;
}

/**
 * Create test Canvas with gradient
 * @param width Canvas width
 * @param height Canvas height
 * @param startColor Starting color
 * @param endColor Ending color
 * @returns Generated HTMLCanvasElement
 */
export function createGradientCanvas(
	width: number,
	height: number,
	startColor: string = 'red',
	endColor: string = 'blue',
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Cannot create canvas context');
	}

	const gradient = ctx.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, startColor);
	gradient.addColorStop(1, endColor);

	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	return canvas;
}

/**
 * Create test Canvas with checkerboard pattern
 * @param width Canvas width
 * @param height Canvas height
 * @param color1 First color
 * @param color2 Second color
 * @param squareSize Square size
 * @returns Generated HTMLCanvasElement
 */
export function createCheckerboardCanvas(
	width: number,
	height: number,
	color1: string = 'black',
	color2: string = 'white',
	squareSize: number = 10,
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Cannot create canvas context');
	}

	for (let y = 0; y < height; y += squareSize) {
		for (let x = 0; x < width; x += squareSize) {
			const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
			const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
			ctx.fillStyle = isEvenRow === isEvenCol ? color1 : color2;
			ctx.fillRect(x, y, squareSize, squareSize);
		}
	}

	return canvas;
}

/**
 * Convert Canvas to Blob
 * @param canvas Target Canvas
 * @param type Image type (default: 'image/png')
 * @param quality Quality (0-1)
 * @returns Blob Promise
 */
export async function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: string = 'image/png',
	quality?: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('Failed to convert canvas to blob'));
				}
			},
			type,
			quality,
		);
	});
}