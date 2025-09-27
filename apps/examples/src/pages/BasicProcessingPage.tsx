import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useCallback, useState } from 'react'
import { processImage } from '@cp949/web-image-util'
import { CodeSnippet } from '../components/common/CodeSnippet'
import { ImageUploader } from '../components/common/ImageUploader'
import { BeforeAfterView } from '../components/ui/BeforeAfterView'

interface ProcessOptions {
  width: number
  height: number
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' // 실제 ResizeFit 타입 사용
  quality: number
  format: 'jpeg' | 'jpg' | 'png' | 'webp'
  background: string
}

export function BasicProcessingPage() {
  const [originalImage, setOriginalImage] = useState<any>(null)
  const [processedImage, setProcessedImage] = useState<any>(null)
  const [processing, setProcessing] = useState(false)
  const [options, setOptions] = useState<ProcessOptions>({
    width: 300,
    height: 200,
    fit: 'cover',
    quality: 80,
    format: 'jpeg',
    background: '#ffffff'
  })

  const handleImageSelect = useCallback(async (source: File | string) => {
    setProcessedImage(null)

    // 원본 이미지 정보 설정
    if (typeof source === 'string') {
      const img = new Image()
      img.onload = () => {
        setOriginalImage({
          src: source,
          width: img.width,
          height: img.height,
          format: source.split('.').pop()?.toLowerCase()
        })
      }
      img.src = source
    } else {
      const url = URL.createObjectURL(source)
      const img = new Image()
      img.onload = () => {
        setOriginalImage({
          src: url,
          width: img.width,
          height: img.height,
          size: source.size,
          format: source.type.split('/')[1]
        })
      }
      img.src = url
    }
  }, [])

  const handleProcess = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      const result = await processImage(originalImage.src)
        .resize(options.width, options.height, {
          fit: options.fit,
          background: options.background
        })
        .toBlob({
          format: options.format,
          quality: options.quality / 100
        })

      const processingTime = Date.now() - startTime
      const url = URL.createObjectURL(result.blob)

      setProcessedImage({
        src: url,
        width: result.width,
        height: result.height,
        size: result.blob.size,
        format: options.format,
        processingTime
      })
    } catch (error) {
      console.error('Processing failed:', error)
      console.error('이미지 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  // 코드 예제 생성
  const generateCodeExamples = () => {
    const basicCode = `import { processImage } from '@cp949/web-image-util';

const result = await processImage(source)
  .resize(${options.width}, ${options.height}, {
    fit: '${options.fit}',
    background: '${options.background}'
  })
  .toBlob({
    format: '${options.format}',
    quality: ${options.quality / 100}
  });`

    const advancedCode = `// 더 복잡한 처리 파이프라인
const result = await processImage(source)
  .resize(${options.width}, ${options.height}, { fit: '${options.fit}' })
  .blur(2)  // 블러 효과 추가
  .toBlob({ format: '${options.format}', quality: ${options.quality / 100} });

// 여러 크기로 동시 처리
const [small, medium, large] = await Promise.all([
  processImage(source).resize(150, 100).toBlob(),
  processImage(source).resize(300, 200).toBlob(),
  processImage(source).resize(600, 400).toBlob()
]);`

    return [
      {
        title: '기본 사용법',
        code: basicCode,
        language: 'typescript'
      },
      {
        title: '고급 사용법',
        code: advancedCode,
        language: 'typescript'
      }
    ]
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        기본 이미지 처리
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        processImage API를 사용한 기본 이미지 처리 기능을 확인해보세요.
        리사이징, 포맷 변환, 품질 조정 등의 기능을 실시간으로 테스트할 수 있습니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 이미지 업로더 및 옵션 */}
        <Grid size={{ xs:12, md:4 }}>
          <Stack spacing={3}>
            {/* 이미지 업로더 */}
            <ImageUploader onImageSelect={handleImageSelect} />

            {/* 처리 옵션 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  처리 옵션
                </Typography>

                {/* 크기 설정 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    출력 크기
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{xs:6}}>
                      <TextField
                        fullWidth
                        label="너비"
                        type="number"
                        value={options.width}
                        onChange={(e) => setOptions(prev => ({
                          ...prev,
                          width: parseInt(e.target.value) || 300
                        }))}
                        inputProps={{ min: 1, max: 4000 }}
                      />
                    </Grid>
                    <Grid size={{xs:6}}>
                      <TextField
                        fullWidth
                        label="높이"
                        type="number"
                        value={options.height}
                        onChange={(e) => setOptions(prev => ({
                          ...prev,
                          height: parseInt(e.target.value) || 200
                        }))}
                        inputProps={{ min: 1, max: 4000 }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Fit 모드 */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Fit 모드</InputLabel>
                  <Select
                    value={options.fit}
                    label="Fit 모드"
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      fit: e.target.value as 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
                    }))}
                  >
                    <MenuItem value="cover">Cover (가득 채우기, 잘림)</MenuItem>
                    <MenuItem value="contain">Contain (전체 포함, 여백)</MenuItem>
                    <MenuItem value="fill">Fill (늘려서 채우기)</MenuItem>
                    <MenuItem value="inside">Inside (축소만, 확대 안함)</MenuItem>
                    <MenuItem value="outside">Outside (확대만, 축소 안함)</MenuItem>
                  </Select>
                </FormControl>

                {/* 포맷 선택 */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>출력 포맷</InputLabel>
                  <Select
                    value={options.format}
                    label="출력 포맷"
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      format: e.target.value as 'jpeg' | 'jpg' | 'png' | 'webp'
                    }))}
                  >
                    <MenuItem value="jpeg">JPEG</MenuItem>
                    <MenuItem value="png">PNG</MenuItem>
                    <MenuItem value="webp">WebP</MenuItem>
                  </Select>
                </FormControl>

                {/* 품질 슬라이더 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    품질: {options.quality}%
                  </Typography>
                  <Slider
                    value={options.quality}
                    onChange={(_, value) => setOptions(prev => ({
                      ...prev,
                      quality: value as number
                    }))}
                    min={10}
                    max={100}
                    step={5}
                    marks={[
                      { value: 10, label: '10%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' }
                    ]}
                  />
                </Box>

                {/* 배경색 */}
                <TextField
                  fullWidth
                  label="배경색 (투명 영역)"
                  value={options.background}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    background: e.target.value
                  }))}
                  placeholder="#ffffff"
                  sx={{ mb: 3 }}
                />

                {/* 처리 버튼 */}
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleProcess}
                  disabled={!originalImage || processing}
                  size="large"
                >
                  {processing ? '처리 중...' : '이미지 처리'}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* 우측: 이미지 비교 뷰어 */}
        <Grid size={{xs:12, md:8}}>
          <Stack spacing={3}>
            {/* Before/After 뷰어 */}
            <BeforeAfterView
              before={originalImage}
              after={processedImage}
            />

            {/* 코드 스니펫 */}
            {originalImage && (
              <CodeSnippet
                title="현재 설정의 코드 예제"
                examples={generateCodeExamples()}
              />
            )}
          </Stack>
        </Grid>
      </Grid>

      {/* 도움말 섹션 */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Fit 모드 설명
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{xs:12, sm:6, md:2.4}} >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Cover</Typography>
                <Typography variant="body2">
                  비율 유지하며 전체 영역을 채움, 필요시 잘림
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  CSS object-fit: cover와 동일 (기본값)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{xs:12, sm:6, md:2.4}} >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Contain</Typography>
                <Typography variant="body2">
                  비율 유지하며 전체 이미지가 영역에 들어가도록 맞춤
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  여백으로 채움 (확대/축소 모두)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{xs:12, sm:6, md:2.4}} >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Fill</Typography>
                <Typography variant="body2">
                  비율 무시하고 정확히 맞춤
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  이미지가 늘어나거나 압축됨
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{xs:12, sm:6, md:2.4}} >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Inside</Typography>
                <Typography variant="body2">
                  비율 유지하며 최대 크기 제한
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  축소만, 확대 안함
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{xs:12, sm:6, md:2.4}} >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Outside</Typography>
                <Typography variant="body2">
                  비율 유지하며 최소 크기 보장
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  확대만, 축소 안함
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  )
}