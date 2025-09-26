/**
 * Canvas Pool 성능 테스트
 * Fabric.js 패턴을 적용한 Canvas Pool의 성능 개선 효과를 검증합니다.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CanvasPool } from '../../src/base/canvas-pool';
import { withManagedCanvas } from '../../src/base/canvas-utils';
import { createMockCanvas } from '../contract/setup/contract-mocks';

describe('Canvas Pool 성능 테스트', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear(); // 테스트 시작 전 풀 초기화
  });

  afterEach(() => {
    pool.clear(); // 테스트 후 정리
  });

  it('Canvas Pool에서 Canvas 재사용 효과 측정', async () => {
    const iterations = 10;

    // 초기 통계
    const initialStats = pool.getStats();
    expect(initialStats.totalCreated).toBe(0);
    expect(initialStats.poolHits).toBe(0);

    // withManagedCanvas를 사용한 연속 처리
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      await withManagedCanvas(300, 300, (canvas, ctx) => {
        // 간단한 Canvas 작업 시뮬레이션
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 300, 300);
        return canvas;
      });
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // 성능 통계 확인
    const finalStats = pool.getStats();

    // Canvas 재사용 확인
    expect(finalStats.totalCreated).toBeLessThan(iterations); // Canvas 재사용으로 생성 수 < 반복 수
    expect(finalStats.poolHits).toBeGreaterThan(0); // Pool에서 Canvas를 가져온 횟수
    expect(finalStats.hitRatio).toBeGreaterThan(0.3); // 30% 이상 재사용률

    // 성능 기대치
    const avgTimePerOperation = processingTime / iterations;
    expect(avgTimePerOperation).toBeLessThan(50); // 연산당 50ms 이하

    console.log('Canvas Pool 성능 결과:', {
      '총 처리 시간': `${processingTime.toFixed(2)}ms`,
      '연산당 평균 시간': `${avgTimePerOperation.toFixed(2)}ms`,
      'Canvas 생성 수': finalStats.totalCreated,
      '재사용률': `${(finalStats.hitRatio * 100).toFixed(1)}%`,
      '메모리 사용량': `${finalStats.memoryUsageMB}MB`,
      '복잡도': finalStats.complexity,
    });
  });

  it('대량 배치 처리에서 메모리 최적화 효과 검증', async () => {
    const batchSize = 20;

    const startStats = pool.getStats();
    const startTime = performance.now();

    // 병렬 배치 처리 - withManagedCanvas 사용
    const promises = Array(batchSize).fill(null).map(async (_, index) => {
      const size = 200 + (index % 5) * 50; // 다양한 크기 (200~400)
      return withManagedCanvas(size, size, (canvas, ctx) => {
        ctx.fillStyle = `hsl(${index * 18}, 70%, 50%)`;
        ctx.fillRect(0, 0, size, size);
        return canvas;
      });
    });

    await Promise.all(promises);

    const endTime = performance.now();
    const finalStats = pool.getStats();

    // 메모리 효율성 검증
    expect(finalStats.totalCreated).toBeLessThanOrEqual(batchSize); // Canvas 재사용으로 생성 수가 배치 크기 이하
    expect(finalStats.memoryUsageMB).toBeLessThan(50); // 50MB 이하 메모리 사용
    expect(finalStats.complexity).toBeLessThan(0.8); // 복잡도 80% 이하

    // 처리 속도 검증
    const totalTime = endTime - startTime;
    const avgTimePerOperation = totalTime / batchSize;
    expect(avgTimePerOperation).toBeLessThan(100); // 연산당 100ms 이하

    console.log('대량 배치 처리 결과:', {
      '총 처리 시간': `${totalTime.toFixed(2)}ms`,
      '배치 크기': batchSize,
      'Canvas 생성/재사용': `${finalStats.totalCreated}/${finalStats.poolHits}`,
      '메모리 효율성': `${finalStats.memoryUsageMB}MB`,
      '메모리 최적화 횟수': finalStats.memoryOptimizations,
    });
  });

  it('메모리 압박 상황에서 자동 최적화 동작 검증', async () => {
    // 풀 크기를 작게 설정하여 압박 상황 유도
    pool.setMaxPoolSize(2);

    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      await withManagedCanvas(2048, 2048, (canvas, ctx) => {
        // 매우 큰 Canvas 사용하여 메모리 압박 시뮬레이션
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(0, 0, 2048, 2048);
        return canvas;
      });
    }

    const stats = pool.getStats();

    // 풀 크기 제한으로 인한 최적화 확인
    expect(stats.poolSize).toBeLessThanOrEqual(2); // 최대 풀 크기 준수
    expect(stats.complexity).toBeLessThan(1.0); // 복잡도 제어됨
    expect(stats.totalCreated).toBeGreaterThan(0); // Canvas가 생성됨

    console.log('메모리 압박 상황 결과:', {
      '메모리 최적화 횟수': stats.memoryOptimizations,
      '현재 풀 크기': `${stats.poolSize}/${stats.maxPoolSize}`,
      '복잡도': stats.complexity,
      '재사용률': `${(stats.hitRatio * 100).toFixed(1)}%`,
      'Canvas 생성 수': stats.totalCreated,
    });
  });

  it('Canvas Pool complexity() 메서드 정확성 검증', async () => {
    // 초기 복잡도 확인
    let complexity = pool.complexity();
    expect(complexity).toBeGreaterThanOrEqual(0);
    expect(complexity).toBeLessThanOrEqual(1);

    // 점진적 로딩으로 복잡도 변화 관찰
    for (let i = 0; i < 5; i++) {
      await withManagedCanvas(300 + i * 50, 300 + i * 50, (canvas, ctx) => {
        ctx.fillStyle = `rgb(${i * 50}, ${i * 30}, ${i * 40})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
      });

      const newComplexity = pool.complexity();
      expect(newComplexity).toBeGreaterThanOrEqual(0);
      expect(newComplexity).toBeLessThanOrEqual(1);

      // 복잡도는 0-1 범위 내에서 변동함 (Canvas 풀 상태에 따라)
      if (i > 0) {
        // 복잡도 변화가 합리적인 범위 내인지만 확인 (급격한 변화 방지)
        expect(Math.abs(newComplexity - complexity)).toBeLessThan(0.5);
      }

      complexity = newComplexity;
    }

    console.log('복잡도 변화:', {
      '최종 복잡도': complexity,
      '풀 상태': pool.getStats(),
    });
  });

  it('서로 다른 크기의 Canvas 효율적 관리 검증', async () => {
    // 다양한 크기로 처리
    const sizes = [
      [100, 100],   // 작은 크기
      [300, 200],   // 중간 크기
      [500, 400],   // 큰 크기
      [100, 100],   // 작은 크기 (재사용 기대)
      [300, 200],   // 중간 크기 (재사용 기대)
    ];

    for (const [width, height] of sizes) {
      await withManagedCanvas(width, height, (canvas, ctx) => {
        ctx.fillStyle = `rgba(255, ${Math.floor(width/2)}, ${Math.floor(height/2)}, 0.8)`;
        ctx.fillRect(0, 0, width, height);
        return canvas;
      });
    }

    const stats = pool.getStats();

    // 크기별 재사용이 일어났는지 확인
    expect(stats.poolHits).toBeGreaterThan(0);
    expect(stats.hitRatio).toBeGreaterThan(0.2); // 20% 이상 재사용

    // 메모리 사용량이 합리적인지 확인
    expect(stats.memoryUsageMB).toBeLessThan(20); // 20MB 이하

    console.log('다양한 크기 처리 결과:', {
      '처리된 크기들': sizes.map(([w, h]) => `${w}x${h}`).join(', '),
      '재사용률': `${(stats.hitRatio * 100).toFixed(1)}%`,
      '메모리 사용량': `${stats.memoryUsageMB}MB`,
    });
  });

  it('Canvas Pool 통계 정확성 검증', async () => {
    // 초기 상태 확인
    let stats = pool.getStats();
    expect(stats.totalAcquired).toBe(0);
    expect(stats.totalReleased).toBe(0);
    expect(stats.hitRatio).toBe(0);

    // 단일 처리 (Canvas Pool 사용)
    await withManagedCanvas(200, 200, (canvas, ctx) => {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 200, 200);
      return canvas;
    });

    stats = pool.getStats();
    expect(stats.totalAcquired).toBeGreaterThan(0);
    expect(stats.totalReleased).toBeGreaterThan(0);

    // 추가 처리로 통계 누적 확인
    const beforeAcquired = stats.totalAcquired;

    await withManagedCanvas(250, 250, (canvas, ctx) => {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, 250, 250);
      return canvas;
    });

    stats = pool.getStats();
    expect(stats.totalAcquired).toBeGreaterThan(beforeAcquired);

    // 히트율 계산 정확성 확인
    if (stats.totalAcquired > 0) {
      const expectedHitRatio = stats.poolHits / stats.totalAcquired;
      expect(Math.abs(stats.hitRatio - expectedHitRatio)).toBeLessThan(0.01);
    }

    console.log('통계 정확성 검증 결과:', stats);
  });
});