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
} from '@mui/material';
import { useState, useCallback } from 'react';
import { processImage } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { CodeSnippet } from '../common/CodeSnippet';
import { Download, CompareArrows } from '@mui/icons-material';

interface ProcessResult {
  originalUrl: string;
  processedUrl: string;
  processingTime: number;
  fileSize: number;
  dimensions: { width: number; height: number };
  fit: string;
  actualDimensions?: { width: number; height: number };
}

interface ComparisonState {
  pngResults: Record<string, ProcessResult | null>;
  svgResults: Record<string, ProcessResult | null>;
  processingProgress: number;
  isProcessing: boolean;
}

export function FitModeComparisonDemo() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [targetSize, setTargetSize] = useState({ width: 300, height: 200 });
  const [comparisonState, setComparisonState] = useState<ComparisonState>({
    pngResults: {},
    svgResults: {},
    processingProgress: 0,
    isProcessing: false
  });
  const [error, setError] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpeg'>('png');

  const fitModes = [
    { key: 'cover', name: 'Cover', color: '#f44336', description: '이미지가 영역을 가득 채움 (잘림 가능)' },
    { key: 'contain', name: 'Contain', color: '#2196f3', description: '이미지 전체가 영역에 맞춤 (여백 가능)' },
    { key: 'fill', name: 'Fill', color: '#ff9800', description: '비율 무시하고 영역에 맞춤' },
    { key: 'maxFit', name: 'MaxFit', color: '#4caf50', description: '축소만, 확대 안함' },
    { key: 'minFit', name: 'MinFit', color: '#9c27b0', description: '확대만, 축소 안함' }
  ];

  // 타겟 크기 변경 핸들러
  const handleTargetSizeChange = useCallback((dimension: 'width' | 'height', value: number) => {
    setTargetSize(prev => ({ ...prev, [dimension]: value }));
  }, []);

  // 이미지 선택 핸들러
  const handleImageSelect = useCallback(async (source: File | string) => {
    setError('');
    setSelectedImage(source instanceof File ? source : null);
    setComparisonState({
      pngResults: {},
      svgResults: {},
      processingProgress: 0,
      isProcessing: false
    });
  }, []);

  // PNG/JPG vs SVG 비교 처리
  const handleCompareProcessing = useCallback(async () => {
    if (!selectedImage) return;

    setComparisonState(prev => ({ ...prev, isProcessing: true, processingProgress: 0 }));
    setError('');

    try {
      console.log('🔄 PNG/JPG vs SVG 비교 처리 시작');

      // 원본 이미지를 SVG로 변환 (비교를 위해)
      let svgSource: string;

      // SVG 파일인 경우 그대로 사용
      if (selectedImage.type === 'image/svg+xml' || selectedImage.name?.endsWith('.svg')) {
        svgSource = await selectedImage.text();
      } else {
        // PNG/JPG 이미지를 SVG로 변환 (임베드)
        const imageDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(selectedImage);
        });

        svgSource = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
          <image href="${imageDataUrl}" width="400" height="300" preserveAspectRatio="xMidYMid meet"/>
        </svg>`;
      }

      const totalSteps = fitModes.length * 2; // PNG + SVG 처리
      let currentStep = 0;

      const pngResults: Record<string, ProcessResult> = {};
      const svgResults: Record<string, ProcessResult> = {};

      // 각 fit 모드별로 PNG와 SVG 처리
      for (const mode of fitModes) {
        console.log(`🔄 ${mode.name} 모드 처리 중...`);

        // PNG/JPG 원본 처리
        try {
          const startTime = Date.now();
          const processed = await processImage(selectedImage)
            .resize({ fit: mode.key as any, width: targetSize.width, height: targetSize.height })
            .toBlob({ format: selectedFormat, quality: 0.9 });

          pngResults[mode.key] = {
            originalUrl: URL.createObjectURL(selectedImage),
            processedUrl: URL.createObjectURL(processed.blob),
            processingTime: Date.now() - startTime,
            fileSize: processed.blob.size,
            dimensions: targetSize,
            fit: mode.key,
            actualDimensions: { width: processed.width, height: processed.height }
          };

          currentStep++;
          setComparisonState(prev => ({
            ...prev,
            processingProgress: (currentStep / totalSteps) * 100,
            pngResults: { ...prev.pngResults, [mode.key]: pngResults[mode.key] }
          }));
        } catch (err) {
          console.error(`PNG 처리 오류 (${mode.name}):`, err);
        }

        // SVG 처리
        try {
          const startTime = Date.now();
          const processed = await processImage(svgSource)
            .resize({ fit: mode.key as any, width: targetSize.width, height: targetSize.height })
            .toBlob({ format: selectedFormat, quality: 0.9 });

          svgResults[mode.key] = {
            originalUrl: `data:image/svg+xml;base64,${btoa(svgSource)}`,
            processedUrl: URL.createObjectURL(processed.blob),
            processingTime: Date.now() - startTime,
            fileSize: processed.blob.size,
            dimensions: targetSize,
            fit: mode.key,
            actualDimensions: { width: processed.width, height: processed.height }
          };

          currentStep++;
          setComparisonState(prev => ({
            ...prev,
            processingProgress: (currentStep / totalSteps) * 100,
            svgResults: { ...prev.svgResults, [mode.key]: svgResults[mode.key] }
          }));
        } catch (err) {
          console.error(`SVG 처리 오류 (${mode.name}):`, err);
        }
      }

      console.log('✅ PNG/JPG vs SVG 비교 처리 완료');

    } catch (err) {
      setError('이미지 처리 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : err));
    } finally {
      setComparisonState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [selectedImage, targetSize, selectedFormat]);

  // 결과 다운로드
  const handleDownload = useCallback((fitMode: string, type: 'png' | 'svg') => {
    const results = type === 'png' ? comparisonState.pngResults : comparisonState.svgResults;
    const result = results[fitMode];
    if (!result) return;

    const link = document.createElement('a');
    link.href = result.processedUrl;
    link.download = `${type}-${fitMode}-${targetSize.width}x${targetSize.height}.${selectedFormat}`;
    link.click();
  }, [comparisonState, targetSize, selectedFormat]);

  // 코드 예제 생성
  const generateCodeExamples = useCallback(() => {
    const basicCode = `import { processImage } from '@cp949/web-image-util';

// PNG/JPG 이미지 처리
const pngResult = await processImage(pngFile)
  .resize({ fit: 'contain', width: ${targetSize.width}, height: ${targetSize.height} })
  .toBlob('${selectedFormat}');

// SVG 이미지 처리 (동일한 API, 자동 고품질 처리)
const svgResult = await processImage(svgFile)
  .resize({ fit: 'contain', width: ${targetSize.width}, height: ${targetSize.height} })
  .toBlob('${selectedFormat}');

// 결과는 동일한 구조
console.log('PNG 크기:', pngResult.blob.size);
console.log('SVG 크기:', svgResult.blob.size);`;

    const comparisonCode = `// 모든 fit 모드 비교
const fitModes = ['cover', 'contain', 'fill', 'maxFit', 'minFit'];
const results = {};

for (const fit of fitModes) {
  // PNG와 SVG 동시 처리
  const [pngResult, svgResult] = await Promise.all([
    processImage(pngSource).resize({ fit, width: ${targetSize.width}, height: ${targetSize.height} }).toBlob(),
    processImage(svgSource).resize({ fit, width: ${targetSize.width}, height: ${targetSize.height} }).toBlob()
  ]);

  results[fit] = { png: pngResult, svg: svgResult };
}`;

    return [
      {
        title: '기본 PNG vs SVG 처리',
        code: basicCode,
        language: 'typescript'
      },
      {
        title: '고급 - 모든 모드 비교',
        code: comparisonCode,
        language: 'typescript'
      }
    ];
  }, [targetSize, selectedFormat]);

  return (
    <Container maxWidth="xl">
      <Typography variant="h3" component="h1" gutterBottom>
        Fit Mode 비교: PNG/JPG vs SVG
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        동일한 이미지를 PNG/JPG와 SVG로 처리하여 각 fit 모드의 동작을 비교합니다.
        SVG는 자동으로 고품질 렌더링이 적용됩니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 설정 */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  이미지 선택
                </Typography>
                <ImageUploader
                  onImageSelect={handleImageSelect}
                  supportedFormats={['png', 'jpg', 'jpeg', 'svg']}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  타겟 크기 설정
                </Typography>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      너비: {targetSize.width}px
                    </Typography>
                    <Slider
                      value={targetSize.width}
                      onChange={(_, value) => handleTargetSizeChange('width', value as number)}
                      min={100}
                      max={800}
                      step={50}
                      marks={[
                        { value: 100, label: '100px' },
                        { value: 400, label: '400px' },
                        { value: 800, label: '800px' }
                      ]}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      높이: {targetSize.height}px
                    </Typography>
                    <Slider
                      value={targetSize.height}
                      onChange={(_, value) => handleTargetSizeChange('height', value as number)}
                      min={100}
                      max={600}
                      step={50}
                      marks={[
                        { value: 100, label: '100px' },
                        { value: 300, label: '300px' },
                        { value: 600, label: '600px' }
                      ]}
                    />
                  </Box>
                  <FormControl fullWidth>
                    <InputLabel>출력 포맷</InputLabel>
                    <Select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value as 'png' | 'jpeg')}
                    >
                      <MenuItem value="png">PNG (무손실)</MenuItem>
                      <MenuItem value="jpeg">JPEG (손실)</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>

            {selectedImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    선택된 이미지
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      파일명: {selectedImage.name}
                    </Typography>
                    <Typography variant="body2">
                      타입: {selectedImage.type}
                    </Typography>
                    <Typography variant="body2">
                      크기: {(selectedImage.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleCompareProcessing}
                    disabled={comparisonState.isProcessing}
                    startIcon={<CompareArrows />}
                    sx={{ mt: 2 }}
                  >
                    {comparisonState.isProcessing ? '비교 처리 중...' : 'PNG vs SVG 비교 시작'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* 우측: 결과 */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Stack spacing={3}>
            {/* 진행률 */}
            {comparisonState.isProcessing && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    PNG vs SVG 비교 처리 중... ({comparisonState.processingProgress.toFixed(0)}%)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={comparisonState.processingProgress}
                  />
                </CardContent>
              </Card>
            )}

            {/* 에러 표시 */}
            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {/* Fit 모드별 비교 결과 */}
            {Object.keys(comparisonState.pngResults).length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Fit 모드별 비교 결과 ({targetSize.width}×{targetSize.height})
                  </Typography>

                  <Stack spacing={4}>
                    {fitModes.map((mode) => {
                      const pngResult = comparisonState.pngResults[mode.key];
                      const svgResult = comparisonState.svgResults[mode.key];

                      if (!pngResult && !svgResult) return null;

                      return (
                        <Box key={mode.key}>
                          <Typography variant="h6" sx={{ mb: 2, color: mode.color }}>
                            {mode.name} 모드
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {mode.description}
                          </Typography>

                          <Grid container spacing={2}>
                            {/* PNG 결과 */}
                            {pngResult && (
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Card variant="outlined" sx={{ border: 2, borderColor: 'primary.main' }}>
                                  <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                      <Typography variant="subtitle1" fontWeight="bold">
                                        PNG/JPG 원본 처리
                                      </Typography>
                                      <Chip label="기존 방식" size="small" />
                                    </Stack>

                                    <Box sx={{
                                      border: 1,
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      p: 2,
                                      textAlign: 'center',
                                      bgcolor: 'grey.50',
                                      mb: 2,
                                      height: 150,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <img
                                        src={pngResult.processedUrl}
                                        alt={`PNG ${mode.name} 결과`}
                                        style={{
                                          maxWidth: '100%',
                                          maxHeight: '100%',
                                          objectFit: 'contain'
                                        }}
                                      />
                                    </Box>

                                    <Stack spacing={1}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="caption">처리 시간:</Typography>
                                        <Typography variant="caption">{pngResult.processingTime}ms</Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="caption">파일 크기:</Typography>
                                        <Typography variant="caption">{(pngResult.fileSize / 1024).toFixed(1)} KB</Typography>
                                      </Box>
                                    </Stack>

                                    <Button
                                      fullWidth
                                      variant="outlined"
                                      size="small"
                                      startIcon={<Download />}
                                      onClick={() => handleDownload(mode.key, 'png')}
                                      sx={{ mt: 2 }}
                                    >
                                      PNG 다운로드
                                    </Button>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}

                            {/* SVG 결과 */}
                            {svgResult && (
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Card variant="outlined" sx={{ border: 2, borderColor: 'success.main' }}>
                                  <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                      <Typography variant="subtitle1" fontWeight="bold">
                                        SVG 고품질 처리
                                      </Typography>
                                      <Chip label="고품질 렌더링" size="small" color="success" />
                                    </Stack>

                                    <Box sx={{
                                      border: 1,
                                      borderColor: 'success.main',
                                      borderRadius: 1,
                                      p: 2,
                                      textAlign: 'center',
                                      bgcolor: 'success.50',
                                      mb: 2,
                                      height: 150,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <img
                                        src={svgResult.processedUrl}
                                        alt={`SVG ${mode.name} 결과`}
                                        style={{
                                          maxWidth: '100%',
                                          maxHeight: '100%',
                                          objectFit: 'contain'
                                        }}
                                      />
                                    </Box>

                                    <Stack spacing={1}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="caption">처리 시간:</Typography>
                                        <Typography variant="caption">{svgResult.processingTime}ms</Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="caption">파일 크기:</Typography>
                                        <Typography variant="caption">{(svgResult.fileSize / 1024).toFixed(1)} KB</Typography>
                                      </Box>
                                    </Stack>

                                    <Button
                                      fullWidth
                                      variant="outlined"
                                      size="small"
                                      startIcon={<Download />}
                                      onClick={() => handleDownload(mode.key, 'svg')}
                                      sx={{ mt: 2 }}
                                    >
                                      SVG 다운로드
                                    </Button>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            {selectedImage && (
              <CodeSnippet
                title="PNG vs SVG 비교 처리 코드"
                examples={generateCodeExamples()}
              />
            )}

            {/* Fit 모드 설명 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Fit 모드 완벽 가이드
                </Typography>
                <Grid container spacing={2}>
                  {fitModes.map((mode) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mode.key}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold" sx={{ color: mode.color }}>
                            {mode.name} 모드
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {mode.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;