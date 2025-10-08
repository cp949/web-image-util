'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Button,
  Alert,
  Card,
  CardContent,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from '@mui/material';
import { Speed as SpeedIcon, Memory, Timer } from '@mui/icons-material';
import { processImage } from '@cp949/web-image-util';
import type { ResultBlob } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';

type BenchmarkSize = 'small' | 'medium' | 'large';

interface BenchmarkResult {
  size: BenchmarkSize;
  width: number;
  height: number;
  processingTime: number;
  fileSize: number;
  throughput: number; // bytes per second
  memoryUsage: number;
  isMemoryEstimated?: boolean;
}

const SIZE_CONFIGS: Record<BenchmarkSize, { width: number; height: number; label: string }> = {
  small: { width: 300, height: 200, label: 'Small (300x200)' },
  medium: { width: 800, height: 600, label: 'Medium (800x600)' },
  large: { width: 1920, height: 1080, label: 'Large (1920x1080)' },
};

export function PerformanceBenchmarkDemo() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const { measurePerformance } = usePerformanceMonitor();

  const handleImageSelect = async (source: File | string) => {
    try {
      if (typeof source === 'string') {
        setSelectedImage(source);
      } else {
        setSelectedImage(URL.createObjectURL(source));
      }
      setError(null);
      setBenchmarkResults([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Image selection failed'));
    }
  };

  // Run benchmark automatically when image is selected
  useEffect(() => {
    if (selectedImage && !processing) {
      handleBenchmark();
    }
  }, [selectedImage]);

  const handleBenchmark = async () => {
    if (!selectedImage) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    const sizes: BenchmarkSize[] = ['small', 'medium', 'large'];
    const results: BenchmarkResult[] = [];

    try {
      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        const config = SIZE_CONFIGS[size];
        setProgress(((i + 1) / sizes.length) * 100);

        // Estimate memory usage (based on image size)
        const estimatedMemoryUsage = config.width * config.height * 4; // RGBA 4 bytes

        // Performance measurement
        const result: ResultBlob = await measurePerformance(async () => {
          return await processImage(selectedImage)
            .resize({ fit: 'cover', width: config.width, height: config.height })
            .toBlob({ format: 'jpeg', quality: 0.8 });
        });

        // Estimate memory usage (actual measurement is inaccurate due to browser constraints)
        const memoryUsage = estimatedMemoryUsage;
        const isMemoryEstimated = true;

        // Calculate throughput (bytes per second)
        const throughput =
          result.processingTime > 0
            ? (result.blob.size / result.processingTime) * 1000
            : 0;

        results.push({
          size,
          width: config.width,
          height: config.height,
          processingTime: result.processingTime,
          fileSize: result.blob.size,
          throughput,
          memoryUsage,
          isMemoryEstimated,
        });
      }

      setBenchmarkResults(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Benchmark failed'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 0) return 'Estimated'; // Handle negative values
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format memory usage (including estimated value indication)
  const formatMemoryUsage = (bytes: number, isEstimated: boolean = false): string => {
    const size = formatFileSize(Math.abs(bytes));
    return isEstimated ? `~${size}` : size;
  };

  const formatThroughput = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024)
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  // Calculate statistics
  const totalTime = benchmarkResults.reduce((sum, r) => sum + r.processingTime, 0);
  const avgTime =
    benchmarkResults.length > 0 ? totalTime / benchmarkResults.length : 0;
  const totalMemory = benchmarkResults.reduce((sum, r) => sum + r.memoryUsage, 0);
  const avgThroughput =
    benchmarkResults.length > 0
      ? benchmarkResults.reduce((sum, r) => sum + r.throughput, 0) /
        benchmarkResults.length
      : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Performance Benchmark Demo
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Measure processing performance across various image sizes. Compare processing time, memory usage,
        and throughput.
      </Alert>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ImageUploader
            onImageSelect={handleImageSelect}
            recommendedSamplesFor="performance"
          />

          {selectedImage && processing && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Image selected. Starting benchmark automatically.
            </Alert>
          )}

          {/* Benchmark Settings Information */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Benchmark Settings
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  • Small: 300×200px
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Medium: 800×600px
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Large: 1920×1080px
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Format: JPEG (Quality 80%)
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {processing && (
            <Box sx={{ mb: 3 }}>
              <ProcessingStatus
                processing={true}
                progress={progress}
                message={`Benchmark in progress... ${Math.round(progress)}%`}
              />
            </Box>
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                setError(null);
                if (selectedImage) handleBenchmark();
              }}
            />
          )}

          {benchmarkResults.length > 0 && (
            <Stack spacing={3}>
              {/* Selected Image Display */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Selected Image
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    p: 2,
                    maxHeight: 300,
                    overflow: 'hidden'
                  }}>
                    <img
                      src={selectedImage || ''}
                      alt="Selected image"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '250px',
                        objectFit: 'contain',
                        borderRadius: '4px'
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Summary Statistics */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Timer color="primary" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="caption" display="block" color="text.secondary">
                        Average Processing Time
                      </Typography>
                      <Typography variant="h5">{avgTime.toFixed(0)}ms</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Memory color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="caption" display="block" color="text.secondary">
                        Total Memory Usage
                      </Typography>
                      <Typography variant="h5">~{formatFileSize(totalMemory)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <SpeedIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="caption" display="block" color="text.secondary">
                        Average Throughput
                      </Typography>
                      <Typography variant="h5" sx={{ fontSize: '1.3rem' }}>
                        {formatThroughput(avgThroughput)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Timer color="info" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="caption" display="block" color="text.secondary">
                        Total Processing Time
                      </Typography>
                      <Typography variant="h5">{totalTime.toFixed(0)}ms</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Detailed Results Table */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Detailed Benchmark Results
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Size</TableCell>
                          <TableCell align="right">Resolution</TableCell>
                          <TableCell align="right">Processing Time</TableCell>
                          <TableCell align="right">File Size</TableCell>
                          <TableCell align="right">Throughput</TableCell>
                          <TableCell align="right">Memory Usage</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {benchmarkResults.map((result) => (
                          <TableRow key={result.size}>
                            <TableCell>
                              <Chip
                                label={SIZE_CONFIGS[result.size].label}
                                size="small"
                                color={
                                  result.size === 'small'
                                    ? 'success'
                                    : result.size === 'medium'
                                      ? 'primary'
                                      : 'warning'
                                }
                              />
                            </TableCell>
                            <TableCell align="right">
                              {result.width}×{result.height}
                            </TableCell>
                            <TableCell align="right">
                              {result.processingTime.toFixed(2)}ms
                            </TableCell>
                            <TableCell align="right">
                              {formatFileSize(result.fileSize)}
                            </TableCell>
                            <TableCell align="right">
                              {formatThroughput(result.throughput)}
                            </TableCell>
                            <TableCell align="right">
                              {formatMemoryUsage(result.memoryUsage, result.isMemoryEstimated)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Performance Analysis */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Analysis
                  </Typography>
                  <Stack spacing={1}>
                    {benchmarkResults.length >= 2 && (
                      <>
                        <Typography variant="body2">
                          • Small → Medium processing time increase:{' '}
                          {(
                            ((benchmarkResults[1].processingTime -
                              benchmarkResults[0].processingTime) /
                              benchmarkResults[0].processingTime) *
                            100
                          ).toFixed(1)}
                          %
                        </Typography>
                        {benchmarkResults.length >= 3 && (
                          <Typography variant="body2">
                            • Medium → Large processing time increase:{' '}
                            {(
                              ((benchmarkResults[2].processingTime -
                                benchmarkResults[1].processingTime) /
                                benchmarkResults[1].processingTime) *
                              100
                            ).toFixed(1)}
                            %
                          </Typography>
                        )}
                      </>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      💡 Smaller images show faster processing speed and lower memory usage.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Alert severity="success">
                <Typography variant="subtitle2" gutterBottom>
                  Performance Optimization Recommendations
                </Typography>
                <Typography variant="body2">
                  • Average processing time is {avgTime.toFixed(0)}ms.
                  {avgTime < 100 && ' Excellent performance!'}
                  {avgTime >= 100 && avgTime < 500 && ' Good performance.'}
                  {avgTime >= 500 && ' Consider using smaller image sizes.'}
                  <br />
                  • Be mindful of memory usage when processing large images.
                  <br />• For real-time processing, use small to medium sizes.
                </Typography>
              </Alert>
            </Stack>
          )}

          {!processing && !error && benchmarkResults.length === 0 && !selectedImage && (
            <Alert severity="info">
              Select an image to automatically start the benchmark. You can measure performance
              across various sizes.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}