'use client';

import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface TextWatermarkOptions {
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  stroke: boolean;
  strokeColor: string;
  strokeWidth: number;
}

interface ImageWatermarkOptions {
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  rotation: number;
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light';
}

interface ImageData {
  src: string;
  width: number;
  height: number;
  size?: number;
  format?: string;
}

export function AdvancedDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [watermarkImage, setWatermarkImage] = useState<ImageData | null>(null);
  const [processedImage, setProcessedImage] = useState<ImageData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
    strokeWidth: 2,
  });

  // 이미지 워터마크 옵션
  const [imageOptions, setImageOptions] = useState<ImageWatermarkOptions>({
    position: 'bottom-right',
    opacity: 0.7,
    scale: 0.2,
    rotation: 0,
    blendMode: 'normal',
  });

  const positionOptions = [
    { value: 'top-left', label: '좌상단' },
    { value: 'top-center', label: '상단 중앙' },
    { value: 'top-right', label: '우상단' },
    { value: 'center-left', label: '좌측 중앙' },
    { value: 'center', label: '중앙' },
    { value: 'center-right', label: '우측 중앙' },
    { value: 'bottom-left', label: '좌하단' },
    { value: 'bottom-center', label: '하단 중앙' },
    { value: 'bottom-right', label: '우하단' },
  ];

  const handleImageSelect = (source: File | string) => {
    setProcessedImage(null);

    if (typeof source === 'string') {
      const img = new Image();
      img.onload = () => {
        setOriginalImage({
          src: source,
          width: img.width,
          height: img.height,
          format: source.split('.').pop()?.toLowerCase(),
        });
      };
      img.src = source;
    } else {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => {
        setOriginalImage({
          src: url,
          width: img.width,
          height: img.height,
          size: source.size,
          format: source.type.split('/')[1],
        });
      };
      img.src = url;
    }
  };

  const handleWatermarkImageSelect = (source: File | string) => {
    if (typeof source === 'string') {
      const img = new Image();
      img.onload = () => {
        setWatermarkImage({ src: source, width: img.width, height: img.height });
      };
      img.src = source;
    } else {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => {
        setWatermarkImage({ src: url, width: img.width, height: img.height, size: source.size });
      };
      img.src = url;
    }
  };

  const processTextWatermark = async () => {
    if (!originalImage) return;

    setProcessing(true);
    setError(null);
    try {
      // 먼저 기본 이미지를 Canvas로 변환
      const processor = processImage(originalImage.src);
      const canvasResult = await processor.toCanvas();

      // 텍스트 워터마크 추가
      const watermarkedCanvas = SimpleWatermark.addText(canvasResult.canvas, {
        text: textOptions.text,
        position: textOptions.position,
        size: textOptions.fontSize,
        opacity: textOptions.opacity,
        style: {
          fontFamily: textOptions.fontFamily,
          color: textOptions.color,
          strokeColor: textOptions.stroke ? textOptions.strokeColor : undefined,
          strokeWidth: textOptions.stroke ? textOptions.strokeWidth : undefined,
          fontWeight: textOptions.fontWeight,
        },
        rotation: textOptions.rotation,
        margin: { x: 5, y: 5 }, // 작은 마진으로 설정
      });

      // 결과를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (blob: Blob | null) => {
            if (blob) resolve(blob);
            else reject(new Error('Blob 생성 실패'));
          },
          'image/png',
          0.9
        );
      });

      const url = URL.createObjectURL(blob);
      setProcessedImage({
        src: url,
        width: watermarkedCanvas.width,
        height: watermarkedCanvas.height,
        format: 'png',
      });
    } catch (err) {
      console.error('텍스트 워터마크 처리 중 오류:', err);
      setError(err instanceof Error ? err : new Error('텍스트 워터마크 처리 중 오류가 발생했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const processImageWatermark = async () => {
    if (!originalImage || !watermarkImage) return;

    setProcessing(true);
    setError(null);
    try {
      // 먼저 기본 이미지를 Canvas로 변환
      const processor = processImage(originalImage.src);
      const canvasResult = await processor.toCanvas();

      // 워터마크 이미지 로드
      const watermarkImg = new Image();
      watermarkImg.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        watermarkImg.onload = resolve;
        watermarkImg.onerror = reject;
        watermarkImg.src = watermarkImage.src;
      });

      // 이미지 워터마크 추가
      const watermarkedCanvas = SimpleWatermark.addImage(canvasResult.canvas, {
        image: watermarkImg,
        position: imageOptions.position,
        size: imageOptions.scale,
        opacity: imageOptions.opacity,
        rotation: imageOptions.rotation,
        blendMode: imageOptions.blendMode,
      });

      // 결과를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (blob: Blob | null) => {
            if (blob) resolve(blob);
            else reject(new Error('Blob 생성 실패'));
          },
          'image/png',
          0.9
        );
      });

      const url = URL.createObjectURL(blob);
      setProcessedImage({
        src: url,
        width: watermarkedCanvas.width,
        height: watermarkedCanvas.height,
        format: 'png',
      });
    } catch (err) {
      console.error('이미지 워터마크 처리 중 오류:', err);
      setError(err instanceof Error ? err : new Error('이미지 워터마크 처리 중 오류가 발생했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const generateCodeExamples = () => {
    switch (activeTab) {
      case 0: // 텍스트 워터마크
        return [
          {
            title: '텍스트 워터마크',
            code: `import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// 기본 이미지 처리
const processor = processImage(source);
const canvasResult = await processor.toCanvas();

// 텍스트 워터마크 추가
const watermarkedCanvas = SimpleWatermark.addText(canvasResult, {
  text: '${textOptions.text}',
  position: '${textOptions.position}',
  size: ${textOptions.fontSize},
  opacity: ${textOptions.opacity},
  style: {
    color: '${textOptions.color}',
    fontFamily: '${textOptions.fontFamily}',
    fontWeight: '${textOptions.fontWeight}'${
      textOptions.stroke
        ? `,
    strokeColor: '${textOptions.strokeColor}',
    strokeWidth: ${textOptions.strokeWidth}`
        : ''
    }
  },
  rotation: ${textOptions.rotation},
  margin: { x: 5, y: 5 } // 작은 마진으로 설정
});

// Blob으로 변환
const blob = await new Promise(resolve => {
  watermarkedCanvas.toBlob(resolve, 'image/png', 0.9);
});`,
            language: 'typescript',
          },
        ];

      case 1: // 이미지 워터마크
        return [
          {
            title: '이미지 워터마크',
            code: `import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// 기본 이미지 처리
const processor = processImage(source);
const canvasResult = await processor.toCanvas();

// 워터마크 이미지 로드
const watermarkImg = new Image();
watermarkImg.src = watermarkImageSrc;
await new Promise(resolve => watermarkImg.onload = resolve);

// 이미지 워터마크 추가
const watermarkedCanvas = SimpleWatermark.addImage(canvasResult, {
  image: watermarkImg,
  position: '${imageOptions.position}',
  size: ${imageOptions.scale},
  opacity: ${imageOptions.opacity},
  rotation: ${imageOptions.rotation},
  blendMode: '${imageOptions.blendMode}'
});

// Blob으로 변환
const blob = await new Promise(resolve => {
  watermarkedCanvas.toBlob(resolve, 'image/png', 0.9);
});`,
            language: 'typescript',
          },
        ];

      case 2: // 이미지 합성
        return [
          {
            title: '이미지 합성',
            code: `import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// 다중 워터마크 합성 예제
const processor = processImage(source);
const canvasResult = await processor.resize({ fit: 'cover', width: 800, height: 600 }).toCanvas();

// 로고 추가
const logoCanvas = SimpleWatermark.addLogo(canvasResult, logoImage, {
  position: 'top-right',
  maxSize: 0.15,
  opacity: 0.8
});

// 저작권 텍스트 추가
const finalCanvas = SimpleWatermark.addCopyright(logoCanvas, '© 2024 Company Name', {
  position: 'bottom-right',
  style: 'light'
});

// Blob으로 변환
const blob = await new Promise(resolve => {
  finalCanvas.toBlob(resolve, 'image/png', 0.9);
});`,
            language: 'typescript',
          },
        ];

      default:
        return [];
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        고급 기능
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        워터마크 추가, 이미지 합성, 다중 레이어 처리 등 고급 이미지 처리 기능을 확인해보세요.
      </Typography>

      {/* 에러 표시 */}
      {error && <ErrorDisplay error={error} onClear={() => setError(null)} />}

      {/* 처리 상태 */}
      <ProcessingStatus processing={processing} message="워터마크 처리 중..." />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 메인 이미지 업로더 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  메인 이미지
                </Typography>
                <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="advanced" />
              </CardContent>
            </Card>

            {/* 기능 선택 탭 */}
            <Card>
              <CardContent>
                <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="fullWidth" sx={{ mb: 3 }}>
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
                      onChange={(e) =>
                        setTextOptions((prev) => ({
                          ...prev,
                          text: e.target.value,
                        }))
                      }
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>위치</InputLabel>
                      <Select
                        value={textOptions.position}
                        label="위치"
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            position: e.target.value as WatermarkPosition,
                          }))
                        }
                      >
                        {positionOptions.map((option) => (
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
                        onChange={(_, value) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            fontSize: value as number,
                          }))
                        }
                        min={12}
                        max={72}
                        marks={[
                          { value: 12, label: '12px' },
                          { value: 36, label: '36px' },
                          { value: 72, label: '72px' },
                        ]}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        투명도: {Math.round(textOptions.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={textOptions.opacity}
                        onChange={(_, value) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            opacity: value as number,
                          }))
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        marks={[
                          { value: 0, label: '0%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' },
                        ]}
                      />
                    </Box>

                    <TextField
                      fullWidth
                      label="텍스트 색상"
                      type="color"
                      value={textOptions.color}
                      onChange={(e) =>
                        setTextOptions((prev) => ({
                          ...prev,
                          color: e.target.value,
                        }))
                      }
                      sx={{ mb: 2 }}
                      InputProps={{
                        inputProps: {
                          style: { height: 40 },
                        },
                      }}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={textOptions.stroke}
                          onChange={(e) =>
                            setTextOptions((prev) => ({
                              ...prev,
                              stroke: e.target.checked,
                            }))
                          }
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
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            strokeColor: e.target.value,
                          }))
                        }
                        sx={{ mb: 2 }}
                        InputProps={{
                          inputProps: {
                            style: { height: 40 },
                          },
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
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            position: e.target.value as WatermarkPosition,
                          }))
                        }
                      >
                        {positionOptions.map((option) => (
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
                        onChange={(_, value) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            scale: value as number,
                          }))
                        }
                        min={0.1}
                        max={1}
                        step={0.05}
                        marks={[
                          { value: 0.1, label: '10%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' },
                        ]}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        투명도: {Math.round(imageOptions.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={imageOptions.opacity}
                        onChange={(_, value) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            opacity: value as number,
                          }))
                        }
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
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            blendMode: e.target.value as 'normal' | 'multiply' | 'overlay' | 'soft-light',
                          }))
                        }
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

                    <Stack spacing={1} sx={{ mb: 3 }}>
                      <Chip label="✅ 텍스트 워터마크" color="success" />
                      <Chip label="✅ 이미지 워터마크" color="success" />
                      <Chip label="✅ 로고 워터마크" color="success" />
                      <Chip label="✅ 저작권 워터마크" color="success" />
                      <Chip label="✅ 다중 워터마크 합성" color="success" />
                      <Chip label="🚧 그리드 레이아웃" variant="outlined" />
                      <Chip label="🚧 콜라주 생성" variant="outlined" />
                      <Chip label="🚧 마스킹" variant="outlined" />
                    </Stack>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      위의 텍스트 및 이미지 탭에서 워터마크 합성 기능을 체험해보세요. 여러 워터마크를 차례로 적용하여
                      복합적인 합성 효과를 만들 수 있습니다.
                    </Alert>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Before/After 뷰어 */}
            <BeforeAfterView before={originalImage} after={processedImage} />

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
                      bgcolor: 'grey.50',
                    }}
                  >
                    <img
                      src={watermarkImage.src}
                      alt="워터마크"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            {originalImage && <CodeSnippet title="현재 설정의 코드 예제" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
