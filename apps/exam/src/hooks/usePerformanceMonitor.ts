// Performance monitoring hook

'use client';

import { useState, useCallback } from 'react';
import type { PerformanceMetrics } from '../components/demos/types';

/**
 * Performance measurement and monitoring hook
 */
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    processingTime: 0,
    memoryUsage: 0,
    throughput: 0,
  });

  /**
   * Performance measurement for async operations
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

      // Calculate throughput (if blob exists)
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
   * Reset metrics
   */
  const resetMetrics = useCallback(() => {
    setMetrics({
      processingTime: 0,
      memoryUsage: 0,
      throughput: 0,
    });
  }, []);

  /**
   * Format metrics
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
 * Convert bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}