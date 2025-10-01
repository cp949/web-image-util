'use client';

import { processImage, type ResizeFit } from '@cp949/web-image-util';
import { Download, ZoomIn } from '@mui/icons-material';
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
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';
import { ImageUploader } from '../common/ImageUploader';

interface ProcessResult {
  originalUrl: string;
  processedUrl: string;
  processingTime: number;
  fileSize: number;
  dimensions: { width: number; height: number };
  fit: string;
  actualDimensions?: { width: number; height: number };
  scaleFactor: number; // 원본 대비 확대/축소 비율
  originalDimensions?: { width: number; height: number }; // SVG 원본 크기
}

interface ComparisonState {
  results: Record<string, ProcessResult | null>;
  processingProgress: number;
  isProcessing: boolean;
}

export function FitModeComparisonDemo() {
  const [selectedImage, setSelectedImage] = useState<File | string | null>(null);
  const [targetSize, setTargetSize] = useState({ width: 400, height: 300 });
  const [comparisonState, setComparisonState] = useState<ComparisonState>({
    results: {},
    processingProgress: 0,
    isProcessing: false,
  });
  const [error, setError] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpeg'>('png');
  const [showQualityComparison, setShowQualityComparison] = useState(false);

  const fitModes = [
    { key: 'cover', name: 'Cover', color: '#f44336', description: '이미지가 영역을 가득 채움 (잘림 가능)' },
    { key: 'contain', name: 'Contain', color: '#2196f3', description: '이미지 전체가 영역에 맞춤 (여백 가능)' },
    { key: 'fill', name: 'Fill', color: '#ff9800', description: '비율 무시하고 영역에 맞춤' },
    { key: 'maxFit', name: 'MaxFit', color: '#4caf50', description: '축소만, 확대 안함' },
    { key: 'minFit', name: 'MinFit', color: '#9c27b0', description: '확대만, 축소 안함' },
  ];

  // 품질 비교용 크기들 (SVG의 해상도 독립성 시연)
  const qualityTestSizes = [
    { width: 100, height: 75, label: '소형' },
    { width: 400, height: 300, label: '중형' },
    { width: 800, height: 600, label: '대형' },
    { width: 1200, height: 900, label: '초대형' },
  ];

  // UTF-8 안전한 SVG Data URL 생성 함수
  const createSvgDataUrl = useCallback((svgString: string) => {
    // Base64 대신 직접 URL 인코딩 사용 (UTF-8 안전)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  }, []);

  // SVG 원본 크기 추출 함수
  const extractSvgDimensions = useCallback((svgString: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) return null;

      // width, height 속성에서 추출
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr && heightAttr) {
        const width = parseFloat(widthAttr.replace(/[^\d.]/g, ''));
        const height = parseFloat(heightAttr.replace(/[^\d.]/g, ''));
        if (!isNaN(width) && !isNaN(height)) {
          return { width, height };
        }
      }

      // viewBox에서 추출
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const values = viewBox.split(/\s+/).map((v) => parseFloat(v));
        if (values.length === 4 && !values.some(isNaN)) {
          return { width: values[2], height: values[3] };
        }
      }

      // 기본값 반환 (SVG 표준 기본 크기)
      return { width: 300, height: 150 };
    } catch (error) {
      return { width: 300, height: 150 };
    }
  }, []);

  // SVG fit 모드 처리
  const handleSvgProcessing = useCallback(async () => {
    if (!selectedImage || comparisonState.isProcessing) return;

    setComparisonState((prev) => ({ ...prev, isProcessing: true, processingProgress: 0 }));
    setError('');

    try {
      // SVG 소스 준비
      let svgSource: string;
      if (typeof selectedImage === 'string') {
        if (selectedImage.endsWith('.svg')) {
          const response = await fetch(selectedImage);
          svgSource = await response.text();
        } else {
          setError('SVG 파일만 지원됩니다. SVG 샘플을 선택해주세요.');
          return;
        }
      } else {
        if (selectedImage.type === 'image/svg+xml' || selectedImage.name?.endsWith('.svg')) {
          svgSource = await selectedImage.text();
        } else {
          setError('SVG 파일만 지원됩니다. SVG 파일을 업로드해주세요.');
          return;
        }
      }

      const totalSteps = showQualityComparison ? qualityTestSizes.length * fitModes.length : fitModes.length;
      let currentStep = 0;

      const results: Record<string, ProcessResult> = {};

      // SVG 원본 크기 추출
      const originalDimensions = extractSvgDimensions(svgSource) ?? undefined;

      if (showQualityComparison) {
        // 품질 비교 모드: 다양한 크기에서 동일한 SVG 처리
        for (const size of qualityTestSizes) {
          for (const mode of fitModes) {
            try {
              const startTime = Date.now();
              const processed = await processImage(svgSource)
                .resize({ fit: mode.key as ResizeFit, width: size.width, height: size.height })
                .toBlob({ format: selectedFormat, quality: 0.9 });

              const scaleFactor = Math.max(size.width / 400, size.height / 300); // 기준 크기 대비

              results[`${size.label}-${mode.key}`] = {
                originalUrl: createSvgDataUrl(svgSource),
                processedUrl: URL.createObjectURL(processed.blob),
                processingTime: Date.now() - startTime,
                fileSize: processed.blob.size,
                dimensions: { width: size.width, height: size.height },
                fit: `${size.label} ${mode.name}`,
                actualDimensions: { width: processed.width, height: processed.height },
                scaleFactor,
                originalDimensions,
              };

              currentStep++;
              setComparisonState((prev) => ({
                ...prev,
                processingProgress: (currentStep / totalSteps) * 100,
                results: { ...prev.results, [`${size.label}-${mode.key}`]: results[`${size.label}-${mode.key}`] },
              }));
            } catch (err) {
              console.error(`처리 오류 (${size.label} ${mode.name}):`, err);
            }
          }
        }
      } else {
        // 일반 모드: 단일 크기에서 fit 모드 비교
        for (const mode of fitModes) {
          try {
            const startTime = Date.now();
            const processed = await processImage(svgSource)
              .resize({ fit: mode.key as ResizeFit, width: targetSize.width, height: targetSize.height })
              .toBlob({ format: selectedFormat, quality: 0.9 });

            const scaleFactor = Math.max(targetSize.width / 400, targetSize.height / 300); // 기준 크기 대비

            results[mode.key] = {
              originalUrl: createSvgDataUrl(svgSource),
              processedUrl: URL.createObjectURL(processed.blob),
              processingTime: Date.now() - startTime,
              fileSize: processed.blob.size,
              dimensions: targetSize,
              fit: mode.key,
              actualDimensions: { width: processed.width, height: processed.height },
              scaleFactor,
              originalDimensions,
            };

            currentStep++;
            setComparisonState((prev) => ({
              ...prev,
              processingProgress: (currentStep / totalSteps) * 100,
              results: { ...prev.results, [mode.key]: results[mode.key] },
            }));
          } catch (err) {
            console.error(`처리 오류 (${mode.name}):`, err);
          }
        }
      }
    } catch (err) {
      setError('이미지 처리 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : err));
    } finally {
      setComparisonState((prev) => ({ ...prev, isProcessing: false }));
    }
  }, [
    selectedImage,
    targetSize,
    selectedFormat,
    fitModes,
    showQualityComparison,
    qualityTestSizes,
    comparisonState.isProcessing,
  ]);

  // 타겟 크기 변경 시 1초 debounce로 자동 재실행
  useDebounce(
    () => {
      if (selectedImage && !comparisonState.isProcessing && !showQualityComparison) {
        handleSvgProcessing();
      }
    },
    1000, // 1초 debounce
    [targetSize.width, targetSize.height, selectedImage]
  );

  // 타겟 크기 변경 핸들러
  const handleTargetSizeChange = useCallback((dimension: 'width' | 'height', value: number) => {
    setTargetSize((prev) => ({ ...prev, [dimension]: value }));
  }, []);

  // 이미지 선택 핸들러 - 즉시 처리 시작
  const handleImageSelect = useCallback(
    async (source: File | string) => {
      setError('');
      setSelectedImage(source);
      setComparisonState({
        results: {},
        processingProgress: 0,
        isProcessing: false,
      });

      // 이미지 선택 시 즉시 처리 시작
      setTimeout(() => {
        handleSvgProcessing();
      }, 100);
    },
    [handleSvgProcessing]
  );

  // 품질 비교 모드 토글
  const handleQualityComparisonToggle = useCallback(
    (checked: boolean) => {
      setShowQualityComparison(checked);
      setComparisonState({
        results: {},
        processingProgress: 0,
        isProcessing: false,
      });

      if (selectedImage && checked) {
        setTimeout(() => {
          handleSvgProcessing();
        }, 100);
      }
    },
    [selectedImage, handleSvgProcessing]
  );

  // 결과 다운로드
  const handleDownload = useCallback(
    (resultKey: string) => {
      const result = comparisonState.results[resultKey];
      if (!result) return;

      const link = document.createElement('a');
      link.href = result.processedUrl;
      link.download = `svg-${resultKey}-${result.dimensions.width}x${result.dimensions.height}.${selectedFormat}`;
      link.click();
    },
    [comparisonState, selectedFormat]
  );

  const displayResults = showQualityComparison
    ? qualityTestSizes.flatMap((size) =>
        fitModes.map((mode) => ({
          key: `${size.label}-${mode.key}`,
          result: comparisonState.results[`${size.label}-${mode.key}`],
          mode: { ...mode, name: `${size.label} ${mode.name}` },
        }))
      )
    : fitModes.map((mode) => ({
        key: mode.key,
        result: comparisonState.results[mode.key],
        mode,
      }));

  return (
    <Container maxWidth="xl">
      <Typography variant="h3" component="h1" gutterBottom>
        SVG Fit 모드: 화질 저하 없는 벡터 처리
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        SVG의 해상도 독립적 특성을 활용한 고품질 fit 모드 처리를 확인하세요. 어떤 크기로 처리해도 벡터 품질이
        유지됩니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 설정 */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  SVG 이미지 선택
                </Typography>
                <ImageUploader
                  onImageSelect={handleImageSelect}
                  supportedFormats={['svg']}
                  sampleSelectorType="svg"
                  recommendedSamplesFor="svg-quality"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  처리 모드
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showQualityComparison}
                      onChange={(e) => handleQualityComparisonToggle(e.target.checked)}
                    />
                  }
                  label="품질 비교 모드"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {showQualityComparison ? '다양한 크기에서 SVG 품질 비교' : 'Fit 모드별 비교 (크기 조정 가능)'}
                </Typography>
              </CardContent>
            </Card>

            {!showQualityComparison && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    타겟 크기 설정
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    슬라이더 변경 시 1초 후 자동으로 재처리됩니다
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
                        max={1000}
                        step={50}
                        marks={[
                          { value: 100, label: '100px' },
                          { value: 500, label: '500px' },
                          { value: 1000, label: '1000px' },
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
                        max={800}
                        step={50}
                        marks={[
                          { value: 100, label: '100px' },
                          { value: 400, label: '400px' },
                          { value: 800, label: '800px' },
                        ]}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  출력 설정
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>출력 포맷</InputLabel>
                  <Select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value as 'png' | 'jpeg')}>
                    <MenuItem value="png">PNG (무손실)</MenuItem>
                    <MenuItem value="jpeg">JPEG (손실)</MenuItem>
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            {selectedImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    선택된 SVG
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      파일: {typeof selectedImage === 'string' ? selectedImage.split('/').pop() : selectedImage.name}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      ✨ 벡터 이미지 (해상도 독립적)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      자동 처리됨
                    </Typography>
                  </Stack>
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
                    SVG 처리 중... ({comparisonState.processingProgress.toFixed(0)}%)
                  </Typography>
                  <LinearProgress variant="determinate" value={comparisonState.processingProgress} />
                </CardContent>
              </Card>
            )}

            {/* 에러 표시 */}
            {error && <Alert severity="error">{error}</Alert>}

            {/* SVG 품질 정보 */}
            {selectedImage && (
              <Alert severity="info" icon={<ZoomIn />}>
                <Typography variant="subtitle2" gutterBottom>
                  🎯 SVG 벡터 처리의 장점
                </Typography>
                <Typography variant="body2">
                  • 해상도 독립적: 어떤 크기든 픽셀화 없음
                  <br />
                  • 선명한 곡선: 벡터 기반 렌더링으로 매끄러운 선<br />
                  • 확대/축소 자유: 품질 저하 없이 무한 확대 가능
                  <br />• 파일 효율성: 복잡한 이미지도 작은 용량
                </Typography>
              </Alert>
            )}

            {/* Fit 모드별 결과 */}
            {Object.keys(comparisonState.results).length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {showQualityComparison
                      ? 'SVG 품질 비교 결과'
                      : `Fit 모드별 결과 (${targetSize.width}×${targetSize.height})`}
                  </Typography>

                  <Grid container spacing={3}>
                    {displayResults.map(({ key, result, mode }) => {
                      if (!result) return null;

                      return (
                        <Grid size={{ xs: 12, sm: 6, lg: showQualityComparison ? 3 : 4 }} key={key}>
                          <Card variant="outlined" sx={{ border: 2, borderColor: mode.color, height: '100%' }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: mode.color }}>
                                  {mode.name}
                                </Typography>
                                <Chip
                                  label={`${result.scaleFactor.toFixed(1)}x`}
                                  size="small"
                                  color={result.scaleFactor > 1 ? 'success' : 'primary'}
                                  variant="outlined"
                                />
                              </Stack>

                              {!showQualityComparison && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                  {mode.description}
                                </Typography>
                              )}

                              <Box
                                sx={{
                                  border: 1,
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  p: 2,
                                  textAlign: 'center',
                                  bgcolor: 'grey.50',
                                  mb: 2,
                                  height: showQualityComparison ? 120 : 150,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                }}
                              >
                                <img
                                  src={result.processedUrl}
                                  alt={`SVG ${mode.name} 결과`}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                  }}
                                />
                              </Box>

                              <Stack spacing={1}>
                                {result.originalDimensions && (
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      원본 크기:
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {result.originalDimensions.width}×{result.originalDimensions.height}
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption">타겟 크기:</Typography>
                                  <Typography variant="caption">
                                    {result.dimensions.width}×{result.dimensions.height}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" fontWeight="bold">
                                    실제 크기:
                                  </Typography>
                                  <Typography variant="caption" fontWeight="bold" color="primary.main">
                                    {result.actualDimensions?.width}×{result.actualDimensions?.height}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption">처리 시간:</Typography>
                                  <Typography variant="caption">{result.processingTime}ms</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption">파일 크기:</Typography>
                                  <Typography variant="caption">{(result.fileSize / 1024).toFixed(1)} KB</Typography>
                                </Box>
                              </Stack>

                              <Button
                                fullWidth
                                variant="outlined"
                                size="small"
                                startIcon={<Download />}
                                onClick={() => handleDownload(key)}
                                sx={{ mt: 2 }}
                              >
                                다운로드
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
