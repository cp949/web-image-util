/**
 * 타입 가드 함수 순수 로직 테스트
 * Node.js 환경에서 실행 가능한 브라우저 API 독립적 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  isDataURL,
  isHttpURL,
  isSVGString,
  isValidResizeFit,
  isValidResizePosition,
  isValidBackgroundColor,
} from '../../src/types/guards';

describe('타입 가드 함수 - 순수 로직', () => {
  describe('isDataURL', () => {
    it('유효한 Data URL 식별', () => {
      const validDataUrls = [
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAM...',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0icmVkIiAvPgo8L3N2Zz4=',
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQ=='
      ];

      validDataUrls.forEach(url => {
        expect(isDataURL(url)).toBe(true);
      });
    });

    it('무효한 Data URL 식별', () => {
      const invalidDataUrls = [
        'http://example.com/image.jpg',
        'https://example.com/image.png',
        'data:text/plain;base64,SGVsbG8=',  // image/가 아님
        'data:application/json;base64,eyJ0ZXN0IjoidmFsdWUifQ==',  // image/가 아님
        'image/jpeg;base64,/9j/4AAQSkZJRgABA...',  // data: 프리픽스 없음
        'dataimage/jpeg;base64,test',  // : 없음
        '',
        'not-a-url',
        'file:///path/to/image.jpg'
      ];

      invalidDataUrls.forEach(url => {
        expect(isDataURL(url)).toBe(false);
      });
    });

    it('null과 undefined 처리', () => {
      expect(isDataURL(null)).toBe(false);
      expect(isDataURL(undefined)).toBe(false);
      expect(isDataURL(0)).toBe(false);
      expect(isDataURL({})).toBe(false);
      expect(isDataURL([])).toBe(false);
    });
  });

  describe('isHttpURL', () => {
    it('유효한 HTTP/HTTPS URL 식별', () => {
      const validHttpUrls = [
        'http://example.com/image.jpg',
        'https://cdn.example.com/images/photo.png',
        'HTTP://EXAMPLE.COM/IMAGE.GIF',  // 대소문자 무관
        'https://127.0.0.1:8080/test.jpg',
        'http://localhost/image.webp',
        'https://subdomain.example.com/path/to/image.png',
        'http://192.168.1.1/image.jpg',
        'https://example.com:443/secure/image.png'
      ];

      validHttpUrls.forEach(url => {
        expect(isHttpURL(url)).toBe(true);
      });
    });

    it('무효한 URL 식별', () => {
      const invalidUrls = [
        'ftp://example.com/image.jpg',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...',
        'file:///path/to/image.jpg',
        'mailto:test@example.com',
        'javascript:alert("test")',
        'not-a-url',
        'example.com/image.jpg',  // 프로토콜 없음
        '//example.com/image.jpg',  // 프로토콜 없음
        '',
      ];

      invalidUrls.forEach(url => {
        expect(isHttpURL(url)).toBe(false);
      });
    });

    it('타입이 문자열이 아닌 경우', () => {
      expect(isHttpURL(null)).toBe(false);
      expect(isHttpURL(undefined)).toBe(false);
      expect(isHttpURL(123)).toBe(false);
      expect(isHttpURL({})).toBe(false);
      expect(isHttpURL([])).toBe(false);
    });
  });

  describe('isSVGString', () => {
    it('유효한 SVG 문자열 식별', () => {
      const validSvgs = [
        '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="red" /></svg>',
        `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="50" height="50" fill="blue" />
        </svg>`,
        '<svg viewBox="0 0 100 100"><path d="M10,30 Q20,15 30,30" stroke="black" /></svg>',
        '  <svg><text x="10" y="10">Hello</text></svg>  ',  // 공백 포함
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon"/></svg>'
      ];

      validSvgs.forEach(svg => {
        expect(isSVGString(svg)).toBe(true);
      });
    });

    it('무효한 SVG 문자열 식별', () => {
      const invalidSvgs = [
        '<div><svg></svg></div>',  // svg가 시작 태그가 아님
        'svg xmlns="http://www.w3.org/2000/svg"></svg>',  // < 없음
        '<svg xmlns="http://www.w3.org/2000/svg">',  // 닫는 태그 없음
        '<svg></svg',  // 닫는 태그 불완전
        'not svg content',
        '<html><svg></svg></html>',  // HTML 태그로 감싸짐
        '',
        '<img src="test.svg" />',  // img 태그
        'data:image/svg+xml;base64,...'  // Data URL
      ];

      invalidSvgs.forEach(svg => {
        expect(isSVGString(svg)).toBe(false);
      });
    });

    it('타입이 문자열이 아닌 경우', () => {
      expect(isSVGString(null)).toBe(false);
      expect(isSVGString(undefined)).toBe(false);
      expect(isSVGString({})).toBe(false);
      expect(isSVGString([])).toBe(false);
      expect(isSVGString(123)).toBe(false);
    });
  });

  describe('isValidResizeFit', () => {
    it('유효한 fit 값 식별', () => {
      const validFitValues = ['cover', 'letterbox', 'stretch', 'atMost', 'atLeast'];

      validFitValues.forEach(fit => {
        expect(isValidResizeFit(fit)).toBe(true);
      });
    });

    it('무효한 fit 값 식별', () => {
      const invalidFitValues = [
        'contain',  // 구 버전 호환성
        'fill',     // 구 버전 호환성
        'inside',   // Sharp 라이브러리 용어
        'outside',  // Sharp 라이브러리 용어
        'scale-down',
        'none',
        'auto',
        'Cover',    // 대소문자 구분
        'COVER',
        '',
        'not-a-fit-mode'
      ];

      invalidFitValues.forEach(fit => {
        expect(isValidResizeFit(fit)).toBe(false);
      });
    });

    it('타입이 문자열이 아닌 경우', () => {
      expect(isValidResizeFit(null)).toBe(false);
      expect(isValidResizeFit(undefined)).toBe(false);
      expect(isValidResizeFit(123)).toBe(false);
      expect(isValidResizeFit({})).toBe(false);
      expect(isValidResizeFit(['cover'])).toBe(false);
    });
  });

  describe('isValidResizePosition', () => {
    it('유효한 문자열 위치값 식별', () => {
      const validStringPositions = [
        'center', 'centre',
        'north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest',
        'top', 'right', 'bottom', 'left',
        'top left', 'top right', 'bottom left', 'bottom right',
        'left top', 'right top', 'left bottom', 'right bottom'
      ];

      validStringPositions.forEach(position => {
        expect(isValidResizePosition(position)).toBe(true);
      });
    });

    it('유효한 숫자 위치값 식별', () => {
      const validNumberPositions = [0, 1, 25, 50, 75, 99, 100];

      validNumberPositions.forEach(position => {
        expect(isValidResizePosition(position)).toBe(true);
      });
    });

    it('유효한 객체 위치값 식별', () => {
      const validObjectPositions = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 },
        { x: 25.5, y: 75.3 }
      ];

      validObjectPositions.forEach(position => {
        expect(isValidResizePosition(position)).toBe(true);
      });
    });

    it('무효한 위치값 식별', () => {
      const invalidPositions = [
        'middle',  // 정의되지 않은 값
        'top center',  // 조합이지만 정의되지 않음
        'invalid',
        -1,  // 범위 밖
        101,  // 범위 밖
        { x: -1, y: 50 },  // x 범위 밖
        { x: 50, y: 101 },  // y 범위 밖
        { x: 50 },  // y 없음
        { y: 50 },  // x 없음
        { x: '50', y: 50 },  // 문자열 좌표
        null,
        undefined,
        '',
        []
      ];

      invalidPositions.forEach(position => {
        expect(isValidResizePosition(position)).toBe(false);
      });
    });
  });

  describe('isValidBackgroundColor', () => {
    it('유효한 문자열 색상값 식별', () => {
      const validStringColors = [
        '#ffffff',
        '#fff',
        '#000000',
        '#123456',
        '#12345678',  // alpha 포함
        'red',
        'blue',
        'green',
        'transparent',
        'white',
        'black',
        'rgb(255, 255, 255)',
        'rgba(255, 255, 255, 0.5)',
        'hsl(360, 100%, 50%)',
        'hsla(360, 100%, 50%, 0.5)'
      ];

      validStringColors.forEach(color => {
        expect(isValidBackgroundColor(color)).toBe(true);
      });
    });

    it('유효한 객체 색상값 식별', () => {
      const validObjectColors = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
        { r: 128, g: 64, b: 192 },
        { r: 255, g: 0, b: 0, alpha: 1 },
        { r: 0, g: 255, b: 0, alpha: 0.5 },
        { r: 0, g: 0, b: 255, alpha: 0 }
      ];

      validObjectColors.forEach(color => {
        expect(isValidBackgroundColor(color)).toBe(true);
      });
    });

    it('무효한 색상값 식별', () => {
      const invalidColors = [
        '#gggggg',  // 잘못된 hex
        { r: -1, g: 0, b: 0 },  // 범위 밖
        { r: 256, g: 0, b: 0 },  // 범위 밖
        { r: 255, g: 255 },  // b 없음
        { r: '255', g: 255, b: 255 },  // 문자열 값
        { r: 255, g: 255, b: 255, alpha: -1 },  // alpha 범위 밖
        { r: 255, g: 255, b: 255, alpha: 2 },  // alpha 범위 밖
        null,
        undefined,
        123,
        []
      ];

      invalidColors.forEach(color => {
        expect(isValidBackgroundColor(color)).toBe(false);
      });
    });
  });
});