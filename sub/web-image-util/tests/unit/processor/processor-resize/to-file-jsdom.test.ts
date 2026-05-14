/**
 * processImage().resize().toFile() 행동 테스트.
 *
 * 검증 범위:
 * - 파일명 확장자로부터 출력 포맷을 자동 추론한다.
 * - 명시적 포맷 옵션이 파일명 추론보다 우선하며, 파일명 확장자도 포맷에 맞춰 정규화된다.
 * - 반환 File의 name/type/lastModified 및 메타데이터(width/height/format/processingTime)가 일관된다.
 *
 * jsdom + canvas 패키지 신뢰 경계:
 * - PNG, JPEG는 안정적으로 지원된다.
 * - WebP는 환경에 따라 fallback이 일어날 수 있으므로 느슨한 단정(/^image\//)을 사용한다.
 * - 파일 바이너리 내용은 단정하지 않는다(브라우저 인코더 결과 의존).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { processImage } from '../../../../src/processor';
import { createTestCanvas } from '../../../utils/canvas-helper';

describe('toFile() 행동', () => {
  describe('파일명 → 포맷 추론', () => {
    it('.jpg 확장자에서 image/jpeg 포맷을 추론한다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toFile('thumb.jpg');

      expect(result.file).toBeInstanceOf(File);
      expect(result.file.name).toBe('thumb.jpg');
      expect(result.file.type).toBe('image/jpeg');
    });

    it('.png 확장자에서 image/png 포맷을 추론한다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toFile('avatar.png');

      expect(result.file).toBeInstanceOf(File);
      expect(result.file.name).toBe('avatar.png');
      expect(result.file.type).toBe('image/png');
    });

    it('.webp 확장자에서 이미지 포맷을 추론한다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toFile('photo.webp');

      expect(result.file).toBeInstanceOf(File);
      expect(result.file.name).toBe('photo.webp');
      // jsdom canvas 환경에서 WebP 미지원 시 fallback이 일어날 수 있으므로 느슨하게 단정한다.
      expect(result.file.type).toMatch(/^image\//);
    });

    it('확장자 없는 파일명에서 smart-default 포맷이 적용된다(throw 없이 완료)', async () => {
      // Branch B 가드 && formatFromFilename의 falsy 측 — getFormatFromFilename이 null을 반환해
      // finalOptions = {}로 Branch C로 떨어지며 toBlob의 smart-default(webp 또는 png)가 적용된다.
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toFile('upload');

      expect(result.file).toBeInstanceOf(File);
      // 파일명은 그대로 보존된다.
      expect(result.file.name).toBe('upload');
      // smart-default가 적용되어 유효한 이미지 MIME이 나온다.
      expect(result.file.type).toMatch(/^image\//);
      // format 메타도 정의된 OutputFormat 값이어야 한다.
      expect(['jpeg', 'jpg', 'png', 'webp', 'avif']).toContain(result.format);
    });

    it('미지원 확장자(.bin)에서 smart-default 포맷이 적용된다(throw 없이 완료)', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toFile('data.bin');

      expect(result.file).toBeInstanceOf(File);
      expect(result.file.name).toBe('data.bin');
      expect(result.file.type).toMatch(/^image\//);
      expect(['jpeg', 'jpg', 'png', 'webp', 'avif']).toContain(result.format);
    });
  });

  describe('명시 옵션이 파일명 추론보다 우선', () => {
    it('options.format이 파일명 추론보다 우선하고, 파일명 확장자도 포맷에 맞춰 정규화된다', async () => {
      const canvas = createTestCanvas(400, 300);
      // .png 파일명과 옵션 format: 'jpeg'가 충돌하면 옵션을 신뢰하고 확장자도 .jpg로 교체한다.
      const result = await processImage(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('photo.png', { format: 'jpeg' });

      expect(result.file.name).toBe('photo.jpg');
      expect(result.file.type).toBe('image/jpeg');
    });

    it('두 번째 오버로드 toFile(name, format)에서도 확장자가 포맷에 맞춰 교체된다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('img.jpg', 'png');

      // 파일명의 .jpg가 명시한 png 포맷에 맞춰 .png로 교체된다.
      expect(result.file.name).toBe('img.png');
      expect(result.file.type).toBe('image/png');
    });

    it('확장자가 같은 포맷을 가리키면 파일명을 변경하지 않는다(.jpeg + jpeg)', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('photo.jpeg', { format: 'jpeg' });

      // .jpeg와 jpeg 포맷은 같은 포맷이므로 파일명을 유지한다.
      expect(result.file.name).toBe('photo.jpeg');
      expect(result.file.type).toBe('image/jpeg');
    });

    it('확장자가 없으면 포맷에 맞는 확장자가 덧붙는다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('upload', { format: 'png' });

      expect(result.file.name).toBe('upload.png');
      expect(result.file.type).toBe('image/png');
    });
  });

  describe('메타데이터 일관성', () => {
    it('resize 결과와 width/height가 일치한다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 150 }).toFile('out.png');

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('format이 출력 MIME에 대응하는 값을 갖는다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 150 }).toFile('out.png');

      expect(result.format).toBe('png');
    });

    it('processingTime이 number 타입이고 0 이상이다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 150 }).toFile('out.png');

      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('result.format과 result.file.type이 서로 대응한다', async () => {
      const canvas = createTestCanvas(400, 300);
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 150 }).toFile('out.png');

      // result.format이 반드시 정의되어야 한다. undefined/null이면 회귀.
      expect(result.format).toBeDefined();
      // result.format → MIME 매핑을 통해 file.type과 교차 검증한다.
      const formatToMime: Record<string, string> = {
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        avif: 'image/avif',
      };
      // result.format은 위에서 toBeDefined()로 단정했으므로 비-null 단언이 안전하다.
      expect(result.file.type).toBe(formatToMime[result.format!]);
    });
  });

  describe('lastModified 동작', () => {
    it('lastModified가 number이고 현재 시각과 ±5000ms 이내다', async () => {
      const canvas = createTestCanvas(400, 300);
      const before = Date.now();
      const result = await processImage(canvas).resize({ fit: 'cover', width: 200, height: 150 }).toFile('stamp.png');
      const after = Date.now();

      expect(typeof result.file.lastModified).toBe('number');
      expect(result.file.lastModified).toBeGreaterThanOrEqual(before - 5000);
      expect(result.file.lastModified).toBeLessThanOrEqual(after + 5000);
    });
  });

  describe('quality 적용', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('명시 quality 옵션이 canvas.toBlob 인코더에 그대로 전달된다', async () => {
      // Branch C: { format, quality } 명시 → quality가 canvas.toBlob 세 번째 인수로 주입된다.
      const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

      await processImage(createTestCanvas(400, 300))
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('image.jpg', { format: 'jpeg', quality: 0.42 });

      // 임의 값 0.42가 인코더에 도달했어야 한다.
      const qualityArgs = spy.mock.calls.map((c) => c[2]);
      expect(qualityArgs).toContain(0.42);
    });

    it('파일명 추론 경로에서 jpeg optimal quality(0.85)가 인코더에 도달한다', async () => {
      // 파일명 추론 경로(image.jpg → jpeg)에서 최적 quality 0.85가 canvas.toBlob 인코더에
      // 도달하는 end-to-end 결과를 검증한다. toFile 내부 유도 또는 toBlob 자체 보정 경로 중
      // 어느 쪽이 quality를 주입하든 관계없이, 공개 API 관측 결과만 단정한다.
      const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

      await processImage(createTestCanvas(400, 300))
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('image.jpg');

      const qualityArgs = spy.mock.calls.map((c) => c[2]);
      expect(qualityArgs).toContain(0.85);
    });

    it('두 번째 오버로드(format 문자열) 경로에서 toBlob quality 지연 주입이 적용된다', async () => {
      // Branch A: toFile('img.jpg', 'jpeg')는 finalOptions = { format: 'jpeg' }만 세팅한다.
      // processor.ts:442-444에서 format 있고 quality undefined이면 getOptimalQuality를 주입한다.
      const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

      await processImage(createTestCanvas(400, 300))
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toFile('image.jpg', 'jpeg');

      // getOptimalQuality('jpeg') = 0.85가 canvas.toBlob에 주입됐어야 한다.
      const qualityArgs = spy.mock.calls.map((c) => c[2]);
      expect(qualityArgs).toContain(0.85);
    });
  });
});
