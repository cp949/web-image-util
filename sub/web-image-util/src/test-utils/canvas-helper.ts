/**
 * 테스트용 Canvas 생성 및 픽셀 데이터 검증 유틸리티
 */

/**
 * 테스트용 Canvas 생성 유틸리티
 * @param width Canvas 너비
 * @param height Canvas 높이
 * @param fillColor 채울 색상 (기본: 'red')
 * @returns 생성된 HTMLCanvasElement
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
 * Canvas에서 특정 위치의 픽셀 데이터 가져오기
 * @param canvas 대상 Canvas
 * @param x X 좌표
 * @param y Y 좌표
 * @returns RGBA 값 객체
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
 * 두 Canvas가 시각적으로 동일한지 확인
 * @param canvas1 첫 번째 Canvas
 * @param canvas2 두 번째 Canvas
 * @param tolerance 허용 오차 (기본: 5)
 * @returns 동일 여부
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
 * 그라디언트가 있는 테스트용 Canvas 생성
 * @param width Canvas 너비
 * @param height Canvas 높이
 * @param startColor 시작 색상
 * @param endColor 끝 색상
 * @returns 생성된 HTMLCanvasElement
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
 * 패턴이 있는 테스트용 Canvas 생성 (체커보드 패턴)
 * @param width Canvas 너비
 * @param height Canvas 높이
 * @param color1 첫 번째 색상
 * @param color2 두 번째 색상
 * @param squareSize 사각형 크기
 * @returns 생성된 HTMLCanvasElement
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
 * Canvas를 Blob으로 변환
 * @param canvas 대상 Canvas
 * @param type 이미지 타입 (기본: 'image/png')
 * @param quality 품질 (0-1)
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