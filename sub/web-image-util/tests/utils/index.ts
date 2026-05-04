/**
 * Test utility module exports
 */

export {
  canvasToBlob,
  compareCanvases,
  createCheckerboardCanvas,
  createGradientCanvas,
  createTestCanvas,
  getCanvasPixelData,
} from './canvas-helper';

export {
  compareBlobSizes,
  createTestImageBlob,
  createTestImageDataUrl,
  createTestImageElement,
  getCanvasDimensions,
  getImageDimensions,
} from './image-helper';

export {
  createAbortableFetchMock,
  createByteStreamBody,
  createSuccessResponse,
  mockImgElement,
  withFetchMock,
} from './fetch-helper';

export {
  makeLargeSvg,
  makeLargeSvgMultibyte,
  VALID_SVG,
  VALID_SVG_WITH_DIMENSIONS,
  VALID_SVG_WITH_RECT,
  XSS_SVG_FOREIGN_OBJECT,
  XSS_SVG_ONLOAD,
  XSS_SVG_ONLOAD_WITH_SCRIPT,
  XSS_SVG_SCRIPT,
  XSS_SVG_SCRIPT_SRC,
} from './svg-fixtures';
