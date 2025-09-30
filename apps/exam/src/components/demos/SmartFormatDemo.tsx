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
  LinearProgress,
} from '@mui/material';
import { CompareArrows as CompareIcon, CheckCircle, Cancel } from '@mui/icons-material';
import { processImage } from '@cp949/web-image-util';
import type { ResultBlob } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

type FormatType = 'jpeg' | 'png' | 'webp';

interface FormatResult {
  format: FormatType;
  processingTime: number;
  size: number;
  url: string;
  quality: number;
  supported: boolean;
}

const FORMAT_LABELS: Record<FormatType, string> = {
  jpeg: 'JPEG (손실 압축)',
  png: 'PNG (무손실)',
  webp: 'WebP (모던)',
};

export function SmartFormatDemo() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [formatResults, setFormatResults] = useState<FormatResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [browserSupport, setBrowserSupport] = useState({
    webp: false,
    avif: false,
  });

  // 브라우저 포맷 지원 감지
  const checkFormatSupport = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    const avifSupported = canvas.toDataURL('image/avif').startsWith('data:image/avif');

    setBrowserSupport({
      webp: webpSupported,
      avif: avifSupported,
    });
  };

  const handleImageSelect = async (source: File | string) => {
    try {
      if (typeof source === 'string') {
        setSelectedImage(source);
      } else {
        setSelectedImage(URL.createObjectURL(source));
      }
      setError(null);
      setFormatResults([]);
      await checkFormatSupport();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('이미지 선택 실패'));
    }
  };

  const handleFormatComparison = async () => {
    if (!selectedImage) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    const formats: FormatType[] = ['jpeg', 'png', 'webp'];
    const results: FormatResult[] = [];
    const quality = 0.8; // 80% 품질

    try {
      for (let i = 0; i < formats.length; i++) {
        const format = formats[i];
        setProgress(((i + 1) / formats.length) * 100);

        // 브라우저 지원 체크
        const supported =
          format === 'webp' ? browserSupport.webp : true;

        if (!supported) {
          results.push({
            format,
            processingTime: 0,
            size: 0,
            url: '',
            quality,
            supported: false,
          });
          continue;
        }

        const startTime = performance.now();

        const result: ResultBlob = await processImage(selectedImage)
          .resize(800, 600)
          .toBlob({ format, quality });

        results.push({
          format,
          processingTime: performance.now() - startTime,
          size: result.blob.size,
          url: URL.createObjectURL(result.blob),
          quality,
          supported: true,
        });
      }

      setFormatResults(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('포맷 비교 실패'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const calculateSavings = (baseline: number, current: number): string => {
    if (baseline === 0 || current === 0) return 'N/A';
    const savings = ((baseline - current) / baseline) * 100;
    return savings > 0 ? `-${savings.toFixed(1)}%` : `+${Math.abs(savings).toFixed(1)}%`;
  };

  // PNG를 기준으로 절감율 계산
  const pngResult = formatResults.find((r) => r.format === 'png');
  const baselineSize = pngResult?.size || 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        스마트 포맷 비교 데모
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        JPEG, PNG, WebP 포맷을 비교하고 브라우저 지원 여부를 확인해보세요.
        최적의 포맷을 자동으로 추천받을 수 있습니다.
      </Alert>

      {/* 브라우저 지원 정보 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            현재 브라우저 포맷 지원
          </Typography>
          <Stack direction="row" spacing={2}>
            <Chip
              icon={<CheckCircle />}
              label="JPEG"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<CheckCircle />}
              label="PNG"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={browserSupport.webp ? <CheckCircle /> : <Cancel />}
              label="WebP"
              color={browserSupport.webp ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              icon={browserSupport.avif ? <CheckCircle /> : <Cancel />}
              label="AVIF"
              color={browserSupport.avif ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ImageUploader
            onImageSelect={handleImageSelect}
            recommendedSamplesFor="smart-format"
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<CompareIcon />}
            onClick={handleFormatComparison}
            disabled={!selectedImage || processing}
            sx={{ mt: 2 }}
          >
            포맷 비교 시작
          </Button>

          {selectedImage && !processing && formatResults.length === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              이미지가 선택되었습니다. 포맷 비교를 시작하세요.
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {processing && (
            <Box sx={{ mb: 3 }}>
              <ProcessingStatus
                processing={true}
                progress={progress}
                message={`포맷 비교 진행 중... ${Math.round(progress)}%`}
              />
            </Box>
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                setError(null);
                if (selectedImage) handleFormatComparison();
              }}
            />
          )}

          {formatResults.length > 0 && (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                {formatResults.map((result) => (
                  <Grid key={result.format} size={{ xs: 12, sm: 4 }}>
                    <Card>
                      {result.supported && result.url && (
                        <CardMedia
                          component="img"
                          image={result.url}
                          alt={`${result.format} format`}
                          sx={{
                            height: 150,
                            objectFit: 'contain',
                            bgcolor: 'grey.100',
                          }}
                        />
                      )}
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">
                            {FORMAT_LABELS[result.format]}
                          </Typography>
                          {!result.supported && (
                            <Chip label="미지원" color="default" size="small" />
                          )}
                        </Box>
                        {result.supported ? (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary">
                              처리 시간: {result.processingTime.toFixed(0)}ms
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              파일 크기: {formatFileSize(result.size)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              품질: {(result.quality * 100).toFixed(0)}%
                            </Typography>
                            {baselineSize > 0 && (
                              <Typography variant="body2" color="primary">
                                PNG 대비: {calculateSavings(baselineSize, result.size)}
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            현재 브라우저에서 지원하지 않습니다.
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    상세 비교 표
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>포맷</TableCell>
                          <TableCell align="right">처리 시간</TableCell>
                          <TableCell align="right">파일 크기</TableCell>
                          <TableCell align="right">PNG 대비</TableCell>
                          <TableCell align="right">품질</TableCell>
                          <TableCell align="center">브라우저 지원</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {formatResults.map((result) => (
                          <TableRow key={result.format}>
                            <TableCell>{FORMAT_LABELS[result.format]}</TableCell>
                            <TableCell align="right">
                              {result.supported ? `${result.processingTime.toFixed(0)}ms` : 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              {formatFileSize(result.size)}
                            </TableCell>
                            <TableCell align="right">
                              {result.supported ? calculateSavings(baselineSize, result.size) : 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              {result.supported ? `${(result.quality * 100).toFixed(0)}%` : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              {result.supported ? (
                                <CheckCircle color="success" />
                              ) : (
                                <Cancel color="disabled" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* 추천 포맷 */}
              {formatResults.length > 0 && (
                <Alert severity="success">
                  <Typography variant="subtitle2" gutterBottom>
                    추천 포맷
                  </Typography>
                  <Typography variant="body2">
                    {browserSupport.webp
                      ? '• WebP: 최고의 압축률과 품질을 제공합니다 (모던 브라우저)'
                      : '• JPEG: 사진에 적합한 손실 압축 포맷'}
                    <br />
                    {baselineSize > 0 && formatResults.find((r) => r.format === 'webp')?.size && (
                      <>
                        • WebP는 PNG보다 약{' '}
                        {Math.abs(
                          parseFloat(
                            calculateSavings(
                              baselineSize,
                              formatResults.find((r) => r.format === 'webp')?.size || 0
                            )
                          )
                        ).toFixed(0)}
                        % 작습니다
                      </>
                    )}
                  </Typography>
                </Alert>
              )}
            </Stack>
          )}

          {!processing && !error && formatResults.length === 0 && !selectedImage && (
            <Alert severity="info">
              이미지를 선택하고 포맷 비교를 시작하세요.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}