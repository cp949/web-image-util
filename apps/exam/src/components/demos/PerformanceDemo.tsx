'use client';

import { detectBrowserCapabilities, processImage } from '@cp949/web-image-util';
import { Assessment as BenchmarkIcon, Speed as SpeedIcon, Timeline as TimelineIcon, Warning as WarningIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CodeSnippet } from '../common/CodeSnippet';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

interface BenchmarkResult {
  operation: string;
  iterations: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // 초당 처리 건수
  memoryUsage?: number;
  errors: number;
  /** 이 결과가 속한 카테고리 */
  category: 'resize' | 'format' | 'filter' | 'watermark';
  /** 포맷 비교용: 결과물 크기(bytes) */
  outputSize?: number;
}

interface PerformanceTest {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  operation: () => Promise<any>;
  category: 'resize' | 'format' | 'filter' | 'watermark';
}

/** 처리 완료 후 표시할 결과 요약 */
interface ResultSummary {
  /** 가장 빠른 포맷 이름 */
  fastestFormat: string;
  /** 가장 작은 출력 크기를 가진 포맷 */
  smallestFormat: string;
  /** 전체 평균 처리 시간 */
  overallAvgTime: number;
  /** 경고가 필요한 항목 목록 */
  warnings: string[];
}

export function PerformanceDemo() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [capabilities, setCapabilities] = useState({
    webp: false,
    avif: false,
    offscreenCanvas: false,
    imageBitmap: false,
  });

  const [testConfig, setTestConfig] = useState({
    iterations: 10,
    sampleImage: 'medium' as 'small' | 'medium' | 'large',
    useWebWorker: false,
    testAllFormats: true,
    testAllSizes: false,
  });

  // 샘플 이미지 설정 (실제 존재하는 파일)
  const sampleImages = {
    small: { src: '/sample-images/sample3.png', width: 300, height: 300 },
    medium: { src: '/sample-images/sample1.jpg', width: 1920, height: 1080 },
    large: { src: '/sample-images/sample2.jpg', width: 4000, height: 3000 },
  };

  useEffect(() => {
    let isMounted = true;

    void detectBrowserCapabilities()
      .then((detected) => {
        if (!isMounted) {
          return;
        }

        setCapabilities({
          webp: detected.webp,
          avif: detected.avif,
          offscreenCanvas: detected.offscreenCanvas,
          imageBitmap: detected.imageBitmap,
        });
      })
      .catch(() => {
        // 감지 실패 시에는 안전한 기본값을 유지한다.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 성능 테스트 케이스 정의
  const performanceTests: PerformanceTest[] = [
    {
      name: 'Basic Resize',
      description: 'Resize to 300x200',
      category: 'resize',
      operation: () =>
        processImage(sampleImages[testConfig.sampleImage].src)
          .resize({ fit: 'cover', width: 300, height: 200 })
          .toBlob(),
    },
    {
      name: 'JPEG Conversion',
      description: 'Convert to JPEG format',
      category: 'format',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).toBlob({ format: 'jpeg', quality: 0.8 }),
    },
    {
      name: 'WebP Conversion',
      description: 'Convert to WebP format',
      category: 'format',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).toBlob({ format: 'webp', quality: 0.8 }),
    },
    {
      name: 'PNG Conversion',
      description: 'Convert to PNG format',
      category: 'format',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).toBlob({ format: 'png' }),
    },
  ];

  const runBenchmark = async (test: PerformanceTest, iterations: number): Promise<BenchmarkResult> => {
    const times: number[] = [];
    let errors = 0;
    let lastOutputSize: number | undefined;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        const blob = await test.operation();
        const endTime = performance.now();
        times.push(endTime - startTime);

        // 마지막 반복의 출력 크기를 기록한다.
        if (blob) {
          lastOutputSize = blob.size;
        }
      } catch (error) {
        errors++;
        console.error(`Test ${test.name} iteration ${i + 1} failed:`, error);
      }
    }

    if (times.length === 0) {
      throw new Error(`All iterations failed for test: ${test.name}`);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = 1000 / avgTime; // 초당 처리 건수

    return {
      operation: test.name,
      iterations: times.length,
      avgTime,
      minTime,
      maxTime,
      throughput,
      errors,
      category: test.category,
      outputSize: lastOutputSize,
    };
  };

  /** 결과 요약 생성: 포맷 비교, 경고 메시지 등 */
  const buildSummary = (allResults: BenchmarkResult[]): ResultSummary => {
    // 포맷 카테고리만 추출하여 비교한다.
    const formatResults = allResults.filter((r) => r.category === 'format');

    // 가장 빠른 포맷 선택
    const fastestFormat =
      formatResults.length > 0
        ? formatResults.reduce((best, r) => (r.avgTime < best.avgTime ? r : best)).operation
        : '-';

    // 가장 작은 출력 크기 포맷 선택
    const withSize = formatResults.filter((r) => r.outputSize !== undefined);
    const smallestFormat =
      withSize.length > 0
        ? withSize.reduce((best, r) => ((r.outputSize ?? Infinity) < (best.outputSize ?? Infinity) ? r : best)).operation
        : '-';

    // 전체 평균 처리 시간
    const overallAvgTime =
      allResults.length > 0 ? allResults.reduce((sum, r) => sum + r.avgTime, 0) / allResults.length : 0;

    // 경고 메시지 수집
    const warnings: string[] = [];

    if (allResults.some((r) => r.avgTime > 500)) {
      warnings.push('One or more operations exceeded 500ms. Consider reducing image dimensions or using Web Workers.');
    } else if (allResults.some((r) => r.avgTime > 200)) {
      warnings.push('Some operations exceeded 200ms. Canvas Pool is active and reusing canvases to reduce overhead.');
    }

    if (allResults.some((r) => r.errors > 0)) {
      warnings.push('Some iterations encountered errors. Check browser console for details.');
    }

    if (!capabilities.webp) {
      warnings.push('WebP is not supported in this browser. JPEG will be used as fallback, resulting in larger files.');
    }

    return { fastestFormat, smallestFormat, overallAvgTime, warnings };
  };

  const startPerformanceTests = async () => {
    setRunning(true);
    setResults([]);
    setChartData([]);
    setSummary(null);

    try {
      // 시작 전 메모리 사용량 측정
      const performanceExt = performance as ExtendedPerformance;
      const initialMemory = performanceExt.memory
        ? {
            used: performanceExt.memory.usedJSHeapSize,
            total: performanceExt.memory.totalJSHeapSize,
            limit: performanceExt.memory.jsHeapSizeLimit,
          }
        : null;

      const newResults: BenchmarkResult[] = [];
      const newChartData: any[] = [];

      for (let i = 0; i < performanceTests.length; i++) {
        const test = performanceTests[i];

        try {
          const result = await runBenchmark(test, testConfig.iterations);
          newResults.push(result);

          // 차트 데이터 업데이트
          newChartData.push({
            name: test.name,
            avgTime: Math.round(result.avgTime),
            throughput: Math.round(result.throughput * 100) / 100,
            category: test.category,
          });

          setResults([...newResults]);
          setChartData([...newChartData]);
        } catch (error) {
          console.error(`Failed to run test ${test.name}:`, error);
        }
      }

      // 결과 요약 생성
      setSummary(buildSummary(newResults));

      // 종료 후 메모리 사용량 측정
      if (initialMemory && performanceExt.memory) {
        const finalMemory = {
          used: performanceExt.memory.usedJSHeapSize,
          total: performanceExt.memory.totalJSHeapSize,
          limit: performanceExt.memory.jsHeapSizeLimit,
        };

        setMemoryStats({
          initial: initialMemory,
          final: finalMemory,
          delta: {
            used: finalMemory.used - initialMemory.used,
            total: finalMemory.total - initialMemory.total,
          },
        });
      }
    } catch (error) {
      console.error('Performance test failed:', error);
    } finally {
      setRunning(false);
    }
  };

  const formatTime = (ms: number) => {
    return `${Math.round(ms)}ms`;
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb * 100) / 100}MB`;
  };

  /** bytes를 KB 단위로 표시한다. */
  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    return `${Math.round(kb)}KB`;
  };

  const getPerformanceRating = (avgTime: number) => {
    if (avgTime < 50) return { rating: 'Excellent', color: 'success' as const };
    if (avgTime < 100) return { rating: 'Good', color: 'primary' as const };
    if (avgTime < 200) return { rating: 'Fair', color: 'warning' as const };
    return { rating: 'Poor', color: 'error' as const };
  };

  const generateCodeExample = () => {
    const code = `// 성능 측정 예시
