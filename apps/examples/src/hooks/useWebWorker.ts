import { useCallback, useRef, useEffect, useState } from 'react'

interface WebWorkerMessage {
  id: number
  operation: string
  source: any
  options: any
}

interface WebWorkerResponse {
  id: number
  success: boolean
  result?: any
  error?: string
  progress?: number
}

interface WebWorkerHookOptions {
  maxConcurrency?: number
  timeout?: number
}

export function useImageWorker(options: WebWorkerHookOptions = {}) {
  const { maxConcurrency = 2, timeout = 30000 } = options
  
  const workerPoolRef = useRef<Worker[]>([])
  const requestIdRef = useRef(0)
  const pendingRequests = useRef<Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeoutId?: NodeJS.Timeout
  }>>(new Map())
  
  const [isSupported, setIsSupported] = useState(false)
  const [activeWorkers, setActiveWorkers] = useState(0)
  const [queuedTasks, setQueuedTasks] = useState(0)

  // Web Worker 지원 확인
  useEffect(() => {
    setIsSupported(typeof Worker !== 'undefined')
  }, [])

  const initWorkerPool = useCallback(() => {
    if (!isSupported || workerPoolRef.current.length > 0) return

    for (let i = 0; i < maxConcurrency; i++) {
      try {
        // Web Worker 스크립트 인라인으로 생성
        const workerScript = `
          // Image processing worker
          self.onmessage = async function(e) {
            const { id, operation, source, options } = e.data;

            try {
              let result;

              // 진행률 보고 함수
              const reportProgress = (progress) => {
                self.postMessage({
                  id,
                  progress,
                  success: false
                });
              };

              switch (operation) {
                case 'resize':
                  result = await processImageResize(source, options, reportProgress);
                  break;
                case 'format':
                  result = await processFormatConversion(source, options, reportProgress);
                  break;
                case 'filter':
                  result = await applyImageFilter(source, options, reportProgress);
                  break;
                case 'batch':
                  result = await processBatchImages(source, options, reportProgress);
                  break;
                default:
                  throw new Error('Unknown operation: ' + operation);
              }

              self.postMessage({
                id,
                success: true,
                result
              });

            } catch (error) {
              self.postMessage({
                id,
                success: false,
                error: error.message
              });
            }
          };

          async function processImageResize(source, options, reportProgress) {
            reportProgress(10);
            
            // OffscreenCanvas를 사용한 이미지 처리
            if (typeof OffscreenCanvas !== 'undefined') {
              const canvas = new OffscreenCanvas(options.width || 300, options.height || 200);
              const ctx = canvas.getContext('2d');
              
              reportProgress(30);
              
              // 이미지 로드
              const img = await loadImageFromSource(source);
              reportProgress(60);
              
              // 이미지 리사이징
              ctx.drawImage(img, 0, 0, options.width || 300, options.height || 200);
              reportProgress(90);
              
              // Blob으로 변환
              const blob = await canvas.convertToBlob({
                type: 'image/' + (options.format || 'jpeg'),
                quality: options.quality || 0.8
              });
              
              reportProgress(100);
              return blob;
            } else {
              throw new Error('OffscreenCanvas not supported');
            }
          }

          async function processFormatConversion(source, options, reportProgress) {
            reportProgress(20);
            
            const canvas = new OffscreenCanvas(1, 1);
            const ctx = canvas.getContext('2d');
            
            const img = await loadImageFromSource(source);
            reportProgress(50);
            
            canvas.width = img.width || options.width || 1;
            canvas.height = img.height || options.height || 1;
            
            ctx.drawImage(img, 0, 0);
            reportProgress(80);
            
            const blob = await canvas.convertToBlob({
              type: 'image/' + options.format,
              quality: options.quality || 0.8
            });
            
            reportProgress(100);
            return blob;
          }

          async function applyImageFilter(source, options, reportProgress) {
            reportProgress(10);
            
            const canvas = new OffscreenCanvas(1, 1);
            const ctx = canvas.getContext('2d');
            
            const img = await loadImageFromSource(source);
            reportProgress(30);
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            ctx.drawImage(img, 0, 0);
            reportProgress(50);
            
            // 필터 적용
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            applyFilter(imageData, options.filter);
            reportProgress(80);
            
            ctx.putImageData(imageData, 0, 0);
            
            const blob = await canvas.convertToBlob({
              type: 'image/' + (options.format || 'jpeg'),
              quality: options.quality || 0.8
            });
            
            reportProgress(100);
            return blob;
          }

          async function processBatchImages(sources, options, reportProgress) {
            const results = [];
            const total = sources.length;
            
            for (let i = 0; i < total; i++) {
              const source = sources[i];
              const progress = Math.floor((i / total) * 100);
              reportProgress(progress);
              
              try {
                const result = await processImageResize(source, options, () => {});
                results.push({ success: true, result, index: i });
              } catch (error) {
                results.push({ success: false, error: error.message, index: i });
              }
            }
            
            reportProgress(100);
            return results;
          }

          function applyFilter(imageData, filterType) {
            const data = imageData.data;
            
            switch (filterType) {
              case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                  const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                  data[i] = gray;
                  data[i + 1] = gray;
                  data[i + 2] = gray;
                }
                break;
              case 'blur':
                // 간단한 블러 효과 (실제 구현에서는 더 정교한 알고리즘 필요)
                applySimpleBlur(imageData);
                break;
              case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  
                  data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                  data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                  data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
            }
          }

          function applySimpleBlur(imageData) {
            // 간단한 3x3 블러 필터
            // 실제로는 가우시안 블러나 더 정교한 필터를 사용해야 함
          }

          async function loadImageFromSource(source) {
            if (typeof source === 'string') {
              if (source.startsWith('data:')) {
                // Data URL
                const response = await fetch(source);
                const blob = await response.blob();
                return createImageBitmap(blob);
              } else {
                // URL
                const response = await fetch(source);
                const blob = await response.blob();
                return createImageBitmap(blob);
              }
            } else if (source instanceof File || source instanceof Blob) {
              return createImageBitmap(source);
            } else {
              throw new Error('Unsupported source type');
            }
          }
        `

        const blob = new Blob([workerScript], { type: 'application/javascript' })
        const workerUrl = URL.createObjectURL(blob)
        const worker = new Worker(workerUrl)

        worker.onmessage = (e) => {
          const { id, success, result, error, progress } = e.data as WebWorkerResponse
          const request = pendingRequests.current.get(id)

          if (request) {
            // 진행률 업데이트인 경우
            if (progress !== undefined && !success) {
              // 진행률 콜백이 있다면 호출
              return
            }

            // 최종 결과인 경우
            if (request.timeoutId) {
              clearTimeout(request.timeoutId)
            }

            if (success) {
              request.resolve(result)
            } else {
              request.reject(new Error(error))
            }
            pendingRequests.current.delete(id)
            setActiveWorkers(prev => Math.max(0, prev - 1))
          }
        }

        worker.onerror = (error) => {
          console.error('Worker error:', error)
        }

        workerPoolRef.current.push(worker)
        
        // URL 정리
        URL.revokeObjectURL(workerUrl)

      } catch (error) {
        console.error('Failed to create worker:', error)
      }
    }
  }, [isSupported, maxConcurrency])

  const getAvailableWorker = useCallback((): Worker | null => {
    return workerPoolRef.current.find(worker => worker) || null
  }, [])

  const processImage = useCallback(async (
    operation: string, 
    source: any, 
    options: any,
    onProgress?: (progress: number) => void
  ): Promise<any> => {
    if (!isSupported) {
      throw new Error('Web Workers are not supported in this environment')
    }

    initWorkerPool()

    const worker = getAvailableWorker()
    if (!worker) {
      throw new Error('No available workers')
    }

    const id = ++requestIdRef.current
    setQueuedTasks(prev => prev + 1)

    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        pendingRequests.current.delete(id)
        setActiveWorkers(prev => Math.max(0, prev - 1))
        setQueuedTasks(prev => Math.max(0, prev - 1))
        reject(new Error('Worker timeout'))
      }, timeout)

      pendingRequests.current.set(id, { resolve, reject, timeoutId })
      setActiveWorkers(prev => prev + 1)
      setQueuedTasks(prev => Math.max(0, prev - 1))

      // 진행률 콜백 설정
      if (onProgress) {
        const originalOnMessage = worker.onmessage
        worker.onmessage = (e) => {
          const { id: responseId, progress } = e.data
          if (responseId === id && progress !== undefined) {
            onProgress(progress)
          }
          if (originalOnMessage) {
            originalOnMessage.call(worker, e)
          }
        }
      }

      // 작업 시작
      worker.postMessage({
        id,
        operation,
        source,
        options
      } as WebWorkerMessage)
    })
  }, [isSupported, initWorkerPool, getAvailableWorker, timeout])

  const cleanup = useCallback(() => {
    workerPoolRef.current.forEach(worker => {
      worker.terminate()
    })
    workerPoolRef.current = []
    pendingRequests.current.clear()
    setActiveWorkers(0)
    setQueuedTasks(0)
  }, [])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    processImage,
    cleanup,
    isSupported,
    activeWorkers,
    queuedTasks,
    stats: {
      totalWorkers: workerPoolRef.current.length,
      activeWorkers,
      queuedTasks,
      isSupported
    }
  }
}

