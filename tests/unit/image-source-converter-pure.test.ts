/**
 * ImageSourceConverter 기본 구조 테스트
 *
 * @description Phase 1.1 완료 조건 검증:
 * - ImageSourceConverter 클래스 기본 구조 완성
 * - 모든 public 메서드 시그니처 정의
 * - 기본 테스트 통과 (95% 커버리지)
 * - TypeScript 컴파일 에러 없음
 */

import { describe, test, expect } from 'vitest';
import { ImageSourceConverter, convertTo } from '../../packages/web-image-util/src/utils/image-source-converter';

describe('ImageSourceConverter 기본 구조', () => {
  // 테스트용 모킹 데이터
  const mockBlob = new Blob(['test'], { type: 'image/png' });
  const mockDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';

  describe('팩토리 메서드', () => {
    test('from() 팩토리 메서드로 인스턴스 생성', () => {
      const converter = ImageSourceConverter.from(mockBlob);
      expect(converter).toBeInstanceOf(ImageSourceConverter);
    });

    test('다양한 소스 타입으로 인스턴스 생성', () => {
      // Blob 소스
      const blobConverter = ImageSourceConverter.from(mockBlob);
      expect(blobConverter).toBeInstanceOf(ImageSourceConverter);

      // Data URL 소스
      const dataURLConverter = ImageSourceConverter.from(mockDataURL);
      expect(dataURLConverter).toBeInstanceOf(ImageSourceConverter);

      // SVG 소스
      const svgConverter = ImageSourceConverter.from(mockSvg);
      expect(svgConverter).toBeInstanceOf(ImageSourceConverter);

      // URL 소스
      const urlConverter = ImageSourceConverter.from('https://example.com/image.png');
      expect(urlConverter).toBeInstanceOf(ImageSourceConverter);
    });
  });

  describe('메서드 존재 확인', () => {
    const converter = ImageSourceConverter.from(mockBlob);

    test('변환 메서드들이 정의되어 있음', () => {
      expect(typeof converter.toCanvas).toBe('function');
      expect(typeof converter.toBlob).toBe('function');
      expect(typeof converter.toDataURL).toBe('function');
      expect(typeof converter.toElement).toBe('function');
      expect(typeof converter.toFile).toBe('function');
    });

    test('유틸리티 메서드들이 정의되어 있음', () => {
      expect(typeof converter.getSourceType).toBe('function');
      expect(typeof converter.getSource).toBe('function');
    });
  });

  describe('유틸리티 메서드 동작', () => {
    test('getSource()가 원본 소스를 반환', () => {
      const converter = ImageSourceConverter.from(mockBlob);
      expect(converter.getSource()).toBe(mockBlob);
    });

    test('getSourceType()이 소스 타입을 반환', () => {
      const blobConverter = ImageSourceConverter.from(mockBlob);
      expect(blobConverter.getSourceType()).toBe('blob');

      const dataURLConverter = ImageSourceConverter.from(mockDataURL);
      expect(dataURLConverter.getSourceType()).toBe('dataurl');

      const svgConverter = ImageSourceConverter.from(mockSvg);
      expect(svgConverter.getSourceType()).toBe('svg');
    });
  });

  describe('실제 변환 메서드들 (Phase 1.3 완료)', () => {
    const converter = ImageSourceConverter.from(mockBlob);

    test('toCanvas()가 HTMLCanvasElement를 반환', async () => {
      const canvas = await converter.toCanvas();
      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    });

    test('toBlob()이 Blob을 반환', async () => {
      const blob = await converter.toBlob();
      expect(blob).toBeInstanceOf(Blob);
    });

    test('toDataURL()이 문자열을 반환', async () => {
      const dataURL = await converter.toDataURL();
      expect(typeof dataURL).toBe('string');
      expect(dataURL).toMatch(/^data:image\//);
    });

    test('toElement()가 HTMLImageElement를 반환', async () => {
      const element = await converter.toElement();
      expect(element).toBeInstanceOf(HTMLImageElement);
    });

    test('toFile()이 File 객체를 반환', async () => {
      const file = await converter.toFile({ filename: 'test.png' });
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.png');
    });
  });
});

describe('함수형 API (convertTo)', () => {
  const mockBlob = new Blob(['test'], { type: 'image/png' });

  test('convertTo 함수가 정의되어 있음', () => {
    expect(typeof convertTo).toBe('function');
  });

  test('지원하지 않는 타겟으로 변환 시 에러', async () => {
    await expect(convertTo(mockBlob, 'invalid' as any)).rejects.toThrow('지원하지 않는 변환 타겟입니다');
  });

  test('file 변환 시 filename 없으면 에러', async () => {
    await expect(convertTo(mockBlob, 'file')).rejects.toThrow('File 변환에는 filename 옵션이 필요합니다');
  });

  test('실제 변환 기능 동작 (Phase 1.3 완료)', async () => {
    // 실제 변환이 동작하는지 확인
    const canvas = await convertTo(mockBlob, 'canvas');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);

    const blob = await convertTo(mockBlob, 'blob');
    expect(blob).toBeInstanceOf(Blob);

    const dataURL = await convertTo(mockBlob, 'dataURL');
    expect(typeof dataURL).toBe('string');
    expect(dataURL).toMatch(/^data:image\//);

    const element = await convertTo(mockBlob, 'element');
    expect(element).toBeInstanceOf(HTMLImageElement);
  });
});

describe('타입 안전성 테스트', () => {
  test('ConvertedType 타입 매핑이 올바름', () => {
    // 이는 컴파일 타임 테스트이므로 TypeScript가 컴파일되면 성공
    const mockBlob = new Blob(['test'], { type: 'image/png' });

    // 타입 추론이 올바르게 작동하는지 확인
    const canvasPromise: Promise<HTMLCanvasElement> = convertTo(mockBlob, 'canvas');
    const blobPromise: Promise<Blob> = convertTo(mockBlob, 'blob');
    const dataURLPromise: Promise<string> = convertTo(mockBlob, 'dataURL');
    const elementPromise: Promise<HTMLImageElement> = convertTo(mockBlob, 'element');
    const filePromise: Promise<File> = convertTo(mockBlob, 'file', { filename: 'test.png' });

    // 실제로는 스텁이므로 호출하지 않고, 타입만 확인
    expect(canvasPromise).toBeDefined();
    expect(blobPromise).toBeDefined();
    expect(dataURLPromise).toBeDefined();
    expect(elementPromise).toBeDefined();
    expect(filePromise).toBeDefined();
  });
});