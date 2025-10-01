'use client';

import { CheckCircle, CompareArrows, Download, Error as ErrorIcon, Pending } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useBatchProcessing, type BatchItem } from '../../hooks/useBatchProcessing';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';

/**
 * 프리셋 배치 아이템들
 */
const BATCH_PRESETS: Record<string, BatchItem[]> = {
  sizes: [
    {
      id: 'thumbnail',
      label: '썸네일 (150x150)',
      options: { width: 150, height: 150, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'small',
      label: '작음 (300x200)',
      options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'medium',
      label: '중간 (600x400)',
      options: { width: 600, height: 400, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'large',
      label: '큼 (1200x800)',
      options: { width: 1200, height: 800, fit: 'cover', quality: 80, format: 'jpeg' },
    },
  ],
  formats: [
    {
      id: 'jpeg-high',
      label: 'JPEG 고품질 (95%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 95, format: 'jpeg' },
    },
    {
      id: 'jpeg-medium',
      label: 'JPEG 중품질 (80%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'jpeg-low',
      label: 'JPEG 저품질 (60%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 60, format: 'jpeg' },
    },
    {
      id: 'png',
      label: 'PNG',
      options: { width: 800, height: 600, fit: 'cover', quality: 100, format: 'png' },
    },
    {
      id: 'webp',
      label: 'WebP (80%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 80, format: 'webp' },
    },
  ],
  fits: [
    {
      id: 'cover',
      label: 'Cover (가득 채우기)',
      options: { width: 400, height: 300, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'contain',
      label: 'Contain (전체 포함)',
      options: {
        width: 400,
        height: 300,
        fit: 'contain',
        quality: 85,
        format: 'jpeg',
        background: '#f0f0f0',
      },
    },
    {
      id: 'fill',
      label: 'Fill (늘려서 채우기)',
      options: { width: 400, height: 300, fit: 'fill', quality: 85, format: 'jpeg' },
    },
    {
      id: 'maxFit',
      label: 'MaxFit (축소만)',
      options: { width: 400, height: 300, fit: 'maxFit', quality: 85, format: 'jpeg' },
    },
    {
      id: 'minFit',
      label: 'MinFit (확대만)',
      options: { width: 400, height: 300, fit: 'minFit', quality: 85, format: 'jpeg' },
    },
  ],
  qualities: [
    {
      id: 'quality-100',
      label: '최고 품질 (100%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 100, format: 'jpeg' },
    },
    {
      id: 'quality-90',
      label: '고품질 (90%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 90, format: 'jpeg' },
    },
    {
      id: 'quality-75',
      label: '표준 (75%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 75, format: 'jpeg' },
    },
    {
      id: 'quality-60',
      label: '저품질 (60%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 60, format: 'jpeg' },
    },
    {
      id: 'quality-40',
      label: '최저 품질 (40%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 40, format: 'jpeg' },
    },
  ],
  socialMedia: [
    {
      id: 'instagram-post',
      label: 'Instagram 게시물 (1080x1080)',
      options: { width: 1080, height: 1080, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'instagram-story',
      label: 'Instagram 스토리 (1080x1920)',
      options: { width: 1080, height: 1920, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'twitter-post',
      label: 'Twitter 게시물 (1200x675)',
      options: { width: 1200, height: 675, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'facebook-cover',
      label: 'Facebook 커버 (820x312)',
      options: { width: 820, height: 312, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'youtube-thumbnail',
      label: 'YouTube 썸네일 (1280x720)',
      options: { width: 1280, height: 720, fit: 'cover', quality: 90, format: 'jpeg' },
    },
  ],
  responsive: [
    {
      id: 'desktop-hd',
      label: '데스크톱 HD (1920x1080)',
      options: { width: 1920, height: 1080, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'laptop',
      label: '노트북 (1366x768)',
      options: { width: 1366, height: 768, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'tablet',
      label: '태블릿 (768x1024)',
      options: { width: 768, height: 1024, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'mobile',
      label: '모바일 (375x667)',
      options: { width: 375, height: 667, fit: 'cover', quality: 80, format: 'jpeg' },
    },
  ],
  backgrounds: [
    {
      id: 'bg-white',
      label: '배경: 흰색',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#ffffff' },
    },
    {
      id: 'bg-black',
      label: '배경: 검은색',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#000000' },
    },
    {
      id: 'bg-gray',
      label: '배경: 회색',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#808080' },
    },
    {
      id: 'bg-blue',
      label: '배경: 파란색',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#4A90E2' },
    },
  ],
  thumbnails: [
    {
      id: 'thumb-small',
      label: '작은 썸네일 (100x100)',
      options: { width: 100, height: 100, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'thumb-medium',
      label: '중간 썸네일 (200x200)',
      options: { width: 200, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'thumb-large',
      label: '큰 썸네일 (300x300)',
      options: { width: 300, height: 300, fit: 'cover', quality: 80, format: 'jpeg' },
    },
  ],
};

/**
 * 프리셋 카테고리 구조
 */
const PRESET_CATEGORIES = [
  {
    category: '썸네일',
    presets: [{ key: 'thumbnails', label: '썸네일 비교', count: 3, description: '다양한 썸네일 크기 비교' }],
  },
  {
    category: '크기 및 해상도',
    presets: [
      { key: 'sizes', label: '크기 비교', count: 4, description: '다양한 크기로 비교' },
      { key: 'responsive', label: '반응형 웹', count: 4, description: '디바이스별 최적 크기' },
    ],
  },
  {
    category: '포맷 및 품질',
    presets: [
      { key: 'formats', label: '포맷 비교', count: 5, description: 'JPEG, PNG, WebP 비교' },
      { key: 'qualities', label: '품질 비교', count: 5, description: '압축 품질별 용량 비교' },
    ],
  },
  {
    category: 'Fit 모드',
    presets: [
      { key: 'fits', label: 'Fit 모드 비교', count: 5, description: '5가지 fit 모드 비교' },
      { key: 'backgrounds', label: '배경색 비교', count: 4, description: 'contain fit 배경색' },
    ],
  },
  {
    category: '소셜 미디어',
    presets: [
      {
        key: 'socialMedia',
        label: '플랫폼별 최적화',
        count: 5,
        description: 'Instagram, Twitter 등',
      },
    ],
  },
];

/**
 * 배치 처리 및 결과 비교 데모
 * Phase 4.2: 여러 설정으로 동시 처리 및 결과 비교
 */
export function BatchComparisonDemo() {
  const { originalImage, handleImageSelect } = useImageProcessing();

  const { results, processing, progress, error, successfulResults, failedResults, processBatch, cancel, reset, stats } =
    useBatchProcessing(originalImage, {
      concurrency: 3,
      onProgress: (completed, total) => {
        // 진행 상황 표시용
      },
    });

  const [selectedPreset, setSelectedPreset] = useState<string>('thumbnails');

  /**
   * 프리셋 처리
   */
  const handlePresetProcess = useCallback(
    async (presetKey: string) => {
      const items = BATCH_PRESETS[presetKey];
      if (!items) return;

      setSelectedPreset(presetKey);
      await processBatch(items);
    },
    [processBatch]
  );

  // 이미지 선택 시 자동으로 디폴트 프리셋으로 배치 처리 시작
  useEffect(() => {
    if (originalImage && !processing && selectedPreset) {
      handlePresetProcess(selectedPreset);
    }
  }, [originalImage, selectedPreset, handlePresetProcess]);

  /**
   * 개별 이미지 다운로드
   */
  const downloadSingleImage = useCallback(async (result: (typeof results)[number]) => {
    if (!result.result?.src) return;

    try {
      const FileSaver = await import('file-saver');
      const response = await fetch(result.result.src);
      const blob = await response.blob();
      const extension = result.options.format || 'jpg';
      const filename = `${result.id}.${extension}`;

      FileSaver.saveAs(blob, filename);
    } catch (err) {
      console.error('개별 이미지 다운로드 실패:', err);
      alert('이미지 다운로드에 실패했습니다.');
    }
  }, []);

  /**
   * 파일 크기 포맷
   */
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /**
   * 처리 시간 포맷
   */
  const formatTime = (ms?: number) => {
    if (!ms) return '-';
    return `${ms.toFixed(0)}ms`;
  };

  /**
   * 상태 아이콘
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <Pending color="info" />;
      default:
        return <Pending color="disabled" />;
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        <CompareArrows sx={{ mr: 1, verticalAlign: 'middle' }} />
        배치 처리 및 결과 비교
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        여러 설정으로 동시에 이미지를 처리하고 결과를 비교할 수 있습니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 컨트롤 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 이미지 업로더 */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="basic" />

            {/* 에러 표시 */}
            {error && <ErrorDisplay error={error} onClear={reset} />}

            {/* 진행 상황 */}
            {processing && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    처리 중...
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {progress.completed} / {progress.total} 완료
                  </Typography>
                  <LinearProgress variant="determinate" value={(progress.completed / progress.total) * 100} />
                  <Button fullWidth variant="outlined" color="error" onClick={cancel} sx={{ mt: 2 }}>
                    취소
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 통계 */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    통계
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">전체:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {stats.total}개
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="success.main">
                        완료:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {stats.completed}개
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="error.main">
                        실패:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="error.main">
                        {stats.failed}개
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="info.main">
                        진행중:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="info.main">
                        {stats.processing}개
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Button fullWidth variant="outlined" onClick={reset}>
                      초기화
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* 우측: 결과 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 프리셋 선택 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  프리셋 선택
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {PRESET_CATEGORIES.flatMap((category) =>
                    category.presets.map((preset) => (
                      <Button
                        key={preset.key}
                        size="small"
                        variant={selectedPreset === preset.key ? 'contained' : 'outlined'}
                        onClick={() => setSelectedPreset(preset.key)}
                        disabled={!originalImage || processing}
                        endIcon={<Chip label={preset.count} size="small" />}
                      >
                        {preset.label}
                      </Button>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>

            {results.length === 0 ? (
              <Alert severity="info">
                <Typography variant="body2">프리셋을 선택하여 배치 처리를 시작하세요.</Typography>
              </Alert>
            ) : (
              <>
                {/* 이미지 그리드 */}
                {successfulResults.length > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        이미지 미리보기
                      </Typography>
                      <Grid container spacing={2}>
                        {successfulResults.map((result) => (
                          <Grid key={result.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card variant="outlined">
                              <Box
                                sx={{
                                  position: 'relative',
                                  paddingTop: '75%',
                                  overflow: 'hidden',
                                  backgroundColor: '#f5f5f5',
                                }}
                              >
                                {result.result && result.result.src ? (
                                  <img
                                    src={result.result.src}
                                    alt={result.label}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'contain',
                                    }}
                                    onError={(e) => {
                                      console.error('이미지 로드 실패:', result.label, result.result?.src, e);
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      color: '#666',
                                      textAlign: 'center',
                                    }}
                                  >
                                    이미지 없음
                                    <br />
                                    {result.result ? '(src 없음)' : '(result 없음)'}
                                  </div>
                                )}
                              </Box>
                              <CardContent>
                                <Typography variant="subtitle2" gutterBottom>
                                  {result.label}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                                  <Chip
                                    label={`${result.result?.width}×${result.result?.height}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={formatFileSize(result.result?.size)}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                  />
                                </Stack>
                                <Button
                                  fullWidth
                                  size="small"
                                  variant="outlined"
                                  startIcon={<Download />}
                                  onClick={() => downloadSingleImage(result)}
                                >
                                  다운로드
                                </Button>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                {/* 실패 목록 */}
                {failedResults.length > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="error">
                        실패한 처리
                      </Typography>
                      <Stack spacing={1}>
                        {failedResults.map((result) => (
                          <Alert key={result.id} severity="error">
                            <Typography variant="body2">
                              <strong>{result.label}</strong>: {result.error?.message}
                            </Typography>
                          </Alert>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* 결과 테이블 */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      처리 결과
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>상태</TableCell>
                            <TableCell>이름</TableCell>
                            <TableCell align="right">크기</TableCell>
                            <TableCell align="right">용량</TableCell>
                            <TableCell align="right">처리시간</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {results.map((result) => (
                            <TableRow key={result.id}>
                              <TableCell>{getStatusIcon(result.status)}</TableCell>
                              <TableCell>{result.label}</TableCell>
                              <TableCell align="right">
                                {result.result ? `${result.result.width}×${result.result.height}` : '-'}
                              </TableCell>
                              <TableCell align="right">{formatFileSize(result.result?.size)}</TableCell>
                              <TableCell align="right">{formatTime(result.processingTime)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
