'use client'

import { processImage, features } from '@cp949/web-image-util';
import { Assessment as BenchmarkIcon, Speed as SpeedIcon, Timeline as TimelineIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
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
import { useState } from 'react';
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
  throughput: number; // operations per second
  memoryUsage?: number;
  errors: number;
}

interface PerformanceTest {
  name: string;
  description: string;
  operation: () => Promise<any>;
  category: 'resize' | 'format' | 'filter' | 'watermark';
}

export function PerformanceDemo() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  const [testConfig, setTestConfig] = useState({
    iterations: 10,
    sampleImage: 'medium' as 'small' | 'medium' | 'large',
    useWebWorker: false,
    testAllFormats: true,
    testAllSizes: false,
  });

  // 샘플 이미지 설정 (실제 존재하는 파일들)
  const sampleImages = {
    small: { src: '/sample-images/sample3.png', width: 300, height: 300 },
    medium: { src: '/sample-images/sample1.jpg', width: 1920, height: 1080 },
    large: { src: '/sample-images/sample2.jpg', width: 4000, height: 3000 },
  };

  // 성능 테스트 케이스들
  const performanceTests: PerformanceTest[] = [
    {
      name: '기본 리사이징',
      description: '300x200으로 리사이징',
      category: 'resize',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).resize({ fit: 'cover', width: 300, height: 200 }).toBlob(),
    },
    {
      name: 'JPEG 변환',
      description: 'JPEG 포맷으로 변환',
      category: 'format',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).toBlob({ format: 'jpeg', quality: 0.8 }),
    },
    {
      name: 'WebP 변환',
      description: 'WebP 포맷으로 변환',
      category: 'format',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).toBlob({ format: 'webp', quality: 0.8 }),
    },
  ];

  const runBenchmark = async (test: PerformanceTest, iterations: number): Promise<BenchmarkResult> => {
    const times: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        await test.operation();
        const endTime = performance.now();
        times.push(endTime - startTime);
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
    const throughput = 1000 / avgTime; // operations per second

    return {
      operation: test.name,
      iterations: times.length,
      avgTime,
      minTime,
      maxTime,
      throughput,
      errors,
    };
  };

  const startPerformanceTests = async () => {
    setRunning(true);
    setResults([]);
    setChartData([]);

    try {
      // 메모리 사용량 측정 시작
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

      // 최종 메모리 사용량 측정
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

  const getPerformanceRating = (avgTime: number) => {
    if (avgTime < 50) return { rating: 'Excellent', color: 'success' as const };
    if (avgTime < 100) return { rating: 'Good', color: 'primary' as const };
    if (avgTime < 200) return { rating: 'Fair', color: 'warning' as const };
    return { rating: 'Poor', color: 'error' as const };
  };

  const generateCodeExample = () => {
    const code = `// 성능 측정 예제
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
  const throughput = 1000 / avgTime; // ops/sec

  return {
    avgTime,
    minTime,
    maxTime,
    throughput,
    samples: times.length
  };
}

// 사용 예시
const resizePerf = await measurePerformance(
  () => processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).toBlob()
);

console.log(\`Average: \${resizePerf.avgTime.toFixed(2)}ms\`);
console.log(\`Throughput: \${resizePerf.throughput.toFixed(2)} ops/sec\`);

// 메모리 사용량 모니터링
const memoryBefore = performance.memory.usedJSHeapSize;
await heavyImageProcessing();
const memoryAfter = performance.memory.usedJSHeapSize;
const memoryUsed = memoryAfter - memoryBefore;

console.log(\`Memory used: \${(memoryUsed / 1024 / 1024).toFixed(2)}MB\`);`;

    return [
      {
        title: '성능 측정 코드',
        code,
        language: 'typescript' as const,
      },
    ];
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        성능 테스트
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        다양한 이미지 처리 작업의 성능을 측정하고 최적화 포인트를 찾아보세요.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 테스트 설정 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  테스트 설정
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>샘플 이미지 크기</InputLabel>
                  <Select
                    value={testConfig.sampleImage}
                    label="샘플 이미지 크기"
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
                  <InputLabel>반복 횟수</InputLabel>
                  <Select
                    value={testConfig.iterations}
                    label="반복 횟수"
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        iterations: e.target.value as number,
                      }))
                    }
                  >
                    <MenuItem value={5}>5회 (빠름)</MenuItem>
                    <MenuItem value={10}>10회 (권장)</MenuItem>
                    <MenuItem value={20}>20회 (정확)</MenuItem>
                    <MenuItem value={50}>50회 (매우 정확)</MenuItem>
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
                  label="Web Worker 사용"
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
                  {running ? '테스트 실행 중...' : '벤치마크 시작'}
                </Button>

                {running && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      성능 측정 중...
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
                  시스템 정보
                </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">브라우저</Typography>
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
                    <Typography variant="body2">CPU 코어</Typography>
                    <Typography variant="body2">{navigator.hardwareConcurrency || 'Unknown'}</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">WebP 지원</Typography>
                    <Chip
                      label={features.webp ? 'Yes' : 'No'}
                      size="small"
                      color={features.webp ? 'success' : 'error'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">OffscreenCanvas</Typography>
                    <Chip
                      label={features.offscreenCanvas ? 'Yes' : 'No'}
                      size="small"
                      color={features.offscreenCanvas ? 'success' : 'error'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">AVIF 지원</Typography>
                    <Chip
                      label={features.avif ? 'Yes' : 'No'}
                      size="small"
                      color={features.avif ? 'success' : 'error'}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">ImageBitmap</Typography>
                    <Chip
                      label={features.imageBitmap ? 'Yes' : 'No'}
                      size="small"
                      color={features.imageBitmap ? 'success' : 'error'}
                    />
                  </Box>

                  {memoryStats && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>
                        메모리 사용량
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">시작</Typography>
                        <Typography variant="body2">{formatMemory(memoryStats.initial.used)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">종료</Typography>
                        <Typography variant="body2">{formatMemory(memoryStats.final.used)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">증가량</Typography>
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
            {/* 성능 차트 */}
            {chartData.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    성능 차트
                  </Typography>

                  <Box sx={{ height: 300, mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      평균 처리 시간 (ms)
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avgTime" fill="#1976d2" name="처리 시간 (ms)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>

                  <Box sx={{ height: 300 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      처리량 (ops/sec)
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="throughput" fill="#2e7d32" name="처리량 (ops/sec)" />
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
                    벤치마크 결과
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>작업</TableCell>
                          <TableCell align="right">평균 시간</TableCell>
                          <TableCell align="right">최소/최대</TableCell>
                          <TableCell align="right">처리량</TableCell>
                          <TableCell align="center">성능 등급</TableCell>
                          <TableCell align="right">에러</TableCell>
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

            {/* 최적화 추천 */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    성능 최적화 추천
                  </Typography>

                  <Stack spacing={2}>
                    {results.some((r) => r.avgTime > 200) && (
                      <Alert severity="warning">
                        일부 작업의 처리 시간이 200ms를 초과합니다. Web Worker 사용이나 배치 처리를 고려해보세요.
                      </Alert>
                    )}

                    {results.some((r) => r.errors > 0) && (
                      <Alert severity="error">
                        일부 작업에서 에러가 발생했습니다. 에러 처리 로직과 입력 검증을 강화해보세요.
                      </Alert>
                    )}

                    {memoryStats && memoryStats.delta.used > 50 * 1024 * 1024 && (
                      <Alert severity="info">
                        메모리 사용량이 {formatMemory(memoryStats.delta.used)} 증가했습니다. 처리 후 리소스 정리를
                        확인해보세요.
                      </Alert>
                    )}

                    <Alert severity="success">
                      <Typography variant="body2">
                        <strong>성능 개선 팁:</strong>
                        <br />
                        • 대용량 이미지는 단계적으로 처리하세요
                        <br />
                        • Web Worker를 사용하여 메인 스레드 블로킹을 방지하세요
                        <br />
                        • 배치 처리 시 Promise.all 대신 순차 처리를 고려하세요
                        <br />• Canvas 객체를 재사용하여 GC 부담을 줄이세요
                      </Typography>
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            <CodeSnippet title="성능 측정 코드" examples={generateCodeExample()} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
