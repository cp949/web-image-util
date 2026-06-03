import { describe, expect, it } from 'vitest';
import { TiledProcessor } from '../../../src/base/tiled-processor.internal';
import { createMockImage } from './tiled-processor.helpers';

describe('TiledProcessor.estimateProcessingTime', () => {
  it('16×16 이미지에 tileSize=8, overlapSize=0이면 tileCount=4를 반환한다', () => {
    const img = createMockImage(16, 16);
    // estimateProcessingTime 내부는 overlapSize=0으로 generateTilePlan 호출
    const { tileCount } = TiledProcessor.estimateProcessingTime(img, 16, 16, 8);
    expect(tileCount).toBe(4);
  });

  it('나누어떨어지지 않는 경우에도 올바른 tileCount를 반환한다', () => {
    const img = createMockImage(10, 10);
    const { tileCount } = TiledProcessor.estimateProcessingTime(img, 10, 10, 8);
    // 10×10, step=8 → 2×2 = 4
    expect(tileCount).toBe(4);
  });

  it('estimatedSeconds는 양수이다', () => {
    const img = createMockImage(16, 16);
    const { estimatedSeconds } = TiledProcessor.estimateProcessingTime(img, 16, 16, 8);
    expect(estimatedSeconds).toBeGreaterThan(0);
  });

  it('memoryUsageMB는 0 이상의 숫자이다', () => {
    const img = createMockImage(16, 16);
    const { memoryUsageMB } = TiledProcessor.estimateProcessingTime(img, 16, 16, 8);
    expect(typeof memoryUsageMB).toBe('number');
    expect(memoryUsageMB).toBeGreaterThanOrEqual(0);
  });

  it('tileSize=256이면 memoryUsageMB가 양수이다', () => {
    // 256×256 타일 = 256*256*4 bytes = 0.25 MB (반올림 후 0.25 > 0)
    const img = createMockImage(512, 512);
    const { memoryUsageMB } = TiledProcessor.estimateProcessingTime(img, 512, 512, 256);
    expect(memoryUsageMB).toBeGreaterThan(0);
  });

  it('타일 크기가 클수록 memoryUsageMB가 커진다', () => {
    const img = createMockImage(100, 100);
    const small = TiledProcessor.estimateProcessingTime(img, 100, 100, 16);
    const large = TiledProcessor.estimateProcessingTime(img, 100, 100, 64);
    expect(large.memoryUsageMB).toBeGreaterThan(small.memoryUsageMB);
  });
});

describe('TiledProcessor.recommendTileSize', () => {
  it('반환값이 [256, 2048] 범위 안에 있다', () => {
    // maxMemoryMB=1 → maxTileSize=512 → 클램프 불필요, 실제 계산 경로를 탄다
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 1);
    expect(size).toBeGreaterThanOrEqual(256);
    expect(size).toBeLessThanOrEqual(2048);
  });

  it('반올림(올림): log2 소수부가 0.5 초과이면 큰 2의 거듭제곱으로 올림된다', () => {
    // maxMemoryMB=0.51 → maxTileSize=365 → recommendedSize=365 (2의 거듭제곱 아님)
    // log2(365)≈8.51 → Math.round(8.51)=9 → powerOfTwo=512
    // Math.round를 Math.floor로 교체하면: floor(8.51)=8 → 256 → 이 테스트가 잡음
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 0.51);
    expect(size).toBe(512);
  });

  it('반올림(내림): log2 소수부가 0.5 미만이면 작은 2의 거듭제곱으로 내림된다', () => {
    // maxMemoryMB=1.4 → maxTileSize=605 → recommendedSize=605 (2의 거듭제곱 아님)
    // log2(605)≈9.24 → Math.round(9.24)=9 → powerOfTwo=512
    // Math.round를 Math.ceil로 교체하면: ceil(9.24)=10 → 1024 → 이 테스트가 잡음
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 1.4);
    expect(size).toBe(512);
  });

  it('maxMemoryMB가 클수록 더 큰 타일 크기를 권장한다', () => {
    // maxMemoryMB=1 → 512, maxMemoryMB=4 → 1024, 실제로 다른 값을 반환해야 한다
    const img = createMockImage(4000, 3000);
    const small = TiledProcessor.recommendTileSize(img, 1);
    const large = TiledProcessor.recommendTileSize(img, 4);
    expect(large).toBeGreaterThan(small); // 등호 없이: 단조성을 실제로 검증
  });

  it('minSize 클램프: 매우 작은 maxMemoryMB는 256을 반환한다', () => {
    // maxMemoryMB=0.1 → maxTileSize=161 → minSize 클램프 → 256
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 0.1);
    expect(size).toBe(256);
  });

  it('maxSize 클램프: 큰 maxMemoryMB는 2048을 반환한다', () => {
    // maxMemoryMB=64 → maxTileSize=4096 → maxSize 클램프(2048) 발동 → 2048
    // Math.min(2048, maxTileSize) 분기를 실제로 행사함
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 64);
    expect(size).toBe(2048);
  });
});

describe('TiledProcessor.assessTiledProcessingSuitability', () => {
  it('4MP 미만 이미지는 suitable=false를 반환한다', () => {
    // 1000×1000 = ~0.95MP < 4MP, tileSize=256 → 16 타일(충분)
    // megaPixels 조건만 false를 만들기 위해 타일 수는 충분하게 설정
    const img = createMockImage(1000, 1000);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 256);
    expect(result.suitable).toBe(false);
  });

  it('megaPixels >= 4이고 타일 수 >= 4이면 suitable=true를 반환한다', () => {
    // 2048×2048 = 4MP, tileSize=1024 → 2×2 = 4 타일: 두 조건 모두 통과
    const img = createMockImage(2048, 2048);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 1024);
    expect(result.suitable).toBe(true);
    expect(result.reasons).toContain('Suitable for tile-based processing.');
  });

  it('suitable=false이면 reasons에 설명이 포함된다', () => {
    const img = createMockImage(100, 100);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 1024);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('estimatedTiles는 실제 타일 수와 일치한다', () => {
    // 16×16 이미지, tileSize=8, overlapSize=0 → 4 타일
    const img = createMockImage(16, 16);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 8);
    expect(result.estimatedTiles).toBe(4);
  });

  it('estimatedMemoryMB는 양수이다', () => {
    const img = createMockImage(100, 100);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 64);
    expect(result.estimatedMemoryMB).toBeGreaterThan(0);
  });
});
