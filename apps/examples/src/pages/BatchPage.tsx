import { createAvatar, createSocialImage, createThumbnail, processImage } from '@cp949/web-image-util'
import {
  CheckCircle as CompleteIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  PlayArrow as StartIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CodeSnippet } from '../components/common/CodeSnippet'

interface BatchFile {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: Blob
  error?: string
  processingTime?: number
}

interface BatchOptions {
  operation: 'resize' | 'thumbnail' | 'avatar' | 'social'
  width?: number
  height?: number
  size?: number
  format: 'jpeg' | 'png' | 'webp' | 'avif'
  quality: number
  socialPlatform?: 'instagram' | 'twitter' | 'facebook'
}

export function BatchPage() {
  const [files, setFiles] = useState<BatchFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [options, setOptions] = useState<BatchOptions>({
    operation: 'resize',
    width: 300,
    height: 200,
    format: 'jpeg',
    quality: 80
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: BatchFile[] = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      status: 'pending'
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    multiple: true
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id))
  }

  const clearAll = () => {
    setFiles([])
    setProgress(0)
  }

  const processBatch = async () => {
    if (files.length === 0) return

    setProcessing(true)
    setProgress(0)

    const updatedFiles = [...files]
    let completedCount = 0

    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i]
      file.status = 'processing'
      setFiles([...updatedFiles])

      const startTime = Date.now()

      try {
        let result: Blob

        switch (options.operation) {
          case 'resize':
            const resizeResult = await processImage(file.file)
              .resize(options.width!, options.height!)
              .toBlob({
                format: options.format as 'png' | 'jpeg' | 'webp',
                quality: options.quality / 100
              })
            result = resizeResult.blob
            break

          case 'thumbnail':
            const thumbnailResult = await createThumbnail(file.file, {
              size: options.size || 150,
              format: options.format as 'png' | 'webp',
              quality: options.quality / 100
            })
            result = thumbnailResult.blob
            break

          case 'avatar':
            const avatarResult = await createAvatar(file.file, {
              size: options.size || 128,
              format: options.format as 'png' | 'webp'
            })
            result = avatarResult.blob
            break

          case 'social':
            const socialResult = await createSocialImage(file.file, {
              platform: options.socialPlatform || 'instagram',
              format: options.format as 'png' | 'webp',
              quality: options.quality / 100
            })
            result = socialResult.blob
            break

          default:
            throw new Error('Unknown operation')
        }

        file.status = 'completed'
        file.result = result
        file.processingTime = Date.now() - startTime
      } catch (error) {
        file.status = 'error'
        file.error = error instanceof Error ? error.message : '처리 중 오류 발생'
      }

      completedCount++
      setProgress((completedCount / updatedFiles.length) * 100)
      setFiles([...updatedFiles])
    }

    setProcessing(false)
  }

  const downloadResults = async () => {
    const completedFiles = files.filter(file => file.status === 'completed' && file.result)

    if (completedFiles.length === 0) {
      console.log('다운로드할 처리 완료된 파일이 없습니다.')
      return
    }

    const zip = new JSZip()

    for (const file of completedFiles) {
      const extension = options.format === 'jpeg' ? 'jpg' : options.format
      const filename = `${file.file.name.split('.')[0]}_processed.${extension}`
      zip.file(filename, file.result!)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'processed_images.zip')
  }

  const getStatusIcon = (status: BatchFile['status']) => {
    switch (status) {
      case 'completed':
        return <CompleteIcon color="success" />
      case 'error':
        return <ErrorIcon color="error" />
      case 'processing':
        return <LinearProgress sx={{ width: 24, height: 24 }} />
      default:
        return <UploadIcon color="action" />
    }
  }

  const getStatusColor = (status: BatchFile['status']) => {
    switch (status) {
      case 'completed': return 'success'
      case 'error': return 'error'
      case 'processing': return 'warning'
      default: return 'default'
    }
  }

  const generateCodeExample = () => {
    const code = `import { ${options.operation === 'resize' ? 'processImage' :
      options.operation === 'thumbnail' ? 'createThumbnail' :
      options.operation === 'avatar' ? 'createAvatar' : 'createSocialImage'} } from '@cp949/web-image-util';

// 배치 처리 예제
const processFiles = async (files) => {
  const results = [];

  for (const file of files) {
    try {
      ${options.operation === 'resize'
        ? `const result = await processImage(file)
        .resize(${options.width}, ${options.height})
        .toBlob({ format: '${options.format}', quality: ${options.quality / 100} });`
        : options.operation === 'thumbnail'
        ? `const result = await createThumbnail(file, {
        size: ${options.size || 150},
        format: '${options.format}',
        quality: ${options.quality / 100}
      });`
        : options.operation === 'avatar'
        ? `const result = await createAvatar(file, {
        size: ${options.size || 128},
        format: '${options.format}'
      });`
        : `const result = await createSocialImage(file, {
        platform: '${options.socialPlatform || 'instagram'}',
        format: '${options.format}',
        quality: ${options.quality / 100}
      });`}

      results.push({ file, result, status: 'success' });
    } catch (error) {
      results.push({ file, error, status: 'error' });
    }
  }

  return results;
};

// Promise.all로 병렬 처리 (더 빠름)
const processFilesParallel = async (files) => {
  const promises = files.map(async (file) => {
    try {
      ${options.operation === 'resize'
        ? `const result = await processImage(file).resize(${options.width}, ${options.height}).toBlob();`
        : `const result = await ${options.operation}(file, options);`}
      return { file, result, status: 'success' };
    } catch (error) {
      return { file, error, status: 'error' };
    }
  });

  return Promise.all(promises);
};

// JSZip을 사용한 다운로드
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const downloadAsZip = async (results) => {
  const zip = new JSZip();
  
  results.forEach((item, index) => {
    if (item.status === 'success') {
      zip.file(\`processed_\${index}.${options.format}\`, item.result);
    }
  });
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, 'processed_images.zip');
};`

    return [{
      title: '배치 처리 코드',
      code,
      language: 'typescript'
    }]
  }

  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        배치 처리
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        여러 이미지를 동일한 설정으로 한 번에 처리할 수 있습니다.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 파일 업로드 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  이미지 파일 추가
                </Typography>

                <Box
                  {...getRootProps()}
                  sx={{
                    border: 2,
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    borderStyle: 'dashed',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isDragActive ? 'primary.50' : 'background.paper',
                    mb: 2
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="body1" gutterBottom>
                    {isDragActive ? '파일을 여기에 놓으세요' : '여러 이미지를 드래그하거나 클릭하여 선택'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    JPEG, PNG, WebP 파일 지원
                  </Typography>
                </Box>

                {files.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      {files.length}개 파일 선택됨
                    </Typography>
                    <Button size="small" onClick={clearAll} color="error">
                      모두 제거
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* 처리 옵션 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  처리 옵션
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>작업 유형</InputLabel>
                  <Select
                    value={options.operation}
                    label="작업 유형"
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      operation: e.target.value as 'resize' | 'thumbnail' | 'avatar' | 'social'
                    }))}
                  >
                    <MenuItem value="resize">리사이징</MenuItem>
                    <MenuItem value="thumbnail">썸네일</MenuItem>
                    <MenuItem value="avatar">아바타</MenuItem>
                    <MenuItem value="social">소셜 이미지</MenuItem>
                  </Select>
                </FormControl>

                {/* 리사이징 옵션 */}
                {options.operation === 'resize' && (
                  <Box>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="너비"
                          type="number"
                          value={options.width}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            width: parseInt(e.target.value) || 300
                          }))}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="높이"
                          type="number"
                          value={options.height}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            height: parseInt(e.target.value) || 200
                          }))}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* 썸네일/아바타 옵션 */}
                {(options.operation === 'thumbnail' || options.operation === 'avatar') && (
                  <TextField
                    fullWidth
                    label="크기 (px)"
                    type="number"
                    value={options.size || (options.operation === 'thumbnail' ? 150 : 128)}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      size: parseInt(e.target.value) || 150
                    }))}
                    sx={{ mb: 2 }}
                  />
                )}

                {/* 소셜 이미지 옵션 */}
                {options.operation === 'social' && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>플랫폼</InputLabel>
                    <Select
                      value={options.socialPlatform || 'instagram'}
                      label="플랫폼"
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        socialPlatform: e.target.value as 'instagram' | 'twitter' | 'facebook'
                      }))}
                    >
                      <MenuItem value="instagram">Instagram</MenuItem>
                      <MenuItem value="twitter">Twitter</MenuItem>
                      <MenuItem value="facebook">Facebook</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {/* 공통 옵션 */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>출력 포맷</InputLabel>
                  <Select
                    value={options.format}
                    label="출력 포맷"
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      format: e.target.value as 'jpeg' | 'png' | 'webp' | 'avif'
                    }))}
                  >
                    <MenuItem value="jpeg">JPEG</MenuItem>
                    <MenuItem value="png">PNG</MenuItem>
                    <MenuItem value="webp">WebP</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="품질 (%)"
                  type="number"
                  value={options.quality}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    quality: parseInt(e.target.value) || 80
                  }))}
                  inputProps={{ min: 10, max: 100 }}
                  sx={{ mb: 3 }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<StartIcon />}
                  onClick={processBatch}
                  disabled={files.length === 0 || processing}
                  size="large"
                >
                  {processing ? '처리 중...' : `배치 처리 시작 (${files.length}개 파일)`}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 처리 현황 */}
            {files.length > 0 && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">처리 현황</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label={`완료 ${completedCount}`} color="success" size="small" />
                      {errorCount > 0 && (
                        <Chip label={`실패 ${errorCount}`} color="error" size="small" />
                      )}
                    </Stack>
                  </Box>

                  {processing && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress variant="determinate" value={progress} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        진행률: {Math.round(progress)}%
                      </Typography>
                    </Box>
                  )}

                  <List dense>
                    {files.map(file => (
                      <ListItem key={file.id}>
                        <ListItemIcon>
                          {getStatusIcon(file.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={file.file.name}
                          secondary={
                            file.status === 'error' ? file.error :
                            file.status === 'completed' ? `처리 완료 (${file.processingTime}ms)` :
                            file.status === 'processing' ? '처리 중...' : '대기 중'
                          }
                        />
                        <ListItemSecondaryAction>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={file.status}
                              color={getStatusColor(file.status)}
                              size="small"
                            />
                            <IconButton
                              edge="end"
                              onClick={() => removeFile(file.id)}
                              disabled={processing}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  {completedCount > 0 && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={downloadResults}
                        color="success"
                      >
                        처리된 이미지 다운로드 (ZIP)
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 처리 통계 */}
            {completedCount > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    처리 통계
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        총 처리 파일
                      </Typography>
                      <Typography variant="h6">
                        {completedCount}개
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        평균 처리 시간
                      </Typography>
                      <Typography variant="h6">
                        {Math.round(
                          files
                            .filter(f => f.status === 'completed' && f.processingTime)
                            .reduce((sum, f) => sum + (f.processingTime || 0), 0) / completedCount
                        )}ms
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        성공률
                      </Typography>
                      <Typography variant="h6">
                        {Math.round((completedCount / files.length) * 100)}%
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        총 처리된 용량
                      </Typography>
                      <Typography variant="h6">
                        {Math.round(
                          files
                            .filter(f => f.status === 'completed' && f.result)
                            .reduce((sum, f) => sum + (f.result?.size || 0), 0) / 1024 / 1024 * 100
                        ) / 100}MB
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            <CodeSnippet
              title="배치 처리 코드 예제"
              examples={generateCodeExample()}
            />

            {/* 팁 */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>성능 팁:</strong>
                <br />
                • 대용량 파일이 많은 경우 작은 배치로 나누어 처리하세요
                <br />
                • Promise.all을 사용하면 병렬 처리로 더 빠르게 처리할 수 있습니다
                <br />
                • 메모리 사용량을 고려하여 한 번에 너무 많은 파일을 처리하지 마세요
              </Typography>
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  )
}