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
} from '@mui/material';
import { CompareArrows as CompareIcon } from '@mui/icons-material';
import { processImage } from '@cp949/web-image-util';
import type { ResultBlob } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

interface QualityResult {
  quality: QualityLevel;
  processingTime: number;
  size: number;
  url: string;
  scaleFactor: number;
}

const SCALE_FACTORS: Record<QualityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  ultra: 4,
};

const QUALITY_LABELS: Record<QualityLevel, string> = {
  low: '일반 품질 (1x)',
  medium: '중간 품질 (2x)',
  high: '고품질 (3x)',
  ultra: '초고품질 (4x)',
};

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

    const qualities: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
    const results: QualityResult[] = [];

    try {
      for (let i = 0; i < qualities.length; i++) {
        const quality = qualities[i];
        const scaleFactor = SCALE_FACTORS[quality];

        setProgress(((i + 1) / qualities.length) * 100);

        const startTime = performance.now();

        const result: ResultBlob = await processImage(selectedSvg)
          .resize({ fit: 'cover', width: 800 * scaleFactor, height: 600 * scaleFactor })
          .toBlob({ format: 'png' });

        results.push({
          quality,
          processingTime: performance.now() - startTime,
          size: result.blob.size,
          url: URL.createObjectURL(result.blob),
          scaleFactor,
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
        v2.0의 SVG 고품질 처리 시스템을 체험해보세요. 복잡도 자동 분석과
        품질별 스케일링을 확인할 수 있습니다.
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
                          <Chip label={`${result.scaleFactor}x`} color="primary" size="small" />
                        </Box>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            처리 시간: {result.processingTime.toFixed(0)}ms
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            파일 크기: {formatFileSize(result.size)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            해상도: {800 * result.scaleFactor}×{600 * result.scaleFactor}px
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
                          <TableCell align="right">스케일</TableCell>
                          <TableCell align="right">처리 시간</TableCell>
                          <TableCell align="right">파일 크기</TableCell>
                          <TableCell align="right">크기/시간 비율</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {qualityResults.map((result) => (
                          <TableRow key={result.quality}>
                            <TableCell>{QUALITY_LABELS[result.quality]}</TableCell>
                            <TableCell align="right">{result.scaleFactor}x</TableCell>
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
                  분석 결과
                </Typography>
                <Typography variant="body2">
                  • 최고 품질(ultra)은 일반 품질(low)보다{' '}
                  {((qualityResults[3]?.size || 0) / (qualityResults[0]?.size || 1)).toFixed(1)}배 큰 파일 크기
                  <br />
                  • 처리 시간은 약{' '}
                  {((qualityResults[3]?.processingTime || 0) / (qualityResults[0]?.processingTime || 1)).toFixed(1)}배 증가
                  <br />
                  • v2.0의 스마트 스케일링으로 복잡한 SVG도 선명하게 처리
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