async function measurePerformance(operation, iterations = 10) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = 1000 / avgTime; // 초당 처리 건수

  return {
    avgTime,
    minTime,
    maxTime,
    throughput,
    samples: times.length
  };
}

// 포맷별 처리 시간과 출력 크기 비교
const formats = ['jpeg', 'webp', 'png'] as const;
const formatResults = await Promise.all(
  formats.map(async (format) => {
    const start = performance.now();
    const blob = await processImage(source)
      .resize({ fit: 'cover', width: 800, height: 600 })
      .toBlob({ format, quality: 0.8 });
    const elapsed = performance.now() - start;
    return { format, time: elapsed, size: blob?.size ?? 0 };
  })
);

// Canvas Pool은 내부적으로 자동 활성화됨.
// toCanvas() 사용 시 반드시 직접 관리하거나 toBlob()을 사용하세요.
const blob = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob(); // Canvas가 자동 반환됨`;

    return [
      {
        title: 'Performance Measurement Code',
        code,
        language: 'typescript' as const,
      },
    ];
  };

  // 포맷 비교 결과만 필터링
  const formatResults = results.filter((r) => r.category === 'format');

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Performance Test
      </Typography>
      <Typography variant="body1" color="text.secondary" component="p" sx={{ mb: 2 }}>
        Measure the performance of various image processing operations and identify optimization points.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 테스트 설정 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Test Settings
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Sample Image Size</InputLabel>
                  <Select
                    value={testConfig.sampleImage}
                    label="Sample Image Size"
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        sampleImage: e.target.value as 'small' | 'medium' | 'large',
                      }))
                    }
                  >
                    <MenuItem value="small">Small (200×200)</MenuItem>
                    <MenuItem value="medium">Medium (1920×1080)</MenuItem>
                    <MenuItem value="large">Large (4000×3000)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Iterations</InputLabel>
                  <Select
                    value={testConfig.iterations}
                    label="Iterations"
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        iterations: e.target.value as number,
                      }))
                    }
                  >
                    <MenuItem value={5}>5 times (Fast)</MenuItem>
                    <MenuItem value={10}>10 times (Recommended)</MenuItem>
                    <MenuItem value={20}>20 times (Accurate)</MenuItem>
                    <MenuItem value={50}>50 times (Very Accurate)</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={testConfig.useWebWorker}
                      onChange={(e) =>
                        setTestConfig((prev) => ({
                          ...prev,
                          useWebWorker: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Use Web Worker"
                  sx={{ mb: 2 }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<BenchmarkIcon />}
                  onClick={startPerformanceTests}
                  disabled={running}
                  size="large"
                >
                  {running ? 'Running Tests...' : 'Start Benchmark'}
                </Button>

                {running && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Measuring performance...
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* 시스템 정보 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  System Information
                </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Browser</Typography>
                    <Typography variant="body2">
                      {navigator.userAgent.includes('Chrome')
                        ? 'Chrome'
                        : navigator.userAgent.includes('Firefox')
                          ? 'Firefox'
                          : navigator.userAgent.includes('Safari')
                            ? 'Safari'
                            : 'Other'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">CPU Cores</Typography>
                    <Typography variant="body2">{navigator.hardwareConcurrency || 'Unknown'}</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">WebP Support</Typography>
                    <Chip
                      label={capabilities.webp ? 'Yes' : 'No'}
                      size="small"
                      color={capabilities.webp ? 'success' : 'error'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">OffscreenCanvas</Typography>
                    <Chip
                      label={capabilities.offscreenCanvas ? 'Yes' : 'No'}
                      size="small"
                      color={capabilities.offscreenCanvas ? 'success' : 'error'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">AVIF Support</Typography>
                    <Chip
                      label={capabilities.avif ? 'Yes' : 'No'}
                      size="small"
                      color={capabilities.avif ? 'success' : 'error'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">ImageBitmap</Typography>
                    <Chip
                      label={capabilities.imageBitmap ? 'Yes' : 'No'}
                      size="small"
                      color={capabilities.imageBitmap ? 'success' : 'error'}
                    />
                  </Box>

                  {memoryStats && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>
                        Memory Usage
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Initial</Typography>
                        <Typography variant="body2">{formatMemory(memoryStats.initial.used)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Final</Typography>
                        <Typography variant="body2">{formatMemory(memoryStats.final.used)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Increase</Typography>
                        <Typography variant="body2" color={memoryStats.delta.used > 0 ? 'error' : 'success'}>
                          {memoryStats.delta.used > 0 ? '+' : ''}
                          {formatMemory(memoryStats.delta.used)}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 결과 요약 — 테스트 완료 후 가장 먼저 표시 */}
            {summary && (
              <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    결과 요약 (Result Summary)
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Fastest Format
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {summary.fastestFormat}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Smallest Output
                        </Typography>
                        <Typography variant="h6" color="info.main">
                          {summary.smallestFormat}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Overall Average Processing Time
                        </Typography>
                        <Typography variant="h6">
                          {formatTime(summary.overallAvgTime)}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* 경고 메시지 영역 */}
                  {summary.warnings.length > 0 && (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <WarningIcon fontSize="small" color="warning" />
                        Warnings
                      </Typography>
                      {summary.warnings.map((warning, idx) => (
                        <Alert key={idx} severity="warning" icon={<WarningIcon />}>
                          {warning}
                        </Alert>
                      ))}
                    </Stack>
                  )}

                  {summary.warnings.length === 0 && (
                    <Alert severity="success">All operations completed within acceptable time limits.</Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 포맷 비교 패널 */}
            {formatResults.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Format Comparison
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Processing time and output size comparison across formats (quality: 0.8 for JPEG/WebP)
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Format</TableCell>
                          <TableCell align="right">Avg Time</TableCell>
                          <TableCell align="right">Output Size</TableCell>
                          <TableCell align="center">Rating</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {formatResults.map((result, index) => {
                          const rating = getPerformanceRating(result.avgTime);
                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                  {result.operation}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{formatTime(result.avgTime)}</TableCell>
                              <TableCell align="right">
                                {result.outputSize !== undefined ? formatSize(result.outputSize) : '-'}
                              </TableCell>
                              <TableCell align="center">
                                <Chip label={rating.rating} color={rating.color} size="small" />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Divider sx={{ my: 2 }} />

                  {/* 포맷 선택 가이드 */}
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Format Selection Guide</Typography>
                    <Alert severity="info">
                      <Typography variant="body2">
                        <strong>WebP</strong>: Best balance of quality and file size. Use when browser support is confirmed.
                        <br />
                        <strong>JPEG</strong>: Universal support. Good for photos without transparency.
                        <br />
                        <strong>PNG</strong>: Lossless with transparency support. Larger file size.
                        <br />
                        <br />
                        Canvas Pool is enabled by default — canvases are reused across operations to reduce GC pressure.
                      </Typography>
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* 성능 차트 */}
            {chartData.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Performance Chart
                  </Typography>

                  <Box sx={{ height: 300, mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Average Processing Time (ms)
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avgTime" fill="#1976d2" name="Processing Time (ms)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>

                  <Box sx={{ height: 300 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Throughput (ops/sec)
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="throughput" fill="#2e7d32" name="Throughput (ops/sec)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* 벤치마크 결과 테이블 */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Benchmark Results
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Operation</TableCell>
                          <TableCell align="right">Avg Time</TableCell>
                          <TableCell align="right">Min/Max</TableCell>
                          <TableCell align="right">Throughput</TableCell>
                          <TableCell align="center">Rating</TableCell>
                          <TableCell align="right">Errors</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {results.map((result, index) => {
                          const rating = getPerformanceRating(result.avgTime);
                          return (
                            <TableRow key={index}>
                              <TableCell component="th" scope="row">
                                {result.operation}
                              </TableCell>
                              <TableCell align="right">{formatTime(result.avgTime)}</TableCell>
                              <TableCell align="right">
                                {formatTime(result.minTime)} / {formatTime(result.maxTime)}
                              </TableCell>
                              <TableCell align="right">{result.throughput.toFixed(2)} ops/sec</TableCell>
                              <TableCell align="center">
                                <Chip label={rating.rating} color={rating.color} size="small" />
                              </TableCell>
                              <TableCell align="right">
                                {result.errors > 0 ? <Chip label={result.errors} color="error" size="small" /> : '0'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* 최적화 가이드 */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Optimization Recommendations
                  </Typography>

                  <Stack spacing={2}>
                    {results.some((r) => r.avgTime > 200) && (
                      <Alert severity="warning">
                        Some operations exceed 200ms processing time. Consider using Web Workers or batch processing.
                      </Alert>
                    )}

                    {results.some((r) => r.errors > 0) && (
                      <Alert severity="error">
                        Some operations encountered errors. Consider strengthening error handling logic and input
                        validation.
                      </Alert>
                    )}

                    {memoryStats && memoryStats.delta.used > 50 * 1024 * 1024 && (
                      <Alert severity="info">
                        Memory usage increased by {formatMemory(memoryStats.delta.used)}. Check resource cleanup after
                        processing.
                      </Alert>
                    )}

                    <Alert severity="success">
                      <Typography variant="body2">
                        <strong>Performance Improvement Tips:</strong>
                        <br />• Process large images in stages
                        <br />• Use Web Workers to prevent main thread blocking
                        <br />• Consider sequential processing instead of Promise.all for batch operations
                        <br />• Canvas Pool automatically reuses canvases — use toBlob() to let the pool manage lifecycle
                        <br />• Prefer WebP over PNG for significant file size reduction with similar quality
                      </Typography>
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            <CodeSnippet title="Performance Measurement Code" examples={generateCodeExample()} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
