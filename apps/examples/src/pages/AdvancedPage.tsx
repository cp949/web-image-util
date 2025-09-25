import { useState } from 'react'
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  Stack,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert
} from '@mui/material'
import { processImage } from '@cp949/web-image-util'
import { ImageUploader } from '../components/common/ImageUploader'
import { BeforeAfterView } from '../components/ui/BeforeAfterView'
import { CodeSnippet } from '../components/common/CodeSnippet'

type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

interface TextWatermarkOptions {
  text: string
  position: WatermarkPosition
  fontSize: number
  color: string
  opacity: number
  rotation: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  stroke: boolean
  strokeColor: string
  strokeWidth: number
}

interface ImageWatermarkOptions {
  position: WatermarkPosition
  opacity: number
  scale: number
  rotation: number
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light'
}

export function AdvancedPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [originalImage, setOriginalImage] = useState<any>(null)
  const [watermarkImage, setWatermarkImage] = useState<any>(null)
  const [processedImage, setProcessedImage] = useState<any>(null)
  const [processing, setProcessing] = useState(false)

  // 텍스트 워터마크 옵션
  const [textOptions, setTextOptions] = useState<TextWatermarkOptions>({
    text: 'Copyright © 2024',
    position: 'bottom-right',
    fontSize: 24,
    color: '#ffffff',
    opacity: 0.8,
    rotation: 0,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    stroke: true,
    strokeColor: '#000000',
    strokeWidth: 2
  })

  // 이미지 워터마크 옵션
  const [imageOptions, setImageOptions] = useState<ImageWatermarkOptions>({
    position: 'bottom-right',
    opacity: 0.7,
    scale: 0.2,
    rotation: 0,
    blendMode: 'normal'
  })

  const positionOptions = [
    { value: 'top-left', label: '좌상단' },
    { value: 'top-center', label: '상단 중앙' },
    { value: 'top-right', label: '우상단' },
    { value: 'center-left', label: '좌측 중앙' },
    { value: 'center', label: '중앙' },
    { value: 'center-right', label: '우측 중앙' },
    { value: 'bottom-left', label: '좌하단' },
    { value: 'bottom-center', label: '하단 중앙' },
    { value: 'bottom-right', label: '우하단' }
  ]

  const handleImageSelect = (source: File | string) => {
    setProcessedImage(null)

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
  }

  const handleWatermarkImageSelect = (source: File | string) => {
    if (typeof source === 'string') {
      setWatermarkImage({ src: source })
    } else {
      const url = URL.createObjectURL(source)
      setWatermarkImage({ src: url })
    }
  }

  // 캔버스에 텍스트 워터마크를 직접 그리는 함수
  const addTextWatermarkToCanvas = (canvas: HTMLCanvasElement, options: TextWatermarkOptions): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    // 폰트 설정
    ctx.font = `${options.fontWeight} ${options.fontSize}px ${options.fontFamily}`
    ctx.globalAlpha = options.opacity

    // 텍스트 크기 측정
    const textMetrics = ctx.measureText(options.text)
    const textWidth = textMetrics.width
    const textHeight = options.fontSize

    // 위치 계산
    let x = 0, y = 0
    const margin = 20
    
    switch (options.position) {
      case 'top-left':
        x = margin
        y = margin + textHeight
        break
      case 'top-center':
        x = (canvas.width - textWidth) / 2
        y = margin + textHeight
        break
      case 'top-right':
        x = canvas.width - textWidth - margin
        y = margin + textHeight
        break
      case 'center-left':
        x = margin
        y = (canvas.height + textHeight) / 2
        break
      case 'center':
        x = (canvas.width - textWidth) / 2
        y = (canvas.height + textHeight) / 2
        break
      case 'center-right':
        x = canvas.width - textWidth - margin
        y = (canvas.height + textHeight) / 2
        break
      case 'bottom-left':
        x = margin
        y = canvas.height - margin
        break
      case 'bottom-center':
        x = (canvas.width - textWidth) / 2
        y = canvas.height - margin
        break
      case 'bottom-right':
      default:
        x = canvas.width - textWidth - margin
        y = canvas.height - margin
        break
    }

    // 회전 적용
    if (options.rotation !== 0) {
      ctx.save()
      ctx.translate(x + textWidth/2, y - textHeight/2)
      ctx.rotate((options.rotation * Math.PI) / 180)
      ctx.translate(-textWidth/2, textHeight/2)
      x = 0
      y = 0
    }

    // 외곽선 그리기
    if (options.stroke) {
      ctx.strokeStyle = options.strokeColor
      ctx.lineWidth = options.strokeWidth
      ctx.strokeText(options.text, x, y)
    }

    // 텍스트 그리기
    ctx.fillStyle = options.color
    ctx.fillText(options.text, x, y)

    if (options.rotation !== 0) {
      ctx.restore()
    }

    ctx.globalAlpha = 1
    return canvas
  }

  // 캔버스에 이미지 워터마크를 직접 그리는 함수
  const addImageWatermarkToCanvas = (canvas: HTMLCanvasElement, watermarkImg: HTMLImageElement, options: ImageWatermarkOptions): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    // 워터마크 크기 계산
    const scaledWidth = watermarkImg.width * options.scale
    const scaledHeight = watermarkImg.height * options.scale

    // 위치 계산
    let x = 0, y = 0
    const margin = 20

    switch (options.position) {
      case 'top-left':
        x = margin
        y = margin
        break
      case 'top-center':
        x = (canvas.width - scaledWidth) / 2
        y = margin
        break
      case 'top-right':
        x = canvas.width - scaledWidth - margin
        y = margin
        break
      case 'center-left':
        x = margin
        y = (canvas.height - scaledHeight) / 2
        break
      case 'center':
        x = (canvas.width - scaledWidth) / 2
        y = (canvas.height - scaledHeight) / 2
        break
      case 'center-right':
        x = canvas.width - scaledWidth - margin
        y = (canvas.height - scaledHeight) / 2
        break
      case 'bottom-left':
        x = margin
        y = canvas.height - scaledHeight - margin
        break
      case 'bottom-center':
        x = (canvas.width - scaledWidth) / 2
        y = canvas.height - scaledHeight - margin
        break
      case 'bottom-right':
      default:
        x = canvas.width - scaledWidth - margin
        y = canvas.height - scaledHeight - margin
        break
    }

    // 투명도 및 블렌드 모드 설정
    ctx.save()
    ctx.globalAlpha = options.opacity
    ctx.globalCompositeOperation = options.blendMode as GlobalCompositeOperation

    // 회전 적용
    if (options.rotation !== 0) {
      ctx.translate(x + scaledWidth/2, y + scaledHeight/2)
      ctx.rotate((options.rotation * Math.PI) / 180)
      ctx.translate(-scaledWidth/2, -scaledHeight/2)
      x = 0
      y = 0
    }

    // 워터마크 이미지 그리기
    ctx.drawImage(watermarkImg, x, y, scaledWidth, scaledHeight)
    ctx.restore()

    return canvas
  }

  const processTextWatermark = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      // processImage API를 사용하여 캔버스 가져오기
      const result = await processImage(originalImage.src)
        .toCanvas()

      // 텍스트 워터마크 추가
      const watermarkedCanvas = addTextWatermarkToCanvas(result, textOptions)

      // Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Blob 변환 실패'))
          },
          'image/png'
        )
      })

      const processingTime = Date.now() - startTime
      const url = URL.createObjectURL(blob)

      setProcessedImage({
        src: url,
        width: originalImage.width,
        height: originalImage.height,
        size: blob.size,
        format: 'png',
        processingTime
      })
    } catch (error) {
      console.error('Text watermark failed:', error)
      alert('텍스트 워터마크 추가 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const processImageWatermark = async () => {
    if (!originalImage || !watermarkImage) {
      alert('원본 이미지와 워터마크 이미지를 모두 선택해주세요.')
      return
    }

    setProcessing(true)
    const startTime = Date.now()

    try {
      // 워터마크 이미지 로드
      const watermarkImg = new Image()
      watermarkImg.crossOrigin = 'anonymous'
      
      await new Promise<void>((resolve, reject) => {
        watermarkImg.onload = () => resolve()
        watermarkImg.onerror = reject
        watermarkImg.src = watermarkImage.src
      })

      // processImage API를 사용하여 캔버스 가져오기
      const result = await processImage(originalImage.src)
        .toCanvas()

      // 이미지 워터마크 추가
      const watermarkedCanvas = addImageWatermarkToCanvas(result, watermarkImg, imageOptions)

      // Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Blob 변환 실패'))
          },
          'image/png'
        )
      })

      const processingTime = Date.now() - startTime
      const url = URL.createObjectURL(blob)

      setProcessedImage({
        src: url,
        width: originalImage.width,
        height: originalImage.height,
        size: blob.size,
        format: 'png',
        processingTime
      })
    } catch (error) {
      console.error('Image watermark failed:', error)
      alert('이미지 워터마크 추가 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const generateCodeExamples = () => {
    switch (activeTab) {
      case 0: // 텍스트 워터마크
        return [{
          title: '텍스트 워터마크',
          code: `import { processImage } from '@cp949/web-image-util';

// 기본 processImage API 사용
const canvas = await processImage(source).toCanvas();

// 캔버스에 텍스트 워터마크 직접 추가
const ctx = canvas.getContext('2d');
ctx.font = '${textOptions.fontWeight} ${textOptions.fontSize}px ${textOptions.fontFamily}';
ctx.fillStyle = '${textOptions.color}';
ctx.globalAlpha = ${textOptions.opacity};

// 위치 계산 및 텍스트 그리기
const x = canvas.width - textWidth - 20; // ${textOptions.position}
const y = canvas.height - 20;
ctx.fillText('${textOptions.text}', x, y);

// Blob으로 변환
const blob = await new Promise(resolve => {
  canvas.toBlob(resolve, 'image/png');
});`,
          language: 'typescript'
        }]

      case 1: // 이미지 워터마크
        return [{
          title: '이미지 워터마크',
          code: `import { processImage } from '@cp949/web-image-util';

// 기본 processImage API 사용
const canvas = await processImage(mainImage).toCanvas();

// 워터마크 이미지 로드
const watermarkImg = new Image();
watermarkImg.src = watermarkImageSrc;
await new Promise(resolve => watermarkImg.onload = resolve);

// 캔버스에 이미지 워터마크 추가
const ctx = canvas.getContext('2d');
ctx.globalAlpha = ${imageOptions.opacity};
ctx.globalCompositeOperation = '${imageOptions.blendMode}';

const scaledWidth = watermarkImg.width * ${imageOptions.scale};
const scaledHeight = watermarkImg.height * ${imageOptions.scale};
const x = canvas.width - scaledWidth - 20; // ${imageOptions.position}
const y = canvas.height - scaledHeight - 20;

ctx.drawImage(watermarkImg, x, y, scaledWidth, scaledHeight);`,
          language: 'typescript'
        }]

      case 2: // 이미지 합성
        return [{
          title: '이미지 합성 (개발 예정)',
          code: `// Phase 3에서 구현 예정인 고급 합성 기능
import { composeImages } from '@cp949/web-image-util/advanced';

// 여러 이미지를 하나로 합성
const result = await composeImages([
  { src: background, x: 0, y: 0 },
  { src: overlay1, x: 100, y: 50, opacity: 0.8 },
  { src: overlay2, x: 200, y: 100, scale: 0.5 }
], {
  width: 800,
  height: 600,
  format: 'png'
});`,
          language: 'typescript'
        }]

      default:
        return []
    }
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        고급 기능
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        워터마크 추가, 이미지 합성, 다중 레이어 처리 등 고급 이미지 처리 기능을 확인해보세요.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs:12, md:4 }}>
          <Stack spacing={3}>
            {/* 메인 이미지 업로더 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  메인 이미지
                </Typography>
                <ImageUploader onImageSelect={handleImageSelect} />
              </CardContent>
            </Card>

            {/* 기능 선택 탭 */}
            <Card>
              <CardContent>
                <Tabs
                  value={activeTab}
                  onChange={(_, value) => setActiveTab(value)}
                  variant="fullWidth"
                  sx={{ mb: 3 }}
                >
                  <Tab label="텍스트" />
                  <Tab label="이미지" />
                  <Tab label="합성" />
                </Tabs>

                {/* 텍스트 워터마크 옵션 */}
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      텍스트 워터마크
                    </Typography>

                    <TextField
                      fullWidth
                      label="워터마크 텍스트"
                      value={textOptions.text}
                      onChange={(e) => setTextOptions(prev => ({
                        ...prev,
                        text: e.target.value
                      }))}
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>위치</InputLabel>
                      <Select
                        value={textOptions.position}
                        label="위치"
                        onChange={(e) => setTextOptions(prev => ({
                          ...prev,
                          position: e.target.value as WatermarkPosition
                        }))}
                      >
                        {positionOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        폰트 크기: {textOptions.fontSize}px
                      </Typography>
                      <Slider
                        value={textOptions.fontSize}
                        onChange={(_, value) => setTextOptions(prev => ({
                          ...prev,
                          fontSize: value as number
                        }))}
                        min={12}
                        max={72}
                        marks={[
                          { value: 12, label: '12px' },
                          { value: 36, label: '36px' },
                          { value: 72, label: '72px' }
                        ]}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        투명도: {Math.round(textOptions.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={textOptions.opacity}
                        onChange={(_, value) => setTextOptions(prev => ({
                          ...prev,
                          opacity: value as number
                        }))}
                        min={0}
                        max={1}
                        step={0.1}
                        marks={[
                          { value: 0, label: '0%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' }
                        ]}
                      />
                    </Box>

                    <TextField
                      fullWidth
                      label="텍스트 색상"
                      type="color"
                      value={textOptions.color}
                      onChange={(e) => setTextOptions(prev => ({
                        ...prev,
                        color: e.target.value
                      }))}
                      sx={{ mb: 2 }}
                      InputProps={{
                        inputProps: {
                          style: { height: 40 }
                        }
                      }}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={textOptions.stroke}
                          onChange={(e) => setTextOptions(prev => ({
                            ...prev,
                            stroke: e.target.checked
                          }))}
                        />
                      }
                      label="외곽선 사용"
                      sx={{ mb: 2 }}
                    />

                    {textOptions.stroke && (
                      <TextField
                        fullWidth
                        label="외곽선 색상"
                        type="color"
                        value={textOptions.strokeColor}
                        onChange={(e) => setTextOptions(prev => ({
                          ...prev,
                          strokeColor: e.target.value
                        }))}
                        sx={{ mb: 2 }}
                        InputProps={{
                          inputProps: {
                            style: { height: 40 }
                          }
                        }}
                      />
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processTextWatermark}
                      disabled={!originalImage || processing}
                    >
                      {processing ? '처리 중...' : '텍스트 워터마크 적용'}
                    </Button>
                  </Box>
                )}

                {/* 이미지 워터마크 옵션 */}
                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      이미지 워터마크
                    </Typography>

                    {/* 워터마크 이미지 업로더 */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        워터마크 이미지
                      </Typography>
                      <ImageUploader onImageSelect={handleWatermarkImageSelect} />
                    </Box>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>위치</InputLabel>
                      <Select
                        value={imageOptions.position}
                        label="위치"
                        onChange={(e) => setImageOptions(prev => ({
                          ...prev,
                          position: e.target.value as WatermarkPosition
                        }))}
                      >
                        {positionOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        크기: {Math.round(imageOptions.scale * 100)}%
                      </Typography>
                      <Slider
                        value={imageOptions.scale}
                        onChange={(_, value) => setImageOptions(prev => ({
                          ...prev,
                          scale: value as number
                        }))}
                        min={0.1}
                        max={1}
                        step={0.05}
                        marks={[
                          { value: 0.1, label: '10%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' }
                        ]}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        투명도: {Math.round(imageOptions.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={imageOptions.opacity}
                        onChange={(_, value) => setImageOptions(prev => ({
                          ...prev,
                          opacity: value as number
                        }))}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </Box>

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>블렌드 모드</InputLabel>
                      <Select
                        value={imageOptions.blendMode}
                        label="블렌드 모드"
                        onChange={(e) => setImageOptions(prev => ({
                          ...prev,
                          blendMode: e.target.value as any
                        }))}
                      >
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="multiply">Multiply</MenuItem>
                        <MenuItem value="overlay">Overlay</MenuItem>
                        <MenuItem value="soft-light">Soft Light</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processImageWatermark}
                      disabled={!originalImage || !watermarkImage || processing}
                    >
                      {processing ? '처리 중...' : '이미지 워터마크 적용'}
                    </Button>
                  </Box>
                )}

                {/* 이미지 합성 옵션 */}
                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      이미지 합성
                    </Typography>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      고급 이미지 합성 기능은 현재 개발 중입니다.
                      곧 다음 기능들이 추가됩니다:
                    </Alert>

                    <Stack spacing={1} sx={{ mb: 3 }}>
                      <Chip label="다중 레이어 합성" variant="outlined" />
                      <Chip label="그리드 레이아웃" variant="outlined" />
                      <Chip label="콜라주 생성" variant="outlined" />
                      <Chip label="마스킹" variant="outlined" />
                    </Stack>

                    <Button
                      fullWidth
                      variant="outlined"
                      disabled
                    >
                      곧 출시됩니다
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{xs:12, md:8}}>
          <Stack spacing={3}>
            {/* Before/After 뷰어 */}
            <BeforeAfterView
              before={originalImage}
              after={processedImage}
            />

            {/* 워터마크 이미지 미리보기 (이미지 워터마크 탭일 때만) */}
            {activeTab === 1 && watermarkImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    워터마크 이미지
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 200,
                      border: 1,
                      borderColor: 'grey.300',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      bgcolor: 'grey.50'
                    }}
                  >
                    <img
                      src={watermarkImage.src}
                      alt="워터마크"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            {originalImage && (
              <CodeSnippet
                title="현재 설정의 코드 예제"
                examples={generateCodeExamples()}
              />
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  )
}