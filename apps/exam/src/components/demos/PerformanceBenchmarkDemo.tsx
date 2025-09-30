'use client';

import { useState } from 'react';
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
}

const SIZE_CONFIGS: Record<BenchmarkSize, { width: number; height: number; label: string }> = {
  small: { width: 300, height: 200, label: '소형 (300x200)' },
  medium: { width: 800, height: 600, label: '중형 (800x600)' },
  large: { width: 1920, height: 1080, label: '대형 (1920x1080)' },
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
      setError(err instanceof Error ? err : new Error('이미지 선택 실패'));
    }
  };

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

        // 메모리 사용량 측정 시작
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

        // 성능 측정
        const result: ResultBlob = await measurePerformance(async () => {
          return await processImage(selectedImage)
            .resize(config.width, config.height)
            .toBlob({ format: 'jpeg', quality: 0.8 });
        });

        const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryUsage = endMemory - startMemory;

        // Throughput 계산 (bytes per second)
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
        });
      }

      setBenchmarkResults(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('벤치마크 실패'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatThroughput = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024)
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  // 통계 계산
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
        성능 벤치마크 데모
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        다양한 이미지 크기에서 처리 성능을 측정합니다. 처리 시간, 메모리 사용량,
        처리량(throughput)을 비교할 수 있습니다.
      </Alert>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ImageUploader
            onImageSelect={handleImageSelect}
            recommendedSamplesFor="performance"
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<SpeedIcon />}
            onClick={handleBenchmark}
            disabled={!selectedImage || processing}
            sx={{ mt: 2 }}
          >
            벤치마크 시작
          </Button>

          {selectedImage && !processing && benchmarkResults.length === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              이미지가 선택되었습니다. 벤치마크를 시작하세요.
            </Alert>
          )}

          {/* 벤치마크 설정 정보 */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                벤치마크 설정
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  • 소형: 300×200px
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 중형: 800×600px
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 대형: 1920×1080px
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 포맷: JPEG (품질 80%)
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
                message={`벤치마크 진행 중... ${Math.round(progress)}%`}
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
              {/* 요약 통계 */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Timer color="primary" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="caption" display="block" color="text.secondary">
                        평균 처리 시간
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
                        총 메모리 사용
                      </Typography>
                      <Typography variant="h5">{formatFileSize(totalMemory)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <SpeedIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="caption" display="block" color="text.secondary">
                        평균 처리량
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
                        총 처리 시간
                      </Typography>
                      <Typography variant="h5">{totalTime.toFixed(0)}ms</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 상세 결과 표 */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    상세 벤치마크 결과
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>크기</TableCell>
                          <TableCell align="right">해상도</TableCell>
                          <TableCell align="right">처리 시간</TableCell>
                          <TableCell align="right">파일 크기</TableCell>
                          <TableCell align="right">처리량</TableCell>
                          <TableCell align="right">메모리 사용</TableCell>
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
                              {formatFileSize(result.memoryUsage)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* 성능 분석 */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    성능 분석
                  </Typography>
                  <Stack spacing={1}>
                    {benchmarkResults.length >= 2 && (
                      <>
                        <Typography variant="body2">
                          • 소형 → 중형 처리 시간 증가율:{' '}
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
                            • 중형 → 대형 처리 시간 증가율:{' '}
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
                      💡 작은 이미지일수록 빠른 처리 속도와 낮은 메모리 사용량을 보입니다.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              {/* 권장 사항 */}
              <Alert severity="success">
                <Typography variant="subtitle2" gutterBottom>
                  성능 최적화 권장 사항
                </Typography>
                <Typography variant="body2">
                  • 평균 처리 시간이 {avgTime.toFixed(0)}ms입니다.
                  {avgTime < 100 && ' 매우 빠른 성능입니다!'}
                  {avgTime >= 100 && avgTime < 500 && ' 좋은 성능입니다.'}
                  {avgTime >= 500 && ' 더 작은 이미지 크기 사용을 권장합니다.'}
                  <br />
                  • 대용량 이미지 처리 시 메모리 사용량에 주의하세요.
                  <br />• 실시간 처리가 필요하다면 소형~중형 크기를 사용하세요.
                </Typography>
              </Alert>
            </Stack>
          )}

          {!processing && !error && benchmarkResults.length === 0 && !selectedImage && (
            <Alert severity="info">
              이미지를 선택하고 벤치마크를 시작하세요. 다양한 크기에서의 성능을 측정할
              수 있습니다.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}