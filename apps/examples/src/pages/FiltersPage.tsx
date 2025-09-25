import { processImage } from '@cp949/web-image-util'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControlLabel,
  Grid,
  Slider,
  Stack,
  Switch,
  Typography
} from '@mui/material'
import { useState } from 'react'
import { CodeSnippet } from '../components/common/CodeSnippet'
import { ImageUploader } from '../components/common/ImageUploader'
import { BeforeAfterView } from '../components/ui/BeforeAfterView'

interface FilterOptions {
  blur: number
  brightness: number
  contrast: number
  saturation: number
  hue: number
  grayscale: boolean
  sepia: boolean
  invert: boolean
  vintage: boolean
}

export function FiltersPage() {
  const [originalImage, setOriginalImage] = useState<any>(null)
  const [processedImage, setProcessedImage] = useState<any>(null)
  const [processing, setProcessing] = useState(false)

  const [filters, setFilters] = useState<FilterOptions>({
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    grayscale: false,
    sepia: false,
    invert: false,
    vintage: false
  })

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

  // Canvas 2D API를 사용하여 필터 적용하는 함수
  const applyCanvasFilters = (canvas: HTMLCanvasElement, filters: FilterOptions): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    // Canvas 2D API의 filter 속성을 사용하여 필터 적용
    const filterParts: string[] = []

    if (filters.blur > 0) {
      filterParts.push(`blur(${filters.blur}px)`)
    }

    if (filters.brightness !== 100) {
      filterParts.push(`brightness(${filters.brightness}%)`)
    }

    if (filters.contrast !== 100) {
      filterParts.push(`contrast(${filters.contrast}%)`)
    }

    if (filters.saturation !== 100) {
      filterParts.push(`saturate(${filters.saturation}%)`)
    }

    if (filters.hue !== 0) {
      filterParts.push(`hue-rotate(${filters.hue}deg)`)
    }

    if (filters.grayscale) {
      filterParts.push('grayscale(100%)')
    }

    if (filters.sepia) {
      filterParts.push('sepia(100%)')
    }

    if (filters.invert) {
      filterParts.push('invert(100%)')
    }

    // 빈티지 효과는 여러 필터 조합으로 구현
    if (filters.vintage) {
      filterParts.push('sepia(50%)')
      filterParts.push('contrast(120%)')
      filterParts.push('brightness(110%)')
      filterParts.push('saturate(80%)')
    }

    // 필터가 있는 경우에만 적용
    if (filterParts.length > 0) {
      // 새로운 캔버스를 생성하여 필터를 적용
      const filteredCanvas = document.createElement('canvas')
      filteredCanvas.width = canvas.width
      filteredCanvas.height = canvas.height
      const filteredCtx = filteredCanvas.getContext('2d')

      if (filteredCtx) {
        // 필터 적용
        filteredCtx.filter = filterParts.join(' ')
        filteredCtx.drawImage(canvas, 0, 0)
        
        // 원본 캔버스에 필터 적용된 이미지를 다시 그리기
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.filter = 'none' // 필터 초기화
        ctx.drawImage(filteredCanvas, 0, 0)
      }
    }

    return canvas
  }

  const applyFilters = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      // processImage API를 사용하여 기본 처리 후 캔버스 가져오기
      let processor = processImage(originalImage.src)

      // 내장된 블러 필터가 있으므로 우선 적용
      if (filters.blur > 0) {
        processor = processor.blur(filters.blur)
      }

      const canvas = await processor.toCanvas()

      // Canvas 2D API로 추가 필터 적용
      const filteredCanvas = applyCanvasFilters(canvas, {
        ...filters,
        blur: 0 // 이미 적용했으므로 0으로 설정
      })

      // Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        filteredCanvas.toBlob(
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
      console.error('Filter application failed:', error)
      alert('필터 적용 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: false,
      sepia: false,
      invert: false,
      vintage: false
    })
    setProcessedImage(null)
  }

  const presetFilters = {
    vintage: () => setFilters(prev => ({
      ...prev,
      brightness: 110,
      contrast: 120,
      saturation: 80,
      sepia: true,
      vintage: false // sepia가 true이므로 vintage는 false로
    })),
    bw: () => setFilters(prev => ({
      ...prev,
      grayscale: true,
      contrast: 110,
      brightness: 100,
      saturation: 100,
      sepia: false,
      vintage: false
    })),
    dramatic: () => setFilters(prev => ({
      ...prev,
      brightness: 90,
      contrast: 140,
      saturation: 120,
      grayscale: false,
      sepia: false,
      vintage: false
    })),
    soft: () => setFilters(prev => ({
      ...prev,
      blur: 1,
      brightness: 105,
      contrast: 95,
      saturation: 100,
      grayscale: false,
      sepia: false,
      vintage: false
    }))
  }

  const generateCodeExample = () => {
    const filterCalls = []
    const canvasFilters = []

    // processImage API 호출
    if (filters.blur > 0) {
      filterCalls.push(`.blur(${filters.blur})`)
    }

    // Canvas 2D API 필터들
    if (filters.brightness !== 100) {
      canvasFilters.push(`brightness(${filters.brightness}%)`)
    }
    if (filters.contrast !== 100) {
      canvasFilters.push(`contrast(${filters.contrast}%)`)
    }
    if (filters.saturation !== 100) {
      canvasFilters.push(`saturate(${filters.saturation}%)`)
    }
    if (filters.hue !== 0) {
      canvasFilters.push(`hue-rotate(${filters.hue}deg)`)
    }
    if (filters.grayscale) canvasFilters.push('grayscale(100%)')
    if (filters.sepia) canvasFilters.push('sepia(100%)')
    if (filters.invert) canvasFilters.push('invert(100%)')
    if (filters.vintage) canvasFilters.push('sepia(50%) contrast(120%) brightness(110%) saturate(80%)')

    let code = `import { processImage } from '@cp949/web-image-util';

// 1. 기본 processImage API 사용
const canvas = await processImage(source)${filterCalls.join('')}
  .toCanvas();`

    if (canvasFilters.length > 0) {
      code += `

// 2. Canvas 2D API로 추가 필터 적용
const ctx = canvas.getContext('2d');
const filteredCanvas = document.createElement('canvas');
filteredCanvas.width = canvas.width;
filteredCanvas.height = canvas.height;
const filteredCtx = filteredCanvas.getContext('2d');

// 필터 적용
filteredCtx.filter = '${canvasFilters.join(' ')}';
filteredCtx.drawImage(canvas, 0, 0);

// 원본 캔버스에 결과 적용
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.filter = 'none';
ctx.drawImage(filteredCanvas, 0, 0);`
    }

    code += `

// 3. Blob으로 변환
const blob = await new Promise(resolve => {
  canvas.toBlob(resolve, 'image/png');
});`

    return [{
      title: '현재 필터 설정',
      code,
      language: 'typescript'
    }]
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        필터 효과
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        다양한 필터 효과를 적용하여 이미지의 분위기를 변화시켜보세요.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs:12, md:4 }}>
          <Stack spacing={3}>
            <ImageUploader onImageSelect={handleImageSelect} />

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  필터 프리셋
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={presetFilters.vintage}
                  >
                    빈티지
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={presetFilters.bw}
                  >
                    흑백
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={presetFilters.dramatic}
                  >
                    드라마틱
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={presetFilters.soft}
                  >
                    소프트
                  </Button>
                </Stack>

                <Typography variant="h6" gutterBottom>
                  세부 조정
                </Typography>

                {/* 블러 효과 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    블러: {filters.blur}px
                  </Typography>
                  <Slider
                    value={filters.blur}
                    onChange={(_, value) => setFilters(prev => ({
                      ...prev,
                      blur: value as number
                    }))}
                    min={0}
                    max={10}
                    step={0.5}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' }
                    ]}
                  />
                </Box>

                {/* 밝기 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    밝기: {filters.brightness}%
                  </Typography>
                  <Slider
                    value={filters.brightness}
                    onChange={(_, value) => setFilters(prev => ({
                      ...prev,
                      brightness: value as number
                    }))}
                    min={0}
                    max={200}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 100, label: '100%' },
                      { value: 200, label: '200%' }
                    ]}
                  />
                </Box>

                {/* 대비 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    대비: {filters.contrast}%
                  </Typography>
                  <Slider
                    value={filters.contrast}
                    onChange={(_, value) => setFilters(prev => ({
                      ...prev,
                      contrast: value as number
                    }))}
                    min={0}
                    max={200}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 100, label: '100%' },
                      { value: 200, label: '200%' }
                    ]}
                  />
                </Box>

                {/* 채도 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    채도: {filters.saturation}%
                  </Typography>
                  <Slider
                    value={filters.saturation}
                    onChange={(_, value) => setFilters(prev => ({
                      ...prev,
                      saturation: value as number
                    }))}
                    min={0}
                    max={200}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 100, label: '100%' },
                      { value: 200, label: '200%' }
                    ]}
                  />
                </Box>

                {/* 색조 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    색조: {filters.hue}°
                  </Typography>
                  <Slider
                    value={filters.hue}
                    onChange={(_, value) => setFilters(prev => ({
                      ...prev,
                      hue: value as number
                    }))}
                    min={-180}
                    max={180}
                    step={5}
                    marks={[
                      { value: -180, label: '-180°' },
                      { value: 0, label: '0°' },
                      { value: 180, label: '180°' }
                    ]}
                  />
                </Box>

                {/* 특수 효과 */}
                <Typography variant="h6" gutterBottom>
                  특수 효과
                </Typography>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.grayscale}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          grayscale: e.target.checked
                        }))}
                      />
                    }
                    label="그레이스케일"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.sepia}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          sepia: e.target.checked
                        }))}
                      />
                    }
                    label="세피아"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.invert}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          invert: e.target.checked
                        }))}
                      />
                    }
                    label="색상 반전"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.vintage}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          vintage: e.target.checked
                        }))}
                      />
                    }
                    label="빈티지 효과"
                  />
                </Stack>

                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    onClick={applyFilters}
                    disabled={!originalImage || processing}
                    sx={{ flex: 1 }}
                  >
                    {processing ? '적용 중...' : '필터 적용'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={resetFilters}
                  >
                    초기화
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{xs:12, md:8}}>
          <Stack spacing={3}>
            <BeforeAfterView
              before={originalImage}
              after={processedImage}
            />

            {originalImage && (
              <CodeSnippet
                title="현재 필터 설정의 코드"
                examples={generateCodeExample()}
              />
            )}

            {/* 필터 설명 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  필터 효과 설명
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{xs:12, sm:6 }} >
                    <Stack spacing={1}>
                      <Chip label="블러" color="primary" variant="outlined" />
                      <Typography variant="body2">
                        이미지를 부드럽게 만드는 블러 효과
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{xs:12, sm:6 }} >
                    <Stack spacing={1}>
                      <Chip label="밝기" color="primary" variant="outlined" />
                      <Typography variant="body2">
                        이미지의 전체적인 밝기 조정
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{xs:12, sm:6 }} >
                    <Stack spacing={1}>
                      <Chip label="대비" color="primary" variant="outlined" />
                      <Typography variant="body2">
                        명암의 차이를 조정하여 선명도 변경
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{xs:12, sm:6 }} >
                    <Stack spacing={1}>
                      <Chip label="채도" color="primary" variant="outlined" />
                      <Typography variant="body2">
                        색상의 생생함과 강도 조정
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Canvas 2D API 안내 */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>기술적 구현:</strong><br/>
                • 블러 효과는 web-image-util의 내장 API를 사용합니다<br/>
                • 다른 필터들은 Canvas 2D API의 filter 속성을 활용합니다<br/>
                • 모든 브라우저에서 지원되며 하드웨어 가속이 적용됩니다
              </Typography>
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  )
}