// 이미지 메타데이터 표시 컴포넌트

'use client';

import { Card, CardContent, Grid, Stack, Typography, Chip, Box } from '@mui/material';
import type { ImageInfo, ProcessedImageInfo } from '../demos/types';
import { formatFileSize, formatProcessingTime } from '../../utils/errorHandling';

interface ImageMetadataProps {
  original: ImageInfo | null;
  processed: ProcessedImageInfo | null;
}

export function ImageMetadata({ original, processed }: ImageMetadataProps) {
  if (!original && !processed) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          이미지 정보
        </Typography>

        <Grid container spacing={2}>
          {/* 원본 정보 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              원본
            </Typography>
            {original ? (
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    크기
                  </Typography>
                  <Typography variant="body2">
                    {original.width} × {original.height}px
                  </Typography>
                </Box>
                {original.size && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      파일 크기
                    </Typography>
                    <Typography variant="body2">{formatFileSize(original.size)}</Typography>
                  </Box>
                )}
                {original.format && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      형식
                    </Typography>
                    <Chip label={original.format.toUpperCase()} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                이미지를 선택해주세요
              </Typography>
            )}
          </Grid>

          {/* 처리 결과 정보 */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              처리 결과
            </Typography>
            {processed ? (
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    크기
                  </Typography>
                  <Typography variant="body2">
                    {processed.width} × {processed.height}px
                  </Typography>
                </Box>
                {processed.size && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      파일 크기
                    </Typography>
                    <Typography variant="body2">{formatFileSize(processed.size)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    처리 시간
                  </Typography>
                  <Typography variant="body2">{formatProcessingTime(processed.processingTime)}</Typography>
                </Box>
                {processed.compressionRatio && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      압축률
                    </Typography>
                    <Typography variant="body2" color={processed.compressionRatio < 1 ? 'success.main' : 'inherit'}>
                      {(processed.compressionRatio * 100).toFixed(1)}%
                      {processed.compressionRatio < 1 && (
                        <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                          ({((1 - processed.compressionRatio) * 100).toFixed(0)}% 감소)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                )}
                {processed.format && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      형식
                    </Typography>
                    <Chip label={processed.format.toUpperCase()} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                처리된 이미지 없음
              </Typography>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}