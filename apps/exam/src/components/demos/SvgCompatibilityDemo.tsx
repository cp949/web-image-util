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
} from '@mui/material';
import { useState, useCallback } from 'react';
import { processImage } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { CodeSnippet } from '../common/CodeSnippet';
import { Download } from '@mui/icons-material';

interface ProcessResult {
  originalUrl: string;
  processedUrl: string;
  processingTime: number;
  fileSize: number;
  dimensions: { width: number; height: number };
  fit: string;
  memoryUsed?: number;
  scaleFactor?: number;
}

interface ComparisonResult {
  coverResult: ProcessResult | null;
  containResult: ProcessResult | null;
  fillResult: ProcessResult | null;
  maxFitResult: ProcessResult | null;
  minFitResult: ProcessResult | null;
  totalProcessingTime: number;
  averageProcessingTime: number;
}

export function SvgCompatibilityDemo() {
  const [originalImage, setOriginalImage] = useState<any>(null);
  const [originalSource, setOriginalSource] = useState<File | string | null>(null); // 🎯 원본 소스 보관
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult>({
    coverResult: null,
    containResult: null,
    fillResult: null,
    maxFitResult: null,
    minFitResult: null,
    totalProcessingTime: 0,
    averageProcessingTime: 0
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  // 샘플 SVG 선택 핸들러
  const handleSampleSelect = useCallback(async (samplePath: string) => {
    setError('');
    setComparisonResult({
      coverResult: null,
      containResult: null,
      fillResult: null,
      maxFitResult: null,
      minFitResult: null,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    });

    try {
      const fullPath = `/sample-images/${samplePath}`;
      setOriginalSource(fullPath); // 🎯 원본 소스 저장 (URL 문자열)

      // 샘플 이미지 정보 저장
      const img = new Image();
      img.onload = () => {
        setOriginalImage({
          url: fullPath,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: 0, // URL이므로 크기 정보 없음
          type: 'image/svg+xml'
        });
      };
      img.src = fullPath;

    } catch (err) {
      setError('샘플 SVG 로드 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : err));
    }
  }, []);

  // SVG 파일 선택 핸들러
  const handleSvgSelect = useCallback(async (source: File | string) => {
    setError('');
    setComparisonResult({
      coverResult: null,
      containResult: null,
      fillResult: null,
      maxFitResult: null,
      minFitResult: null,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    });
    setOriginalSource(source); // 🎯 원본 소스 저장 (File 객체 그대로)

    try {
      let imageUrl: string;
      let fileSize: number = 0;

      if (source instanceof File) {
        imageUrl = URL.createObjectURL(source);
        fileSize = source.size;
      } else {
        imageUrl = source;
      }

      // 원본 이미지 정보 저장
      const img = new Image();
      img.onload = () => {
        setOriginalImage({
          url: imageUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: fileSize,
          type: source instanceof File ? source.type : 'image/svg+xml'
        });
      };
      img.src = imageUrl;

    } catch (err) {
      setError('SVG 파일 로드 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : err));
    }
  }, []);

  // 모든 Fit 모드 비교 테스트
  const handleCompareProcessing = useCallback(async () => {
    if (!originalImage || !originalSource) return;

    setProcessing(true);
    setError('');
    setComparisonResult({
      coverResult: null,
      containResult: null,
      fillResult: null,
      maxFitResult: null,
      minFitResult: null,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    });

    try {
      console.log('🧪 모든 SVG Fit 모드 비교 테스트 시작');
      const totalStartTime = Date.now();

      // 🐛 **상세 디버깅: 전체 처리 과정 추적**
      console.log('🔍 Processing source:', {
        type: typeof originalSource,
        isFile: originalSource instanceof File,
        mimeType: originalSource instanceof File ? originalSource.type : 'N/A',
        name: originalSource instanceof File ? originalSource.name : originalSource,
        size: originalSource instanceof File ? originalSource.size : 'N/A'
      });

      console.log('📐 Original image dimensions:', {
        width: originalImage.width,
        height: originalImage.height,
        aspectRatio: (originalImage.width / originalImage.height).toFixed(3)
      });

      console.log('🎯 Target dimensions:', {
        width: 300,
        height: 200,
        aspectRatio: (300 / 200).toFixed(3)
      });

      // 🎯 **SVG 파일인 경우 문자열로 변환**
      let sourceToProcess = originalSource;
      if (originalSource instanceof File &&
          (originalSource.type === 'image/svg+xml' || originalSource.name?.endsWith('.svg'))) {
        const svgText = await originalSource.text();
        sourceToProcess = svgText;
        console.log('🎨 SVG converted to text:', svgText.substring(0, 100) + '...');
      }

      // 모든 fit 모드 처리
      const fitModes: Array<{ name: 'coverResult' | 'containResult' | 'fillResult' | 'maxFitResult' | 'minFitResult'; fit: 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit'; emoji: string }> = [
        { name: 'coverResult', fit: 'cover', emoji: '🔴' },
        { name: 'containResult', fit: 'contain', emoji: '🔵' },
        { name: 'fillResult', fit: 'fill', emoji: '🟡' },
        { name: 'maxFitResult', fit: 'maxFit', emoji: '🟢' },
        { name: 'minFitResult', fit: 'minFit', emoji: '🟠' }
      ];

      const results: Partial<ComparisonResult> = {};
      const processingTimes: number[] = [];

      for (const mode of fitModes) {
        console.log(`${mode.emoji} ${mode.fit.toUpperCase()} 모드 처리 시작`);
        const startTime = Date.now();

        // 메모리 사용량 추정 (실제 메모리 측정은 제한적이므로 크기 기반 추정)
        const estimatedMemory = (originalImage.width * originalImage.height * 4) / (1024 * 1024); // MB

        const processed = await processImage(sourceToProcess)
          .resize({ fit: mode.fit, width: 300, height: 200 })
          .toBlob({ format: 'png', quality: 0.9 });

        const processingTime = Date.now() - startTime;
        processingTimes.push(processingTime);

        const result: ProcessResult = {
          originalUrl: originalImage.url || '',
          processedUrl: URL.createObjectURL(processed.blob),
          processingTime,
          fileSize: processed.blob.size,
          dimensions: { width: 300, height: 200 },
          fit: mode.fit,
          memoryUsed: estimatedMemory,
          scaleFactor: Math.max(300 / originalImage.width, 200 / originalImage.height)
        };

        results[mode.name] = result;
        console.log(`✅ ${mode.fit.toUpperCase()} 처리 완료:`, {
          time: processingTime + 'ms',
          size: (processed.blob.size / 1024).toFixed(1) + ' KB'
        });
      }

      const totalProcessingTime = Date.now() - totalStartTime;
      const averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

      // 비교 결과 설정
      setComparisonResult({
        ...results,
        totalProcessingTime,
        averageProcessingTime
      } as ComparisonResult);

      console.log('🎉 모든 Fit 모드 비교 테스트 완료!', {
        totalTime: totalProcessingTime + 'ms',
        averageTime: averageProcessingTime.toFixed(1) + 'ms'
      });


    } catch (err) {
      setError('SVG 처리 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : err));
    } finally {
      setProcessing(false);
    }
  }, [originalImage, originalSource]);

  // 결과 다운로드
  const handleDownload = useCallback((type: 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit') => {
    const resultMap = {
      cover: comparisonResult.coverResult,
      contain: comparisonResult.containResult,
      fill: comparisonResult.fillResult,
      maxFit: comparisonResult.maxFitResult,
      minFit: comparisonResult.minFitResult
    };

    const result = resultMap[type];
    if (!result) return;

    const link = document.createElement('a');
    link.href = result.processedUrl;
    link.download = `processed-svg-${type}.png`;
    link.click();
  }, [comparisonResult]);


  // 코드 예제 생성
  const generateCodeExamples = useCallback(() => {
    if (!originalImage) return [];

    const basicCode = `import { processImage } from '@cp949/web-image-util';

// SVG 고품질 처리 (자동 감지)
const processed = await processImage(svgSource)
  .resize({ fit: 'contain', width: 800, height: 600 })
  .toBlob({ format: 'png', quality: 0.9 });

// 결과 사용
const img = new Image();
img.src = URL.createObjectURL(processed);
document.body.appendChild(img);`;

    const advancedCode = `// 다양한 SVG 소스 타입 지원
const sources = [
  svgFile,                              // File 객체
  'data:image/svg+xml;base64,...',      // Data URL
  'https://example.com/icon.svg',       // HTTP URL
  './assets/logo.svg',                  // 파일 경로
  '<svg>...</svg>'                      // SVG 문자열
];

// 모든 소스가 자동으로 고품질 처리됨!
for (const source of sources) {
  const result = await processImage(source)
    .resize({ fit: 'cover', width: 400, height: 400 })
    .toBlob({ format: 'png' });
}`;

    return [
      {
        title: '기본 SVG 처리',
        code: basicCode,
        language: 'typescript'
      },
      {
        title: '고급 - 다양한 소스 타입',
        code: advancedCode,
        language: 'typescript'
      }
    ];
  }, [originalImage]);

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        SVG 호환성 및 고품질 변환
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        processImage()가 SVG를 자동으로 감지하여 고품질(2x-4x 스케일링)로 처리합니다.
        모든 형태의 SVG 소스를 지원합니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 입력 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  SVG 파일 선택
                </Typography>
                <ImageUploader
                  onImageSelect={handleSvgSelect}
                  supportedFormats={['svg']}
                />

                {/* 샘플 SVG 버튼들 */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    또는 샘플 SVG 선택:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {[
                      { file: 'sample1.svg', label: 'SVG 91x114' },
                      { file: 'sample2.svg', label: 'Sample 2' },
                      { file: 'sample3.svg', label: 'Sample 3' },
                      { file: 'sample4.svg', label: 'Sample 4' }
                    ].map((sample) => (
                      <Button
                        key={sample.file}
                        variant="outlined"
                        size="small"
                        onClick={() => handleSampleSelect(sample.file)}
                        sx={{ mb: 1 }}
                      >
                        {sample.label}
                      </Button>
                    ))}
                    {/* 비교용 JPG 버튼 */}
                    <Button
                      variant="outlined"
                      size="small"
                      color="secondary"
                      onClick={() => handleSampleSelect('sample3.jpg')}
                      sx={{ mb: 1 }}
                    >
                      JPG 199x150 (비교용)
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            {originalImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    원본 정보
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">크기:</Typography>
                      <Typography variant="body2">
                        {originalImage.width} × {originalImage.height}
                      </Typography>
                    </Box>
                    {originalImage.size > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">파일 크기:</Typography>
                        <Typography variant="body2">
                          {(originalImage.size / 1024).toFixed(1)} KB
                        </Typography>
                      </Box>
                    )}
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleCompareProcessing}
                    disabled={processing}
                    sx={{ mt: 2 }}
                  >
                    {processing ? '모든 Fit 모드 처리 중...' : '모든 Fit 모드 비교 테스트'}
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
            {processing && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SVG 고품질 처리 중...
                  </Typography>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    processImage()가 SVG를 자동 감지하고 2x-4x 스케일링을 적용하고 있습니다.
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

            {/* 성능 통계 */}
            {(comparisonResult.totalProcessingTime > 0) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    처리 성능 통계
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" display="block">
                          총 처리 시간
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {comparisonResult.totalProcessingTime}ms
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" display="block">
                          평균 처리 시간
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {comparisonResult.averageProcessingTime.toFixed(1)}ms
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" display="block">
                          처리 모드 수
                        </Typography>
                        <Typography variant="h6" color="primary">
                          5개 모드
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" display="block">
                          예상 메모리
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {comparisonResult.coverResult?.memoryUsed?.toFixed(1) || 0} MB
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* 모든 Fit 모드 비교 결과 */}
            {(comparisonResult.coverResult || comparisonResult.containResult ||
              comparisonResult.fillResult || comparisonResult.maxFitResult ||
              comparisonResult.minFitResult) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    모든 Fit 모드 비교 결과 (300×200 변환)
                  </Typography>

                  {/* 원본 이미지 */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      원본 SVG ({originalImage?.width} × {originalImage?.height})
                    </Typography>
                    <Box sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'grey.50',
                      maxWidth: 300,
                      mx: 'auto'
                    }}>
                      <img
                        src={originalImage?.url || ''}
                        alt="원본 SVG"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 150,
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  </Box>

                  {/* 모든 Fit 모드 결과 그리드 */}
                  <Grid container spacing={2}>
                    {[
                      { key: 'coverResult', name: 'Cover', emoji: '🔴', description: '이미지가 영역을 가득 채움 (잘림 가능)' },
                      { key: 'containResult', name: 'Contain', emoji: '🔵', description: '이미지 전체가 영역에 맞춤 (여백 가능)' },
                      { key: 'fillResult', name: 'Fill', emoji: '🟡', description: '비율 무시하고 영역에 맞춤' },
                      { key: 'maxFitResult', name: 'MaxFit', emoji: '🟢', description: '축소만, 확대 안함' },
                      { key: 'minFitResult', name: 'MinFit', emoji: '🟠', description: '확대만, 축소 안함' }
                    ].map(({ key, name, emoji, description }) => {
                      const result = comparisonResult[key as keyof ComparisonResult] as ProcessResult | null;
                      if (!result) return null;

                      return (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="subtitle2" gutterBottom>
                                {emoji} {name} 모드
                              </Typography>
                              <Box sx={{
                                border: 1,
                                borderColor: 'primary.main',
                                borderRadius: 1,
                                p: 1,
                                textAlign: 'center',
                                bgcolor: 'primary.50',
                                mb: 2,
                                height: 120,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <img
                                  src={result.processedUrl}
                                  alt={`${name} 모드 결과`}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                {description}
                              </Typography>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="caption">
                                  {result.processingTime}ms
                                </Typography>
                                <Typography variant="caption">
                                  {(result.fileSize / 1024).toFixed(1)} KB
                                </Typography>
                              </Stack>
                              <Button
                                fullWidth
                                variant="outlined"
                                size="small"
                                startIcon={<Download />}
                                onClick={() => handleDownload(result.fit as any)}
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

            {/* 코드 예제 */}
            {originalImage && (
              <CodeSnippet
                title="SVG 고품질 처리 코드"
                examples={generateCodeExamples()}
              />
            )}

            {/* 지원되는 SVG 소스 타입 안내 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  자동 지원되는 SVG 소스 타입
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      ✅ File/Blob 객체
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      MIME type이 'image/svg+xml'이거나 .svg 확장자인 파일
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      ✅ Data URL SVG
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      data:image/svg+xml;base64,... 또는 data:image/svg+xml,...
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      ✅ HTTP URL SVG
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      .svg 확장자이거나 Content-Type이 image/svg+xml인 URL
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      ✅ 파일 경로
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ./assets/logo.svg, /images/icon.svg 등
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      ✅ SVG XML 문자열
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      &lt;svg&gt;...&lt;/svg&gt; 또는 &lt;?xml...&gt;&lt;svg&gt;...
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;