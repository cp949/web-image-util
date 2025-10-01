import { Download as DownloadIcon, Fullscreen as FullscreenIcon, Info as InfoIcon } from '@mui/icons-material';
import { Box, Card, CardContent, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { memo, useState } from 'react';
import { formatFileSize } from '../../utils/errorHandling';

interface ImageData {
  src: string;
  width?: number;
  height?: number;
  size?: number; // bytes
  format?: string;
  processingTime?: number; // ms
}

interface BeforeAfterViewProps {
  before: ImageData | null;
  after: ImageData | null;
  showMetadata?: boolean;
}

function BeforeAfterViewComponent({ before, after, showMetadata = true }: BeforeAfterViewProps) {
  const [, setFullscreen] = useState<'before' | 'after' | null>(null);


  const downloadImage = async (imageData: ImageData, filename: string) => {
    try {
      const response = await fetch(imageData.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Download failed
    }
  };

  const ImageCard = ({
    imageData,
    title,
    type,
  }: {
    imageData: ImageData | null;
    title: string;
    type: 'before' | 'after';
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{title}</Typography>
          {imageData && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="다운로드">
                <IconButton size="small" onClick={() => downloadImage(imageData, `${type}-image.png`)}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="전체화면">
                <IconButton size="small" onClick={() => setFullscreen(type)}>
                  <FullscreenIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {imageData ? (
          <Box>
            {/* 이미지 표시 */}
            <Box
              sx={{
                width: '100%',
                height: 300,
                border: 1,
                borderColor: 'grey.300',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                mb: 2,
                bgcolor: 'grey.50',
              }}
            >
              <img
                src={imageData.src}
                alt={title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
                onLoad={() => {}}
                onError={() => {}}
              />
            </Box>

            {/* 메타데이터 */}
            {showMetadata && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  <InfoIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  정보
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {imageData.width && imageData.height && (
                    <Chip label={`${imageData.width}×${imageData.height}`} size="small" variant="outlined" />
                  )}
                  {imageData.format && <Chip label={imageData.format.toUpperCase()} size="small" variant="outlined" />}
                  {imageData.size && <Chip label={formatFileSize(imageData.size)} size="small" variant="outlined" />}
                  {imageData.processingTime && (
                    <Chip
                      label={`${imageData.processingTime.toFixed(1)}ms`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              height: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 1,
              borderColor: 'grey.300',
              borderStyle: 'dashed',
              borderRadius: 1,
              bgcolor: 'grey.50',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              이미지를 선택해주세요
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ImageCard imageData={before} title="원본" type="before" />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ImageCard imageData={after} title="처리 결과" type="after" />
        </Grid>
      </Grid>

      {/* 처리 통계 비교 - Phase 3: 향상된 비교 명확성 */}
      {before && after && showMetadata && (
        <Card sx={{ mt: 3, bgcolor: 'primary.50', borderLeft: 4, borderColor: 'primary.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="primary" />
              처리 결과 비교
            </Typography>
            <Grid container spacing={2}>
              {/* 파일 크기 변화 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  파일 크기 변화
                </Typography>
                {before.size && after.size ? (
                  <Box>
                    <Typography variant="h5" color={after.size < before.size ? 'success.main' : 'warning.main'}>
                      {Math.round((after.size / before.size) * 100)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(before.size)} → {formatFileSize(after.size)}
                    </Typography>
                    {after.size < before.size && (
                      <Chip
                        label={`${Math.round((1 - after.size / before.size) * 100)}% 감소`}
                        size="small"
                        color="success"
                        sx={{ mt: 0.5 }}
                      />
                    )}
                  </Box>
                ) : (
                  <Typography variant="h6">-</Typography>
                )}
              </Grid>

              {/* 해상도 변화 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  해상도 변화
                </Typography>
                <Box>
                  <Typography variant="h6">
                    {after.width}×{after.height}
                  </Typography>
                  {before.width && before.height && (
                    <Typography variant="caption" color="text.secondary">
                      원본: {before.width}×{before.height}
                    </Typography>
                  )}
                </Box>
              </Grid>

              {/* 처리 시간 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  처리 시간
                </Typography>
                {after.processingTime ? (
                  <Box>
                    <Typography variant="h5" color="primary">
                      {after.processingTime.toFixed(1)}ms
                    </Typography>
                    {after.processingTime < 100 && (
                      <Chip label="빠름" size="small" color="success" sx={{ mt: 0.5 }} />
                    )}
                    {after.processingTime >= 100 && after.processingTime < 500 && (
                      <Chip label="보통" size="small" color="info" sx={{ mt: 0.5 }} />
                    )}
                    {after.processingTime >= 500 && (
                      <Chip label="느림" size="small" color="warning" sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                ) : (
                  <Typography variant="h6">-</Typography>
                )}
              </Grid>

              {/* 포맷 변환 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  포맷
                </Typography>
                <Box>
                  <Typography variant="h6">{after.format?.toUpperCase() || '-'}</Typography>
                  {before.format && after.format && before.format !== after.format && (
                    <Typography variant="caption" color="text.secondary">
                      {before.format.toUpperCase()} → {after.format.toUpperCase()}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// 🎯 React.memo로 불필요한 리렌더링 방지
export const BeforeAfterView = memo(BeforeAfterViewComponent);
