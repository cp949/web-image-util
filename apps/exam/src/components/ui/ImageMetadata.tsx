// 이미지 메타데이터 표시 컴포넌트 - Phase 3: 강화된 메타데이터 표시

'use client';

import {
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
  Chip,
  Box,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  PhotoSizeSelectActual,
  Speed,
  CompareArrows,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import type { ImageInfo, ProcessedImageInfo } from '../demos/types';
import { formatFileSize, formatProcessingTime } from '../../utils/errorHandling';

interface ImageMetadataProps {
  original: ImageInfo | null;
  processed: ProcessedImageInfo | null;
}

export function ImageMetadata({ original, processed }: ImageMetadataProps) {
  if (!original && !processed) return null;

  // 처리 효율성 계산
  const calculateEfficiency = () => {
    if (!original || !processed || !original.size || !processed.size) return null;

    const sizeReduction = 1 - processed.compressionRatio!;
    const processingSpeed = processed.processingTime;

    // 효율성 점수 (크기 감소 + 처리 속도)
    // 크기 감소: 50% 이상 = 우수, 20-50% = 양호, 20% 미만 = 보통
    // 처리 시간: 100ms 미만 = 우수, 100-500ms = 양호, 500ms 이상 = 보통
    let score = 0;
    if (sizeReduction >= 0.5) score += 50;
    else if (sizeReduction >= 0.2) score += 30;
    else score += 10;

    if (processingSpeed < 100) score += 50;
    else if (processingSpeed < 500) score += 30;
    else score += 10;

    return {
      score,
      level: score >= 80 ? '우수' : score >= 50 ? '양호' : '보통',
      color: score >= 80 ? 'success' : score >= 50 ? 'info' : 'warning',
    };
  };

  const efficiency = calculateEfficiency();

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Info color="primary" />
          이미지 정보
        </Typography>

        <Grid container spacing={3}>
          {/* 원본 정보 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: 1,
                borderColor: 'grey.200',
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <PhotoSizeSelectActual fontSize="small" color="action" />
                원본 이미지
              </Typography>
              {original ? (
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      해상도
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {original.width} × {original.height}px
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      총 {(original.width * original.height / 1_000_000).toFixed(2)}MP
                    </Typography>
                  </Box>
                  {original.size && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        파일 크기
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatFileSize(original.size)}
                      </Typography>
                    </Box>
                  )}
                  {original.format && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        포맷
                      </Typography>
                      <Chip label={original.format.toUpperCase()} size="small" color="default" />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  이미지를 선택해주세요
                </Typography>
              )}
            </Box>
          </Grid>

          {/* 처리 결과 정보 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: processed ? 'success.50' : 'grey.50',
                borderRadius: 1,
                border: 1,
                borderColor: processed ? 'success.200' : 'grey.200',
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <CheckCircle fontSize="small" color={processed ? 'success' : 'action'} />
                처리 결과
              </Typography>
              {processed ? (
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      해상도
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {processed.width} × {processed.height}px
                    </Typography>
                    {original && (
                      <Typography variant="caption" color="text.secondary">
                        {processed.width === original.width && processed.height === original.height
                          ? '크기 유지'
                          : `${((processed.width * processed.height) / (original.width * original.height) * 100).toFixed(0)}% 크기`}
                      </Typography>
                    )}
                  </Box>
                  {processed.size && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        파일 크기
                      </Typography>
                      <Typography variant="body1" fontWeight="medium" color="success.main">
                        {formatFileSize(processed.size)}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      처리 시간
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Speed fontSize="small" color="primary" />
                      <Typography variant="body1" fontWeight="medium">
                        {formatProcessingTime(processed.processingTime)}
                      </Typography>
                    </Box>
                  </Box>
                  {processed.compressionRatio && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        압축 효율
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <CompareArrows fontSize="small" color="success" />
                        <Typography
                          variant="body1"
                          fontWeight="medium"
                          color={processed.compressionRatio < 1 ? 'success.main' : 'inherit'}
                        >
                          {(processed.compressionRatio * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      {processed.compressionRatio < 1 && (
                        <LinearProgress
                          variant="determinate"
                          value={(1 - processed.compressionRatio) * 100}
                          color="success"
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      )}
                      {processed.compressionRatio < 1 && (
                        <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                          {((1 - processed.compressionRatio) * 100).toFixed(0)}% 파일 크기 감소
                        </Typography>
                      )}
                    </Box>
                  )}
                  {processed.format && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        포맷
                      </Typography>
                      <Chip label={processed.format.toUpperCase()} size="small" color="success" />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  처리된 이미지 없음
                </Typography>
              )}
            </Box>
          </Grid>

          {/* 처리 효율성 요약 (처리 완료 시에만 표시) */}
          {efficiency && (
            <Grid size={12}>
              <Alert
                severity={efficiency.color as 'success' | 'info' | 'warning'}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                <Box sx={{ width: '100%' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    처리 효율성: <strong>{efficiency.level}</strong> (점수: {efficiency.score}/100)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={efficiency.score}
                    color={efficiency.color as 'success' | 'info' | 'warning'}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {efficiency.score >= 80 && '최적의 압축률과 빠른 처리 속도를 달성했습니다.'}
                    {efficiency.score >= 50 && efficiency.score < 80 && '양호한 성능을 보여줍니다.'}
                    {efficiency.score < 50 && '성능 개선 여지가 있습니다. 옵션을 조정해보세요.'}
                  </Typography>
                </Box>
              </Alert>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}