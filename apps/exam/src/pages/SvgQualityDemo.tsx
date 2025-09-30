'use client'

import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
  Alert,
  LinearProgress,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  TextField,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { useState, useCallback, useRef } from 'react';
import { processImage } from '../../../../sub/web-image-util/dist';
import { ImageUploader } from '../components/common/ImageUploader';
import { CodeSnippet } from '../components/common/CodeSnippet';
import {
  Download,
  ZoomIn,
  HighQuality,
  Compare,
  ExpandMore,
  Memory,
  Speed,
} from '@mui/icons-material';

interface QualityResult {
  originalUrl: string;
  processedUrl: string;
  processingTime: number;
  fileSize: number;
  scaleFactor: number;
  pixelRatio: number;
  targetDimensions: { width: number; height: number };
  actualDimensions?: { width: number; height: number };
  memoryEstimate: number;
}

interface QualityComparison {
  standardResult: QualityResult | null;
  highQualityResult: QualityResult | null;
  processingProgress: number;
  isProcessing: boolean;
}

export function SvgQualityDemo() {
  const [svgSource, setSvgSource] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scalingFactor, setScalingFactor] = useState(2);
  const [pixelRatio, setPixelRatio] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const [comparison, setComparison] = useState<QualityComparison>({
    standardResult: null,
    highQualityResult: null,
    processingProgress: 0,
    isProcessing: false
  });
  const [error, setError] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg'>('png');
  const [showPixelationGrid, setShowPixelationGrid] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 미리 정의된 SVG 샘플들
  const sampleSvgs = [
    {
      name: 'Simple Icon',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#4285f4" stroke="#1a73e8" stroke-width="2"/>
        <path d="M8 12l2 2 4-4" stroke="white" stroke-width="2" fill="none"/>
      </svg>`
    },
    {
      name: 'Complex Logo',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#4ecdc4;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="200" height="100" fill="url(#grad1)" rx="10"/>
        <text x="100" y="55" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">LOGO</text>
        <circle cx="30" cy="30" r="15" fill="rgba(255,255,255,0.3)"/>
        <circle cx="170" cy="70" r="15" fill="rgba(255,255,255,0.3)"/>
      </svg>`
    },
    {
      name: 'Detailed Graphics',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
        <pattern id="stripes" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="2" height="4" fill="#333"/>
        </pattern>
        <circle cx="75" cy="75" r="60" fill="url(#stripes)"/>
        <circle cx="75" cy="75" r="40" fill="none" stroke="#e74c3c" stroke-width="3"/>
        <polygon points="75,35 85,55 105,55 90,70 95,90 75,80 55,90 60,70 45,55 65,55" fill="#f39c12"/>
        <text x="75" y="120" text-anchor="middle" font-family="Arial" font-size="12" fill="#2c3e50">Quality Test</text>
      </svg>`
    }
  ];

  // SVG 소스 설정
  const handleSvgSourceChange = useCallback((source: string) => {
    setSvgSource(source);
    setSelectedFile(null);
    setComparison({
      standardResult: null,
      highQualityResult: null,
      processingProgress: 0,
      isProcessing: false
    });

    // SVG 원본 크기 추정
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(source, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');
      if (svgElement) {
        const width = parseFloat(svgElement.getAttribute('width') || '100');
        const height = parseFloat(svgElement.getAttribute('height') || '100');
        setOriginalDimensions({ width, height });
      }
    } catch (err) {
      console.warn('SVG 파싱 오류:', err);
    }
  }, []);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (source: File | string) => {
    setError('');

    if (source instanceof File) {
      setSelectedFile(source);
      const svgText = await source.text();
      handleSvgSourceChange(svgText);
    } else {
      handleSvgSourceChange(source);
    }
  }, [handleSvgSourceChange]);

  // 품질 비교 처리
  const handleQualityComparison = useCallback(async () => {
    if (!svgSource) return;

    setComparison(prev => ({ ...prev, isProcessing: true, processingProgress: 0 }));
    setError('');

    try {
      console.log('🎨 SVG 품질 비교 처리 시작');

      const targetDimensions = {
        width: Math.round(originalDimensions.width * scalingFactor),
        height: Math.round(originalDimensions.height * scalingFactor)
      };

      // 메모리 사용량 추정
      const memoryEstimate = (targetDimensions.width * targetDimensions.height * 4) / (1024 * 1024); // MB

      // 1. 표준 품질 처리 (1x pixelRatio)
      setComparison(prev => ({ ...prev, processingProgress: 25 }));
      console.log('📐 표준 품질 처리 시작...');

      const standardStartTime = Date.now();
      const standardProcessed = await processImage(svgSource)
        .resize(targetDimensions.width, targetDimensions.height, { fit: 'contain' })
        .toBlob({ format: outputFormat, quality: 0.9 });

      const standardResult: QualityResult = {
        originalUrl: `data:image/svg+xml;base64,${btoa(svgSource)}`,
        processedUrl: URL.createObjectURL(standardProcessed.blob),
        processingTime: Date.now() - standardStartTime,
        fileSize: standardProcessed.blob.size,
        scaleFactor: scalingFactor,
        pixelRatio: 1,
        targetDimensions,
        actualDimensions: targetDimensions,
        memoryEstimate
      };

      setComparison(prev => ({
        ...prev,
        processingProgress: 50,
        standardResult
      }));

      // 2. 고품질 처리 (높은 pixelRatio)
      console.log('✨ 고품질 처리 시작...');
      setComparison(prev => ({ ...prev, processingProgress: 75 }));

      const highQualityStartTime = Date.now();

      // SVG를 고해상도로 렌더링하기 위해 더 큰 크기로 처리 후 축소
      const highResDimensions = {
        width: Math.round(targetDimensions.width * pixelRatio),
        height: Math.round(targetDimensions.height * pixelRatio)
      };

      const highQualityProcessed = await processImage(svgSource)
        .resize(highResDimensions.width, highResDimensions.height, { fit: 'contain' })
        .toBlob({ format: outputFormat, quality: 0.95 });

      // 고해상도 이미지를 원하는 크기로 다시 리사이즈
      const finalProcessed = await processImage(highQualityProcessed.blob)
        .resize(targetDimensions.width, targetDimensions.height, { fit: 'contain' })
        .toBlob({ format: outputFormat, quality: 0.95 });

      const highQualityResult: QualityResult = {
        originalUrl: `data:image/svg+xml;base64,${btoa(svgSource)}`,
        processedUrl: URL.createObjectURL(finalProcessed.blob),
        processingTime: Date.now() - highQualityStartTime,
        fileSize: finalProcessed.blob.size,
        scaleFactor: scalingFactor,
        pixelRatio: pixelRatio,
        targetDimensions,
        actualDimensions: targetDimensions,
        memoryEstimate: memoryEstimate * pixelRatio * pixelRatio
      };

      setComparison(prev => ({
        ...prev,
        processingProgress: 100,
        highQualityResult
      }));

      console.log('🎉 SVG 품질 비교 처리 완료!');

    } catch (err) {
      setError('SVG 품질 처리 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : err));
    } finally {
      setComparison(prev => ({ ...prev, isProcessing: false }));
    }
  }, [svgSource, originalDimensions, scalingFactor, pixelRatio, outputFormat]);

  // 결과 다운로드
  const handleDownload = useCallback((type: 'standard' | 'highQuality') => {
    const result = type === 'standard' ? comparison.standardResult : comparison.highQualityResult;
    if (!result) return;

    const link = document.createElement('a');
    link.href = result.processedUrl;
    link.download = `svg-${type}-${result.scaleFactor}x-${result.pixelRatio}pr.${outputFormat}`;
    link.click();
  }, [comparison, outputFormat]);

  // 코드 예제 생성
  const generateCodeExamples = useCallback(() => {
    const basicCode = `import { processImage } from '@cp949/web-image-util';

// 기본 SVG 고품질 처리
const result = await processImage(svgSource)
  .resize(${Math.round(originalDimensions.width * scalingFactor)}, ${Math.round(originalDimensions.height * scalingFactor)}, { fit: 'contain' })
  .toBlob({ format: '${outputFormat}', quality: 0.9 });

// SVG는 자동으로 ${scalingFactor}x 스케일링이 적용됩니다`;

    const advancedCode = `// 고급 - 최대 품질 처리 (${pixelRatio}x pixelRatio)
const highResDimensions = {
  width: ${Math.round(originalDimensions.width * scalingFactor)} * ${pixelRatio},
  height: ${Math.round(originalDimensions.height * scalingFactor)} * ${pixelRatio}
};

// 1단계: 고해상도로 렌더링
const highResResult = await processImage(svgSource)
  .resize(highResDimensions.width, highResDimensions.height)
  .toBlob({ format: '${outputFormat}', quality: 0.95 });

// 2단계: 원하는 크기로 다운샘플링 (안티앨리어싱 효과)
const finalResult = await processImage(highResResult.blob)
  .resize(${Math.round(originalDimensions.width * scalingFactor)}, ${Math.round(originalDimensions.height * scalingFactor)})
  .toBlob({ format: '${outputFormat}', quality: 0.95 });`;

    return [
      {
        title: '기본 SVG 고품질 처리',
        code: basicCode,
        language: 'typescript'
      },
      {
        title: '고급 - 최대 품질 처리',
        code: advancedCode,
        language: 'typescript'
      }
    ];
  }, [originalDimensions, scalingFactor, pixelRatio, outputFormat]);

  return (
    <Container maxWidth="xl">
      <Typography variant="h3" component="h1" gutterBottom>
        SVG 고품질 렌더링 데모
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        SVG 확대 시 벡터 품질을 유지하는 고품질 렌더링 기술을 시연합니다.
        다양한 스케일링 팩터와 pixelRatio를 적용하여 품질 차이를 비교해보세요.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 설정 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* SVG 입력 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  SVG 소스 입력
                </Typography>

                {/* 파일 업로드 */}
                <Box sx={{ mb: 2 }}>
                  <ImageUploader
                    onImageSelect={handleFileSelect}
                    supportedFormats={['svg']}
                  />
                </Box>

                {/* 샘플 SVG 버튼들 */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    또는 샘플 SVG 선택:
                  </Typography>
                  <Stack direction="column" spacing={1}>
                    {sampleSvgs.map((sample, index) => (
                      <Button
                        key={index}
                        variant="outlined"
                        size="small"
                        onClick={() => handleSvgSourceChange(sample.svg)}
                        fullWidth
                      >
                        {sample.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>

                {/* SVG 직접 입력 */}
                <TextField
                  label="SVG XML 직접 입력"
                  multiline
                  rows={4}
                  value={svgSource}
                  onChange={(e) => handleSvgSourceChange(e.target.value)}
                  fullWidth
                  placeholder="<svg>...</svg>"
                  variant="outlined"
                />
              </CardContent>
            </Card>

            {/* 품질 설정 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  품질 설정
                </Typography>

                <Stack spacing={3}>
                  {/* 스케일링 팩터 */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      스케일링 팩터: {scalingFactor}x
                    </Typography>
                    <Slider
                      value={scalingFactor}
                      onChange={(_, value) => setScalingFactor(value as number)}
                      min={0.5}
                      max={8}
                      step={0.5}
                      marks={[
                        { value: 1, label: '1x' },
                        { value: 2, label: '2x' },
                        { value: 4, label: '4x' },
                        { value: 8, label: '8x' }
                      ]}
                    />
                    <Typography variant="caption" color="text.secondary">
                      원본 크기 대비 확대/축소 비율
                    </Typography>
                  </Box>

                  {/* Pixel Ratio */}
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Pixel Ratio: {pixelRatio}x
                    </Typography>
                    <Slider
                      value={pixelRatio}
                      onChange={(_, value) => setPixelRatio(value as number)}
                      min={1}
                      max={4}
                      step={0.5}
                      marks={[
                        { value: 1, label: '1x' },
                        { value: 2, label: '2x' },
                        { value: 3, label: '3x' },
                        { value: 4, label: '4x' }
                      ]}
                    />
                    <Typography variant="caption" color="text.secondary">
                      고품질 렌더링을 위한 내부 해상도 배율
                    </Typography>
                  </Box>

                  {/* 출력 포맷 */}
                  <FormControl fullWidth>
                    <InputLabel>출력 포맷</InputLabel>
                    <Select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value as 'png' | 'jpeg')}
                    >
                      <MenuItem value="png">PNG (무손실, 투명도 지원)</MenuItem>
                      <MenuItem value="jpeg">JPEG (손실, 작은 파일 크기)</MenuItem>
                    </Select>
                  </FormControl>

                  {/* 픽셀화 그리드 표시 */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showPixelationGrid}
                        onChange={(e) => setShowPixelationGrid(e.target.checked)}
                      />
                    }
                    label="픽셀화 확인 그리드 표시"
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* 원본 정보 */}
            {originalDimensions.width > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    원본 SVG 정보
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">원본 크기:</Typography>
                      <Typography variant="body2">
                        {originalDimensions.width} × {originalDimensions.height}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">타겟 크기:</Typography>
                      <Typography variant="body2">
                        {Math.round(originalDimensions.width * scalingFactor)} × {Math.round(originalDimensions.height * scalingFactor)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">확대 비율:</Typography>
                      <Typography variant="body2" color={scalingFactor > 1 ? 'success.main' : 'text.primary'}>
                        {scalingFactor > 1 ? `${((scalingFactor - 1) * 100).toFixed(0)}% 확대` :
                         scalingFactor < 1 ? `${((1 - scalingFactor) * 100).toFixed(0)}% 축소` : '원본 크기'}
                      </Typography>
                    </Box>
                    {selectedFile && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">파일 크기:</Typography>
                        <Typography variant="body2">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleQualityComparison}
                    disabled={comparison.isProcessing || !svgSource}
                    startIcon={<HighQuality />}
                    sx={{ mt: 2 }}
                  >
                    {comparison.isProcessing ? '품질 비교 처리 중...' : '품질 비교 시작'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* 우측: 결과 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 진행률 */}
            {comparison.isProcessing && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SVG 고품질 처리 중... ({comparison.processingProgress.toFixed(0)}%)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={comparison.processingProgress}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    벡터 품질을 유지하며 {scalingFactor}x 스케일링을 적용하고 있습니다.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* 에러 표시 */}
            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {/* 원본 SVG 미리보기 */}
            {svgSource && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    원본 SVG 미리보기
                  </Typography>
                  <Box sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'grey.50',
                    maxHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div
                      dangerouslySetInnerHTML={{ __html: svgSource }}
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* 품질 비교 결과 */}
            {(comparison.standardResult || comparison.highQualityResult) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    품질 비교 결과
                  </Typography>

                  <Grid container spacing={3}>
                    {/* 표준 품질 */}
                    {comparison.standardResult && (
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined" sx={{ border: 2, borderColor: 'warning.main' }}>
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                표준 품질 (1x PR)
                              </Typography>
                              <Chip
                                label="기본 처리"
                                size="small"
                                color="warning"
                                icon={<Speed />}
                              />
                            </Stack>

                            <Box sx={{
                              border: 1,
                              borderColor: 'warning.main',
                              borderRadius: 1,
                              p: 2,
                              textAlign: 'center',
                              bgcolor: 'warning.50',
                              mb: 2,
                              height: 200,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              backgroundImage: showPixelationGrid ?
                                'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)' :
                                'none',
                              backgroundSize: showPixelationGrid ? '10px 10px' : 'auto'
                            }}>
                              <img
                                src={comparison.standardResult.processedUrl}
                                alt="표준 품질 결과"
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                  imageRendering: showPixelationGrid ? 'pixelated' : 'auto'
                                }}
                              />
                            </Box>

                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">처리 시간:</Typography>
                                <Typography variant="caption">{comparison.standardResult.processingTime}ms</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">파일 크기:</Typography>
                                <Typography variant="caption">{(comparison.standardResult.fileSize / 1024).toFixed(1)} KB</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">메모리 사용:</Typography>
                                <Typography variant="caption">{comparison.standardResult.memoryEstimate.toFixed(1)} MB</Typography>
                              </Box>
                            </Stack>

                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              startIcon={<Download />}
                              onClick={() => handleDownload('standard')}
                              sx={{ mt: 2 }}
                            >
                              표준 품질 다운로드
                            </Button>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}

                    {/* 고품질 */}
                    {comparison.highQualityResult && (
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined" sx={{ border: 2, borderColor: 'success.main' }}>
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                고품질 ({pixelRatio}x PR)
                              </Typography>
                              <Chip
                                label="최대 품질"
                                size="small"
                                color="success"
                                icon={<HighQuality />}
                              />
                            </Stack>

                            <Box sx={{
                              border: 1,
                              borderColor: 'success.main',
                              borderRadius: 1,
                              p: 2,
                              textAlign: 'center',
                              bgcolor: 'success.50',
                              mb: 2,
                              height: 200,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              backgroundImage: showPixelationGrid ?
                                'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)' :
                                'none',
                              backgroundSize: showPixelationGrid ? '10px 10px' : 'auto'
                            }}>
                              <img
                                src={comparison.highQualityResult.processedUrl}
                                alt="고품질 결과"
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                  imageRendering: showPixelationGrid ? 'pixelated' : 'auto'
                                }}
                              />
                            </Box>

                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">처리 시간:</Typography>
                                <Typography variant="caption">{comparison.highQualityResult.processingTime}ms</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">파일 크기:</Typography>
                                <Typography variant="caption">{(comparison.highQualityResult.fileSize / 1024).toFixed(1)} KB</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption">메모리 사용:</Typography>
                                <Typography variant="caption">{comparison.highQualityResult.memoryEstimate.toFixed(1)} MB</Typography>
                              </Box>
                            </Stack>

                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              startIcon={<Download />}
                              onClick={() => handleDownload('highQuality')}
                              sx={{ mt: 2 }}
                            >
                              고품질 다운로드
                            </Button>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                  </Grid>

                  {/* 성능 비교 */}
                  {comparison.standardResult && comparison.highQualityResult && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        성능 비교 분석
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" display="block">
                              처리 시간 차이
                            </Typography>
                            <Typography variant="h6" color="primary">
                              +{((comparison.highQualityResult.processingTime / comparison.standardResult.processingTime - 1) * 100).toFixed(0)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" display="block">
                              파일 크기 차이
                            </Typography>
                            <Typography variant="h6" color="primary">
                              +{((comparison.highQualityResult.fileSize / comparison.standardResult.fileSize - 1) * 100).toFixed(0)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" display="block">
                              메모리 사용 차이
                            </Typography>
                            <Typography variant="h6" color="primary">
                              +{((comparison.highQualityResult.memoryEstimate / comparison.standardResult.memoryEstimate - 1) * 100).toFixed(0)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" display="block">
                              품질 향상도
                            </Typography>
                            <Typography variant="h6" color="success.main">
                              {pixelRatio}x 해상도
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            {svgSource && (
              <CodeSnippet
                title="SVG 고품질 렌더링 코드"
                examples={generateCodeExamples()}
              />
            )}

            {/* 고품질 렌더링 가이드 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  SVG 고품질 렌더링 가이드
                </Typography>

                <Stack spacing={2}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1">스케일링 팩터 선택 가이드</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        <Typography variant="body2">• <strong>1x</strong>: 원본 크기 유지, 최적 성능</Typography>
                        <Typography variant="body2">• <strong>2x</strong>: 일반적인 확대, 균형잡힌 품질/성능</Typography>
                        <Typography variant="body2">• <strong>4x</strong>: 고품질 확대, 세밀한 디테일 보존</Typography>
                        <Typography variant="body2">• <strong>8x</strong>: 최대 품질, 벡터 그래픽 최적화</Typography>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1">Pixel Ratio 최적화</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        <Typography variant="body2">• <strong>1x</strong>: 기본 화면, 빠른 처리</Typography>
                        <Typography variant="body2">• <strong>2x</strong>: 레티나 디스플레이 대응</Typography>
                        <Typography variant="body2">• <strong>3x</strong>: 고해상도 모바일 대응</Typography>
                        <Typography variant="body2">• <strong>4x</strong>: 프로페셔널 인쇄용</Typography>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1">포맷 선택 가이드</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        <Typography variant="body2">• <strong>PNG</strong>: 무손실 압축, 투명도 지원, 아이콘/로고 권장</Typography>
                        <Typography variant="body2">• <strong>JPEG</strong>: 손실 압축, 작은 파일 크기, 사진 이미지 권장</Typography>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

export default SvgQualityDemo;