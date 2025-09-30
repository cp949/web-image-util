import { useCallback, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  LinearProgress,
  Stack,
  Chip
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Link as LinkIcon
} from '@mui/icons-material'
import { useDropzone } from 'react-dropzone'
import { SampleImageSelector } from './SampleImageSelector'

interface ImageUploaderProps {
  onImageSelect: (source: File | string) => void
  supportedFormats?: string[]
  maxSize?: number // MB
  /** 샘플 이미지 선택기 표시 여부 (기본값: true) */
  showSampleSelector?: boolean
  /** 샘플 선택기 타입 필터 */
  sampleSelectorType?: 'all' | 'jpg' | 'png' | 'svg'
  /** 샘플 선택기 컴팩트 모드 */
  sampleSelectorCompact?: boolean
  /** 추천 샘플 데모 타입 */
  recommendedSamplesFor?: string
}

export function ImageUploader({
  onImageSelect,
  supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  maxSize = 10,
  showSampleSelector = true,
  sampleSelectorType = 'all',
  sampleSelectorCompact = true,
  recommendedSamplesFor
}: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]

      // 파일 크기 체크
      if (file.size > maxSize * 1024 * 1024) {
        setError(`파일 크기는 ${maxSize}MB 이하여야 합니다.`)
        return
      }

      setError(null)
      setLoading(true)

      try {
        onImageSelect(file)
      } catch (err) {
        setError('이미지 로드 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
  }, [onImageSelect, maxSize])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': supportedFormats.map(format => `.${format}`)
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  })

  const handleUrlInput = () => {
    const url = prompt('이미지 URL을 입력하세요:')
    if (url) {
      setError(null)
      onImageSelect(url)
    }
  }

  return (
    <Stack spacing={3}>
      {/* 기존 파일 업로드 UI */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            이미지 선택
          </Typography>

          {/* 드래그앤드롭 영역 */}
          <Box
            {...getRootProps()}
            sx={{
              border: 2,
              borderColor: dragActive ? 'primary.main' : 'grey.300',
              borderStyle: 'dashed',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: dragActive ? 'primary.50' : 'background.paper',
              transition: 'all 0.2s ease',
              mb: 2,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'primary.50'
              }
            }}
          >
            <input {...getInputProps()} />
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? '이미지를 여기에 놓으세요' : '이미지를 드래그하거나 클릭하여 선택'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              지원 포맷: {supportedFormats.join(', ').toUpperCase()} (최대 {maxSize}MB)
            </Typography>
          </Box>

          {/* 추가 옵션 버튼들 */}
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={handleUrlInput}
            >
              URL로 불러오기
            </Button>

          </Stack>

          {/* 로딩 상태 */}
          {loading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                이미지 로드 중...
              </Typography>
            </Box>
          )}

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* 포맷 지원 정보 */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              지원 포맷:
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {supportedFormats.map(format => (
                <Chip key={format} label={format.toUpperCase()} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* 샘플 이미지 선택기 */}
      {showSampleSelector && (
        <SampleImageSelector
          onImageSelect={onImageSelect}
          selectedType={sampleSelectorType}
          compact={sampleSelectorCompact}
          recommendedFor={recommendedSamplesFor}
        />
      )}
    </Stack>
  )
}