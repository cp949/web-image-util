import {
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { useState } from 'react'

interface ImageData {
  src: string
  width?: number
  height?: number
  size?: number // bytes
  format?: string
  processingTime?: number // ms
}

interface BeforeAfterViewProps {
  before: ImageData | null
  after: ImageData | null
  showMetadata?: boolean
}

export function BeforeAfterView({ before, after, showMetadata = true }: BeforeAfterViewProps) {
  const [, setFullscreen] = useState<'before' | 'after' | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const downloadImage = async (imageData: ImageData, filename: string) => {
    try {
      const response = await fetch(imageData.src)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const ImageCard = ({
    imageData,
    title,
    type
  }: {
    imageData: ImageData | null
    title: string
    type: 'before' | 'after'
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{title}</Typography>
          {imageData && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="다운로드">
                <IconButton
                  size="small"
                  onClick={() => downloadImage(imageData, `${type}-image.png`)}
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="전체화면">
                <IconButton
                  size="small"
                  onClick={() => setFullscreen(type)}
                >
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
                bgcolor: 'grey.50'
              }}
            >
              <img
                src={imageData.src}
                alt={title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
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
                    <Chip
                      label={`${imageData.width}×${imageData.height}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {imageData.format && (
                    <Chip
                      label={imageData.format.toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {imageData.size && (
                    <Chip
                      label={formatFileSize(imageData.size)}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {imageData.processingTime && (
                    <Chip
                      label={`${imageData.processingTime}ms`}
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
              bgcolor: 'grey.50'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              이미지를 선택해주세요
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )

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

      {/* 처리 통계 비교 */}
      {before && after && showMetadata && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              처리 결과 비교
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  크기 변화
                </Typography>
                <Typography variant="h6">
                  {before.size && after.size ? (
                    `${Math.round((after.size / before.size) * 100)}%`
                  ) : '-'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  해상도
                </Typography>
                <Typography variant="body1">
                  {after.width}×{after.height}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  처리 시간
                </Typography>
                <Typography variant="body1">
                  {after.processingTime ? `${after.processingTime}ms` : '-'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  포맷
                </Typography>
                <Typography variant="body1">
                  {after.format?.toUpperCase() || '-'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}