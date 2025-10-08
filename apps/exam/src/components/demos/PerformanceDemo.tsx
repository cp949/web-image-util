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

  // Sample image settings (actual existing files)
  const sampleImages = {
    small: { src: '/sample-images/sample3.png', width: 300, height: 300 },
    medium: { src: '/sample-images/sample1.jpg', width: 1920, height: 1080 },
    large: { src: '/sample-images/sample2.jpg', width: 4000, height: 3000 },
  };

  // Performance test cases
  const performanceTests: PerformanceTest[] = [
    {
      name: 'Basic Resize',
      description: 'Resize to 300x200',
      category: 'resize',
      operation: () => processImage(sampleImages[testConfig.sampleImage].src).resize({ fit: 'cover', width: 300, height: 200 }).toBlob(),
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
      // Start memory usage measurement
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

          // Update chart data
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

      // Final memory usage measurement
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
    const code = `// Performance measurement example
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

// Usage example
const resizePerf = await measurePerformance(
  () => processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).toBlob()
);

console.log(\`Average: \${resizePerf.avgTime.toFixed(2)}ms\`);
console.log(\`Throughput: \${resizePerf.throughput.toFixed(2)} ops/sec\`);

// Memory usage monitoring
const memoryBefore = performance.memory.usedJSHeapSize;
await heavyImageProcessing();
const memoryAfter = performance.memory.usedJSHeapSize;
const memoryUsed = memoryAfter - memoryBefore;

console.log(\`Memory used: \${(memoryUsed / 1024 / 1024).toFixed(2)}MB\`);`;

    return [
      {
        title: 'Performance Measurement Code',
        code,
        language: 'typescript' as const,
      },
    ];
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Performance Test
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Measure the performance of various image processing operations and identify optimization points.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Test settings */}
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

            {/* System information */}
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
                    <Typography variant="body2">AVIF Support</Typography>
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
            {/* Performance chart */}
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

            {/* Benchmark results table */}
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

            {/* Optimization recommendations */}
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
                        Some operations encountered errors. Consider strengthening error handling logic and input validation.
                      </Alert>
                    )}

                    {memoryStats && memoryStats.delta.used > 50 * 1024 * 1024 && (
                      <Alert severity="info">
                        Memory usage increased by {formatMemory(memoryStats.delta.used)}. Check resource cleanup after processing.
                      </Alert>
                    )}

                    <Alert severity="success">
                      <Typography variant="body2">
                        <strong>Performance Improvement Tips:</strong>
                        <br />
                        • Process large images in stages
                        <br />
                        • Use Web Workers to prevent main thread blocking
                        <br />
                        • Consider sequential processing instead of Promise.all for batch operations
                        <br />• Reuse Canvas objects to reduce GC pressure
                      </Typography>
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Code examples */}
            <CodeSnippet title="Performance Measurement Code" examples={generateCodeExample()} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
