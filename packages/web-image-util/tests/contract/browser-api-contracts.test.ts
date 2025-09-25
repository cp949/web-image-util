/**
 * Browser API 계약 테스트
 *
 * 목적: 브라우저 API 호출 패턴과 계약을 검증
 * 환경: Node.js (mocking 사용)
 * 범위: Canvas, Image, FileReader, URL 생명주기
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Browser API 계약 테스트', () => {
  // 모든 브라우저 API를 모킹
  beforeEach(() => {
    // HTMLCanvasElement 모킹
    global.HTMLCanvasElement = vi.fn().mockImplementation(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
        getImageData: vi.fn(),
        putImageData: vi.fn(),
        createImageData: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillStyle: '',
        globalAlpha: 1,
      }),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,'),
      toBlob: vi.fn().mockImplementation((callback) => {
        callback(new Blob([''], { type: 'image/png' }));
      }),
    })) as any;

    // document 모킹
    global.document = {
      createElement: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return new global.HTMLCanvasElement();
        }
        if (tagName === 'img') {
          return {
            src: '',
            width: 0,
            height: 0,
            onload: null,
            onerror: null,
            crossOrigin: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {};
      }),
    } as any;

    // URL 모킹
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: vi.fn(),
    } as any;

    // FileReader 모킹
    global.FileReader = vi.fn().mockImplementation(() => ({
      readAsDataURL: vi.fn(),
      readAsArrayBuffer: vi.fn(),
      onload: null,
      onerror: null,
      result: null,
    })) as any;

    // Blob 모킹
    global.Blob = vi.fn().mockImplementation((parts, options) => ({
      size: parts?.join('').length || 0,
      type: options?.type || '',
      slice: vi.fn(),
    })) as any;
  });

  describe('Canvas API 계약', () => {
    it('Canvas 생성 시 올바른 패턴 사용', () => {
      // Canvas 생성 패턴 검증
      const canvas = document.createElement('canvas');

      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(canvas).toBeDefined();
    });

    it('Canvas Context 획득 시 올바른 매개변수 전달', () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      expect(canvas.getContext).toHaveBeenCalledWith('2d');
      expect(context).toBeDefined();
    });

    it('Canvas 크기 설정 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 200;

      expect(canvas.width).toBe(300);
      expect(canvas.height).toBe(200);
    });

    it('Canvas 출력 메서드 호출 패턴 검증', () => {
      const canvas = document.createElement('canvas');

      // toDataURL 호출 패턴
      canvas.toDataURL('image/png', 0.8);
      expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 0.8);

      // toBlob 호출 패턴
      const callback = vi.fn();
      canvas.toBlob(callback, 'image/jpeg', 0.8);
      expect(canvas.toBlob).toHaveBeenCalledWith(callback, 'image/jpeg', 0.8);
    });
  });

  describe('Image 로딩 계약', () => {
    it('Image 엘리먼트 생성 패턴 검증', () => {
      const img = document.createElement('img');

      expect(document.createElement).toHaveBeenCalledWith('img');
      expect(img).toBeDefined();
      expect(img).toHaveProperty('src');
      expect(img).toHaveProperty('onload');
      expect(img).toHaveProperty('onerror');
    });

    it('Image 로딩 이벤트 리스너 패턴 검증', () => {
      const img = document.createElement('img');
      const onload = vi.fn();
      const onerror = vi.fn();

      img.addEventListener('load', onload);
      img.addEventListener('error', onerror);

      expect(img.addEventListener).toHaveBeenCalledWith('load', onload);
      expect(img.addEventListener).toHaveBeenCalledWith('error', onerror);
    });

    it('crossOrigin 설정 패턴 검증', () => {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';

      expect(img.crossOrigin).toBe('anonymous');
    });
  });

  describe('FileReader API 계약', () => {
    it('FileReader 인스턴스 생성 패턴 검증', () => {
      const reader = new FileReader();

      expect(FileReader).toHaveBeenCalled();
      expect(reader).toHaveProperty('readAsDataURL');
      expect(reader).toHaveProperty('readAsArrayBuffer');
    });

    it('파일 읽기 메서드 호출 패턴 검증', () => {
      const reader = new FileReader();
      const mockFile = new Blob(['test'], { type: 'image/png' });

      reader.readAsDataURL(mockFile);
      expect(reader.readAsDataURL).toHaveBeenCalledWith(mockFile);

      reader.readAsArrayBuffer(mockFile);
      expect(reader.readAsArrayBuffer).toHaveBeenCalledWith(mockFile);
    });

    it('이벤트 핸들러 설정 패턴 검증', () => {
      const reader = new FileReader();
      const onload = vi.fn();
      const onerror = vi.fn();

      reader.onload = onload;
      reader.onerror = onerror;

      expect(reader.onload).toBe(onload);
      expect(reader.onerror).toBe(onerror);
    });
  });

  describe('URL 생명주기 계약', () => {
    it('URL.createObjectURL 호출 패턴 검증', () => {
      const mockBlob = new Blob(['test'], { type: 'image/png' });
      const url = URL.createObjectURL(mockBlob);

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(url).toBe('blob:mock-url');
    });

    it('URL.revokeObjectURL 호출 패턴 검증', () => {
      const mockUrl = 'blob:mock-url';
      URL.revokeObjectURL(mockUrl);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });

    it('Blob URL 생명주기 관리 패턴 검증', () => {
      const mockBlob = new Blob(['test'], { type: 'image/png' });

      // 생성
      const url = URL.createObjectURL(mockBlob);
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);

      // 정리
      URL.revokeObjectURL(url);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    });
  });

  describe('Canvas Context 메서드 계약', () => {
    it('이미지 그리기 메서드 호출 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const mockImg = document.createElement('img');

      // drawImage 호출 패턴들
      ctx?.drawImage(mockImg, 0, 0);
      expect(ctx?.drawImage).toHaveBeenCalledWith(mockImg, 0, 0);

      ctx?.drawImage(mockImg, 0, 0, 100, 100);
      expect(ctx?.drawImage).toHaveBeenCalledWith(mockImg, 0, 0, 100, 100);

      ctx?.drawImage(mockImg, 0, 0, 50, 50, 0, 0, 100, 100);
      expect(ctx?.drawImage).toHaveBeenCalledWith(mockImg, 0, 0, 50, 50, 0, 0, 100, 100);
    });

    it('이미지 데이터 조작 메서드 호출 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // getImageData 호출
      ctx?.getImageData(0, 0, 100, 100);
      expect(ctx?.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);

      // putImageData 호출
      const mockImageData = ctx?.createImageData(100, 100);
      if (mockImageData) {
        ctx?.putImageData(mockImageData, 0, 0);
        expect(ctx?.putImageData).toHaveBeenCalledWith(mockImageData, 0, 0);
      }
    });

    it('Canvas 상태 관리 메서드 호출 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      ctx?.save();
      expect(ctx?.save).toHaveBeenCalled();

      ctx?.restore();
      expect(ctx?.restore).toHaveBeenCalled();

      ctx?.clearRect(0, 0, 100, 100);
      expect(ctx?.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    });

    it('Canvas 변환 메서드 호출 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      ctx?.scale(2, 2);
      expect(ctx?.scale).toHaveBeenCalledWith(2, 2);

      ctx?.translate(10, 20);
      expect(ctx?.translate).toHaveBeenCalledWith(10, 20);

      ctx?.rotate(Math.PI / 4);
      expect(ctx?.rotate).toHaveBeenCalledWith(Math.PI / 4);
    });
  });
});