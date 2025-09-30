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
  CardMedia,
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
  Divider,
} from '@mui/material';
import { CompareArrows as CompareIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { processImage } from '@cp949/web-image-util';
import type { ResultBlob } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import { CodeSnippet } from '../common/CodeSnippet';

// 품질 레벨 타입 정의
type QualityLevel = 'standard' | 'high' | 'ultra';

// 품질 레벨별 라벨
const QUALITY_LABELS: Record<QualityLevel, string> = {
  standard: '표준 품질',
  high: '고품질',
  ultra: '최고 품질'
};

// 품질 레벨별 렌더링 크기 (직접 렌더링, scaleFactor 제거)
const QUALITY_SIZES: Record<QualityLevel, { width: number; height: number }> = {
  standard: { width: 400, height: 300 },  // 기본 크기
  high: { width: 800, height: 600 },      // 2배 크기
  ultra: { width: 1600, height: 1200 }    // 4배 크기 (픽셀 완벽)
};

interface QualityResult {
  quality: QualityLevel;
  processingTime: number;
  size: number;
  url: string;
  width: number;
  height: number;
}

export function SvgQualityDemo() {
  const [selectedSvg, setSelectedSvg] = useState<string | null>(null);
  const [qualityResults, setQualityResults] = useState<QualityResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const handleImageSelect = async (source: File | string) => {
    try {
      if (typeof source === 'string') {
        if (!source.endsWith('.svg') && !source.includes('svg')) {
          throw new Error('SVG 파일만 선택할 수 있습니다.');
        }
        setSelectedSvg(source);
      } else {
        if (!source.type.includes('svg')) {
          throw new Error('SVG 파일만 선택할 수 있습니다.');
        }
        setSelectedSvg(URL.createObjectURL(source));
      }
      setError(null);
      setQualityResults([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('이미지 선택 실패'));
    }
  };

  const handleQualityComparison = async () => {
    if (!selectedSvg) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    const qualities: QualityLevel[] = ['standard', 'high', 'ultra'];
    const results: QualityResult[] = [];

    try {
      for (let i = 0; i < qualities.length; i++) {
        const quality = qualities[i];
        const { width, height } = QUALITY_SIZES[quality];

        setProgress(((i + 1) / qualities.length) * 100);

        const startTime = performance.now();

        // 직접 고해상도 렌더링 (scaleFactor 제거)
        const result: ResultBlob = await processImage(selectedSvg)
          .resize({ fit: 'contain', width, height })
          .toBlob('png');

        results.push({
          quality,
          processingTime: performance.now() - startTime,
          size: result.blob.size,
          url: URL.createObjectURL(result.blob),
          width,
          height,
        });
      }

      setQualityResults(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('품질 비교 실패'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        SVG 품질 비교 데모
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        혁신적인 SVG 품질 처리를 체험해보세요.
        "계산은 미리, 렌더링은 한 번" 철학으로 벡터 품질을 완벽하게 보존합니다.
      </Alert>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ImageUploader
            onImageSelect={handleImageSelect}
            supportedFormats={['svg']}
            sampleSelectorType="svg"
            recommendedSamplesFor="svg-quality"
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<CompareIcon />}
            onClick={handleQualityComparison}
            disabled={!selectedSvg || processing}
            sx={{ mt: 2 }}
          >
            품질 비교 시작
          </Button>

          {selectedSvg && !processing && qualityResults.length === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              SVG 이미지가 선택되었습니다. 품질 비교를 시작하세요.
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {processing && (
            <ProcessingStatus
              processing={true}
              message={`품질 비교 진행 중... ${Math.round(progress)}%`}
            />
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                setError(null);
                if (selectedSvg) handleQualityComparison();
              }}
            />
          )}

          {qualityResults.length > 0 && (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                {qualityResults.map((result) => (
                  <Grid key={result.quality} size={{ xs: 12, sm: 6 }}>
                    <Card>
                      <CardMedia
                        component="img"
                        image={result.url}
                        alt={`${result.quality} quality`}
                        sx={{
                          height: 200,
                          objectFit: 'contain',
                          bgcolor: 'grey.100',
                        }}
                      />
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">
                            {QUALITY_LABELS[result.quality]}
                          </Typography>
                          <Chip
                            label={`${result.width}×${result.height}`}
                            color="primary"
                            size="small"
                          />
                        </Box>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            처리 시간: {result.processingTime.toFixed(0)}ms
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            파일 크기: {formatFileSize(result.size)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            해상도: {result.width}×{result.height}px
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    상세 비교
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>품질</TableCell>
                          <TableCell align="right">해상도</TableCell>
                          <TableCell align="right">처리 시간</TableCell>
                          <TableCell align="right">파일 크기</TableCell>
                          <TableCell align="right">효율성</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {qualityResults.map((result) => (
                          <TableRow key={result.quality}>
                            <TableCell>{QUALITY_LABELS[result.quality]}</TableCell>
                            <TableCell align="right">{result.width}×{result.height}</TableCell>
                            <TableCell align="right">{result.processingTime.toFixed(0)}ms</TableCell>
                            <TableCell align="right">{formatFileSize(result.size)}</TableCell>
                            <TableCell align="right">
                              {(result.size / result.processingTime).toFixed(0)} B/ms
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              <Alert severity="success">
                <Typography variant="subtitle2" gutterBottom>
                  품질 개선 분석 결과
                </Typography>
                <Typography variant="body2">
                  • 최고 품질(ultra)은 표준 품질보다{' '}
                  {((qualityResults[2]?.size || 0) / (qualityResults[0]?.size || 1)).toFixed(1)}배 큰 파일 크기
                  <br />
                  • 처리 시간은 약{' '}
                  {((qualityResults[2]?.processingTime || 0) / (qualityResults[0]?.processingTime || 1)).toFixed(1)}배 증가
                  <br />
                  • ⚡ 새로운 직접 렌더링: scaleFactor 제거로 SVG 벡터 품질 완벽 보존
                  <br />
                  • 🎯 "계산은 미리, 렌더링은 한 번" 철학으로 성능과 품질 모두 향상
                </Typography>
              </Alert>
            </Stack>
          )}

          {!processing && !error && qualityResults.length === 0 && !selectedSvg && (
            <Alert severity="info">
              SVG 이미지를 선택하고 품질 비교를 시작하세요.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