// Performance API에서 제공하는 MemoryInfo 타입 정의
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// performance.memory를 확장하여 MemoryInfo 포함
declare global {
  interface Performance {
    memory?: MemoryInfo;
  }
}

// 성능 모니터링 훅
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<{
    memoryUsage?: MemoryInfo
    renderTime: number
    lastUpdate: Date
  }>({
    renderTime: 0,
    lastUpdate: new Date()
  })

  const startMeasure = useCallback((name: string) => {
    performance.mark(`${name}-start`)
  }, [])

  const endMeasure = useCallback((name: string) => {
    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)
    
    const measure = performance.getEntriesByName(name, 'measure')[0]
    return measure?.duration || 0
  }, [])

  const updateMetrics = useCallback(() => {
    const newMetrics: typeof metrics = {
      renderTime: performance.now(),
      lastUpdate: new Date()
    }

    // 메모리 정보 (Chrome/Edge만 지원)
    if ('memory' in performance) {
      newMetrics.memoryUsage = (performance as any).memory
    }

    setMetrics(newMetrics)
  }, [])

  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024)
      }
    }
    return null
  }, [])

  return {
    metrics,
    startMeasure,
    endMeasure,
    updateMetrics,
    getMemoryUsage
  }
}

// 배치 처리 최적화 훅
export function useBatchProcessor() {
  const [queue, setQueue] = useState<Array<{
    id: string
    operation: string
    source: any
    options: any
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>>([])

  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const addToQueue = useCallback((
    operation: string,
    source: any,
    options: any
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = Date.now().toString() + Math.random().toString(36)
      
      setQueue(prev => [...prev, {
        id,
        operation,
        source,
        options,
        resolve,
        reject
      }])
    })
  }, [])

  const processQueue = useCallback(async (
    concurrency: number = 2
  ) => {
    if (processing || queue.length === 0) return

    setProcessing(true)
    setProgress(0)

    const items = [...queue]
    setQueue([])

    try {
      // 동시 실행 제한
      const chunks: typeof items[] = []
      for (let i = 0; i < items.length; i += concurrency) {
        chunks.push(items.slice(i, i + concurrency))
      }

      let completed = 0
      const total = items.length

      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map(async (item) => {
            try {
              // 실제 이미지 처리 로직 (여기서는 간단한 예시)
              await new Promise(resolve => setTimeout(resolve, 1000))
              item.resolve('processed')
              completed++
            } catch (error) {
              item.reject(error instanceof Error ? error : new Error('Processing failed'))
              completed++
            } finally {
              setProgress((completed / total) * 100)
            }
          })
        )
      }
    } finally {
      setProcessing(false)
      setProgress(100)
    }
  }, [processing, queue])

  const clearQueue = useCallback(() => {
    queue.forEach(item => {
      item.reject(new Error('Queue cleared'))
    })
    setQueue([])
  }, [queue])

  return {
    addToQueue,
    processQueue,
    clearQueue,
    processing,
    progress,
    queueLength: queue.length
  }
}