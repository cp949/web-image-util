// 성능 모니터링 훅

'use client';

import { useState, useCallback } from 'react';
import type { PerformanceMetrics } from '../components/demos/types';

/**
 * 성능 측정 및 모니터링 훅
 */
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    processingTime: 0,
    memoryUsage: 0,
    throughput: 0,
  });

  /**
   * 비동기 작업의 성능 측정
   */
  const measurePerformance = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    try {
      const result = await operation();

      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const processingTime = endTime - startTime;
      const memoryUsage = endMemory - startMemory;

      // Throughput 계산 (blob이 있는 경우)
      let throughput = 0;
      if (result && typeof result === 'object' && 'blob' in result && result.blob instanceof Blob) {
        throughput = (result.blob.size / processingTime) * 1000; // bytes per second
      }

      setMetrics({
        processingTime,
        memoryUsage,
        throughput,
      });

      return result;
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * 메트릭 초기화
   */
  const resetMetrics = useCallback(() => {
    setMetrics({
      processingTime: 0,
      memoryUsage: 0,
      throughput: 0,
    });
  }, []);

  /**
   * 메트릭 포맷팅
   */
  const formatMetrics = useCallback(() => {
    return {
      processingTime: `${metrics.processingTime.toFixed(2)}ms`,
      memoryUsage: formatBytes(metrics.memoryUsage),
      throughput: metrics.throughput > 0 ? `${formatBytes(metrics.throughput)}/s` : 'N/A',
    };
  }, [metrics]);

  return {
    metrics,
    measurePerformance,
    resetMetrics,
    formatMetrics,
  };
}

/**
 * 바이트 단위를 사람이 읽기 쉬운 형식으로 변환
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}