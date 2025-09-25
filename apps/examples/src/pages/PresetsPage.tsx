import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import { useState } from 'react'
// TODO: 실제 라이브러리가 구현되면 import 경로를 수정해야 함
/*
import {
  createThumbnail,
  createAvatar,
  createSocialImage
} from '@cp949/web-image-util'
*/
import { CodeSnippet } from '../components/common/CodeSnippet'
import { ImageUploader } from '../components/common/ImageUploader'
import { BeforeAfterView } from '../components/ui/BeforeAfterView'

const SOCIAL_PLATFORMS = {
  twitter: { width: 1200, height: 675, label: 'Twitter (16:9)' },
  facebook: { width: 1200, height: 630, label: 'Facebook (1.91:1)' },
  instagram: { width: 1080, height: 1080, label: 'Instagram (1:1)' },
  linkedin: { width: 1200, height: 627, label: 'LinkedIn (1.91:1)' },
  youtube: { width: 1280, height: 720, label: 'YouTube (16:9)' },
  pinterest: { width: 1000, height: 1500, label: 'Pinterest (2:3)' }
} as const 

export function PresetsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [originalImage, setOriginalImage] = useState<any>(null)
  const [processedImages, setProcessedImages] = useState<any[]>([])
  const [processing, setProcessing] = useState(false)

  // 썸네일 옵션
  const [thumbnailOptions, setThumbnailOptions] = useState({
    size: 150,
    format: 'jpeg' as 'jpeg' | 'png' | 'webp',
    quality: 0.8,
    fit: 'cover' as 'cover' | 'contain'
  })

  // 아바타 옵션
  const [avatarOptions, setAvatarOptions] = useState({
    size: 128,
    format: 'png' as 'jpeg' | 'png' | 'webp',
    circle: false // Phase 3에서 구현 예정
  })

  // 소셜 이미지 옵션
  const [socialOptions, setSocialOptions] = useState({
    platform: 'instagram' as keyof typeof SOCIAL_PLATFORMS,
    background: '#ffffff',
    format: 'jpeg' as 'jpeg' | 'png' | 'webp',
    quality: 0.85
  })

  const handleImageSelect = (source: File | string) => {
    setProcessedImages([])

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

  // Mock 처리 함수들 (실제 구현 전까지)
  const createMockThumbnail = (src: string, options: any): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = options.size
      canvas.height = options.size

      const img = new Image()
      img.onload = () => {
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, `image/${options.format}`, options.quality)
      }
      img.src = src
    })
  }

  const createMockSocialImage = (src: string, options: any): Promise<Blob> => {
    return new Promise((resolve) => {
      const platformInfo = SOCIAL_PLATFORMS[options.platform as keyof typeof SOCIAL_PLATFORMS]
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = platformInfo.width
      canvas.height = platformInfo.height

      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, `image/${options.format}`, options.quality)
      }
      img.src = src
    })
  }

  const processThumbnail = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      // TODO: 실제 구현에서는 createThumbnail 사용
      const result = await createMockThumbnail(originalImage.src, thumbnailOptions)
      
      const processingTime = Date.now() - startTime
      const url = URL.createObjectURL(result)

      setProcessedImages([{
        src: url,
        width: thumbnailOptions.size,
        height: thumbnailOptions.size,
        size: result.size,
        format: thumbnailOptions.format,
        processingTime
      }])
    } catch (error) {
      console.error('Thumbnail creation failed:', error)
      alert('썸네일 생성 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const processAvatar = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      // TODO: 실제 구현에서는 createAvatar 사용
      const result = await createMockThumbnail(originalImage.src, {
        size: avatarOptions.size,
        format: avatarOptions.format,
        quality: 0.9
      })

      const processingTime = Date.now() - startTime
      const url = URL.createObjectURL(result)

      setProcessedImages([{
        src: url,
        width: avatarOptions.size,
        height: avatarOptions.size,
        size: result.size,
        format: avatarOptions.format,
        processingTime
      }])
    } catch (error) {
      console.error('Avatar creation failed:', error)
      alert('아바타 생성 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const processSocialImage = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      // TODO: 실제 구현에서는 createSocialImage 사용
      const result = await createMockSocialImage(originalImage.src, socialOptions)

      const processingTime = Date.now() - startTime
      const url = URL.createObjectURL(result)
      const platformInfo = SOCIAL_PLATFORMS[socialOptions.platform]

      setProcessedImages([{
        src: url,
        width: platformInfo.width,
        height: platformInfo.height,
        size: result.size,
        format: socialOptions.format,
        processingTime
      }])
    } catch (error) {
      console.error('Social image creation failed:', error)
      alert('소셜 이미지 생성 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  // 배치 처리 (여러 크기 동시 생성)
  const processBatch = async () => {
    if (!originalImage) return

    setProcessing(true)
    const startTime = Date.now()

    try {
      const sizes = [64, 128, 256, 512]
      const results = await Promise.all(
        sizes.map(size => createMockThumbnail(originalImage.src, { 
          size, 
          format: 'png', 
          quality: 0.9 
        }))
      )

      const processingTime = Date.now() - startTime
      const processedBatch = results.map((result, index) => ({
        src: URL.createObjectURL(result),
        width: sizes[index],
        height: sizes[index],
        size: result.size,
        format: 'png',
        processingTime: processingTime / sizes.length // 평균 시간
      }))

      setProcessedImages(processedBatch)
    } catch (error) {
      console.error('Batch processing failed:', error)
      alert('배치 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const generateCodeExamples = () => {
    switch (activeTab) {
      case 0: // 썸네일
        return [{
          title: '썸네일 생성',
          code: `import { createThumbnail } from '@cp949/web-image-util';

// 기본 썸네일 (150px 정사각형)
const thumbnail = await createThumbnail(source, {
  size: ${thumbnailOptions.size}
});

// 고급 옵션
const thumbnail = await createThumbnail(source, {
  size: ${thumbnailOptions.size},
  format: '${thumbnailOptions.format}',
  quality: ${thumbnailOptions.quality},
  fit: '${thumbnailOptions.fit}'
});`,
          language: 'typescript'
        }]

      case 1: // 아바타
        return [{
          title: '아바타 생성',
          code: `import { createAvatar } from '@cp949/web-image-util';

// 기본 아바타 (128px)
const avatar = await createAvatar(source);

// 커스텀 크기
const avatar = await createAvatar(source, {
  size: ${avatarOptions.size},
  format: '${avatarOptions.format}'
});`,
          language: 'typescript'
        }]

      case 2: // 소셜 이미지
        return [{
          title: '소셜 이미지 생성',
          code: `import { createSocialImage } from '@cp949/web-image-util';

// 플랫폼별 권장 크기 자동 적용
const socialImage = await createSocialImage(source, {
  platform: '${socialOptions.platform}'
});

// 커스텀 설정
const socialImage = await createSocialImage(source, {
  platform: '${socialOptions.platform}',
  background: '${socialOptions.background}',
  format: '${socialOptions.format}',
  quality: ${socialOptions.quality}
});`,
          language: 'typescript'
        }]

      case 3: // 배치 처리
        return [{
          title: '배치 처리',
          code: `import { createThumbnail } from '@cp949/web-image-util';

// 여러 크기 동시 생성
const [small, medium, large, xlarge] = await Promise.all([
  createThumbnail(source, { size: 64 }),
  createThumbnail(source, { size: 128 }),
  createThumbnail(source, { size: 256 }),
  createThumbnail(source, { size: 512 })
]);

// 플랫폼별 소셜 이미지 배치 생성
const socialImages = await Promise.all([
  createSocialImage(source, { platform: 'instagram' }),
  createSocialImage(source, { platform: 'twitter' }),
  createSocialImage(source, { platform: 'facebook' })
]);`,
          language: 'typescript'
        }]

      default:
        return []
    }
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        프리셋 기능
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        자주 사용하는 패턴들을 간단한 함수 호출로 처리할 수 있는 편의 기능들입니다.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs:12, md:4 }}>
          <Stack spacing={3}>
            <ImageUploader onImageSelect={handleImageSelect} />

            <Card>
              <CardContent>
                <Tabs
                  value={activeTab}
                  onChange={(_, value) => setActiveTab(value)}
                  variant="fullWidth"
                  sx={{ mb: 3 }}
                >
                  <Tab label="썸네일" />
                  <Tab label="아바타" />
                  <Tab label="소셜" />
                  <Tab label="배치" />
                </Tabs>

                {/* 썸네일 옵션 */}
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      썸네일 설정
                    </Typography>

                    <TextField
                      fullWidth
                      label="크기 (px)"
                      type="number"
                      value={thumbnailOptions.size}
                      onChange={(e) => setThumbnailOptions(prev => ({
                        ...prev,
                        size: parseInt(e.target.value) || 150
                      }))}
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>포맷</InputLabel>
                      <Select
                        value={thumbnailOptions.format}
                        label="포맷"
                        onChange={(e) => setThumbnailOptions(prev => ({
                          ...prev,
                          format: e.target.value as any
                        }))}
                      >
                        <MenuItem value="jpeg">JPEG</MenuItem>
                        <MenuItem value="png">PNG</MenuItem>
                        <MenuItem value="webp">WebP</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>Fit 모드</InputLabel>
                      <Select
                        value={thumbnailOptions.fit}
                        label="Fit 모드"
                        onChange={(e) => setThumbnailOptions(prev => ({
                          ...prev,
                          fit: e.target.value as any
                        }))}
                      >
                        <MenuItem value="cover">Cover</MenuItem>
                        <MenuItem value="contain">Contain</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processThumbnail}
                      disabled={!originalImage || processing}
                    >
                      {processing ? '생성 중...' : '썸네일 생성'}
                    </Button>
                  </Box>
                )}

                {/* 아바타 옵션 */}
                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      아바타 설정
                    </Typography>

                    <TextField
                      fullWidth
                      label="크기 (px)"
                      type="number"
                      value={avatarOptions.size}
                      onChange={(e) => setAvatarOptions(prev => ({
                        ...prev,
                        size: parseInt(e.target.value) || 128
                      }))}
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>포맷</InputLabel>
                      <Select
                        value={avatarOptions.format}
                        label="포맷"
                        onChange={(e) => setAvatarOptions(prev => ({
                          ...prev,
                          format: e.target.value as any
                        }))}
                      >
                        <MenuItem value="jpeg">JPEG</MenuItem>
                        <MenuItem value="png">PNG (투명도 지원)</MenuItem>
                        <MenuItem value="webp">WebP</MenuItem>
                      </Select>
                    </FormControl>

                    <Alert severity="info" sx={{ mb: 3 }}>
                      원형 마스킹과 테두리 기능은 Phase 3에서 추가됩니다.
                    </Alert>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processAvatar}
                      disabled={!originalImage || processing}
                    >
                      {processing ? '생성 중...' : '아바타 생성'}
                    </Button>
                  </Box>
                )}

                {/* 소셜 이미지 옵션 */}
                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      소셜 이미지 설정
                    </Typography>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>플랫폼</InputLabel>
                      <Select
                        value={socialOptions.platform}
                        label="플랫폼"
                        onChange={(e) => setSocialOptions(prev => ({
                          ...prev,
                          platform: e.target.value as any
                        }))}
                      >
                        {Object.entries(SOCIAL_PLATFORMS).map(([key, { label }]) => (
                          <MenuItem key={key} value={key}>{label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* 플랫폼 정보 표시 */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        권장 크기: {SOCIAL_PLATFORMS[socialOptions.platform].width}×{SOCIAL_PLATFORMS[socialOptions.platform].height}
                      </Typography>
                    </Box>

                    <TextField
                      fullWidth
                      label="배경색"
                      value={socialOptions.background}
                      onChange={(e) => setSocialOptions(prev => ({
                        ...prev,
                        background: e.target.value
                      }))}
                      sx={{ mb: 3 }}
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processSocialImage}
                      disabled={!originalImage || processing}
                    >
                      {processing ? '생성 중...' : '소셜 이미지 생성'}
                    </Button>
                  </Box>
                )}

                {/* 배치 처리 옵션 */}
                {activeTab === 3 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      배치 처리
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      여러 크기의 썸네일을 한 번에 생성합니다.
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        생성될 크기들:
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip label="64×64" size="small" />
                        <Chip label="128×128" size="small" />
                        <Chip label="256×256" size="small" />
                        <Chip label="512×512" size="small" />
                      </Stack>
                    </Box>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processBatch}
                      disabled={!originalImage || processing}
                    >
                      {processing ? '생성 중...' : '배치 처리 시작'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{xs:12, md:8}}>
          <Stack spacing={3}>
            {/* 결과 표시 */}
            {processedImages.length === 1 ? (
              <BeforeAfterView
                before={originalImage}
                after={processedImages[0]}
              />
            ) : processedImages.length > 1 ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    배치 처리 결과
                  </Typography>
                  <Grid container spacing={2}>
                    {processedImages.map((image, index) => (
                      <Grid key={index}
                      size={{xs:6, sm:4, md:3}}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Box
                            sx={{
                              width: '100%',
                              height: 150,
                              border: 1,
                              borderColor: 'grey.300',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              mb: 1,
                              bgcolor: 'grey.50'
                            }}
                          >
                            <img
                              src={image.src}
                              alt={`Processed ${index + 1}`}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                              }}
                            />
                          </Box>
                          <Typography variant="caption" display="block">
                            {image.width}×{image.height}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(image.size / 1024)}KB
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      height: 400,
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
                      이미지를 선택하고 프리셋 기능을 사용해보세요
                    </Typography>
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