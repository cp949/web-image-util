'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ProcessingOptions } from './types';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import { ImageMetadata } from '../ui/ImageMetadata';

export function BasicDemo() {
  const {
    originalImage,
    processedImages,
    processing,
    error,
    handleImageSelect,
    handleProcess,
    clearError,
    retry,
    getErrorMessage,
    canRetry,
  } = useImageProcessing();

  const [options, setOptions] = useState<ProcessingOptions>({
    width: 300,
    height: 200,
    fit: 'cover',
    quality: 80,
    format: 'jpeg',
    background: '#ffffff',
    withoutEnlargement: false,
  });

  // UI 전용 상태
  const [useWidth, setUseWidth] = useState(true);
  const [useHeight, setUseHeight] = useState(true);

  // 최신 처리된 이미지
  const processedImage = processedImages[processedImages.length - 1] || null;

  // 처리 옵션 준비
  const prepareProcessingOptions = (): ProcessingOptions => {
    return {
      ...options,
      width: useWidth ? options.width : undefined,
      height: useHeight ? options.height : undefined,
    };
  };

  // 처리 실행
  const handleProcessClick = async () => {
    await handleProcess(prepareProcessingOptions());
  };

  // 재시도
  const handleRetryClick = async () => {
    await retry(prepareProcessingOptions());
  };

  // 코드 예제 생성
  const generateCodeExamples = () => {
    const resizeWidth = useWidth ? options.width : 'undefined';
    const resizeHeight = useHeight ? options.height : 'undefined';

    const basicCode = `import { processImage } from '@cp949/web-image-util';

const result = await processImage(source)
  .resize(${resizeWidth}, ${resizeHeight}, {
    fit: '${options.fit}',
    background: '${options.background}',
    withoutEnlargement: ${options.withoutEnlargement}
  })
  .toBlob({
    format: '${options.format}',
    quality: ${options.quality / 100}
  });

// ResultBlob 타입의 메타데이터 활용
console.log('처리 시간:', result.processingTime, 'ms');
console.log('원본 크기:', result.originalSize);
console.log('결과 크기:', result.width, 'x', result.height);`;

    const advancedCode = `// 더 복잡한 처리 파이프라인
const result = await processImage(source)
  .resize(${resizeWidth}, ${resizeHeight}, { fit: '${options.fit}' })
  .blur(2)  // 블러 효과 추가
  .toBlob({ format: '${options.format}', quality: ${options.quality / 100} });

// 여러 크기로 동시 처리
const [small, medium, large] = await Promise.all([
  processImage(source).resize(150, 100).toBlob(),
  processImage(source).resize(300, 200).toBlob(),
  processImage(source).resize(600, 400).toBlob()
]);

// 에러 처리
try {
  const result = await processImage(source)
    .resize(300, 200)
    .toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}`;

    return [
      {
        title: '기본 사용법',
        code: basicCode,
        language: 'typescript',
      },
      {
        title: '고급 사용법',
        code: advancedCode,
        language: 'typescript',
      },
    ];
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        기본 이미지 처리
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        processImage API를 사용한 기본 이미지 처리 기능을 확인해보세요. 리사이징, 포맷 변환, 품질 조정 등의 기능을
        실시간으로 테스트할 수 있습니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 이미지 업로더 및 옵션 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 이미지 업로더 */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="basic" />

            {/* 에러 표시 */}
            {error && <ErrorDisplay error={error} onRetry={canRetry ? handleRetryClick : undefined} onClear={clearError} canRetry={canRetry} />}

            {/* 처리 상태 */}
            <ProcessingStatus processing={processing} message="이미지를 처리하고 있습니다..." />

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

                  {/* 너비 */}
                  <Box sx={{ mb: 2 }}>
                    <FormControlLabel control={<Checkbox checked={useWidth} onChange={(e) => setUseWidth(e.target.checked)} />} label="너비 사용" />
                    <TextField
                      fullWidth
                      label="너비"
                      type="number"
                      value={options.width || ''}
                      disabled={!useWidth}
                      onChange={(e) => setOptions((prev) => ({ ...prev, width: parseInt(e.target.value) || undefined }))}
                      sx={{ mt: 1 }}
                    />
                  </Box>

                  {/* 높이 */}
                  <Box>
                    <FormControlLabel control={<Checkbox checked={useHeight} onChange={(e) => setUseHeight(e.target.checked)} />} label="높이 사용" />
                    <TextField
                      fullWidth
                      label="높이"
                      type="number"
                      value={options.height || ''}
                      disabled={!useHeight}
                      onChange={(e) => setOptions((prev) => ({ ...prev, height: parseInt(e.target.value) || undefined }))}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>

                {/* Fit 모드 */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Fit 모드</InputLabel>
                  <Select value={options.fit} label="Fit 모드" onChange={(e) => setOptions((prev) => ({ ...prev, fit: e.target.value as any }))}>
                    <MenuItem value="cover">Cover (가득 채우기, 잘림)</MenuItem>
                    <MenuItem value="contain">Contain (전체 포함, 여백)</MenuItem>
                    <MenuItem value="fill">Fill (늘려서 채우기)</MenuItem>
                    <MenuItem value="inside">Inside (축소만, 확대 안함)</MenuItem>
                    <MenuItem value="outside">Outside (확대만, 축소 안함)</MenuItem>
                  </Select>
                </FormControl>

                {/* 크기 제한 옵션 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    크기 제한 옵션
                  </Typography>

                  <FormControlLabel
                    control={<Checkbox checked={options.withoutEnlargement} onChange={(e) => setOptions((prev) => ({ ...prev, withoutEnlargement: e.target.checked }))} />}
                    label="확대 금지 (withoutEnlargement)"
                    sx={{ display: 'block', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, ml: 4 }}>
                    원본보다 큰 크기로 확대하지 않습니다.
                  </Typography>

                </Box>

                {/* 포맷 선택 */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>출력 포맷</InputLabel>
                  <Select value={options.format} label="출력 포맷" onChange={(e) => setOptions((prev) => ({ ...prev, format: e.target.value as any }))}>
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
                    onChange={(_, value) => setOptions((prev) => ({ ...prev, quality: value as number }))}
                    min={10}
                    max={100}
                    step={5}
                    marks={[
                      { value: 10, label: '10%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' },
                    ]}
                  />
                </Box>

                {/* 배경색 */}
                <TextField
                  fullWidth
                  label="배경색 (투명 영역)"
                  value={options.background}
                  onChange={(e) => setOptions((prev) => ({ ...prev, background: e.target.value }))}
                  placeholder="#ffffff"
                  sx={{ mb: 3 }}
                />

                {/* 처리 버튼 */}
                <Button fullWidth variant="contained" onClick={handleProcessClick} disabled={!originalImage || processing} size="large">
                  {processing ? '처리 중...' : '이미지 처리'}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* 우측: 이미지 비교 및 메타데이터 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Before/After 뷰어 */}
            <BeforeAfterView before={originalImage} after={processedImage} />

            {/* 메타데이터 */}
            <ImageMetadata original={originalImage} processed={processedImage} />

            {/* 코드 스니펫 */}
            {originalImage && <CodeSnippet title="현재 설정의 코드 예제" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>

      {/* 도움말 섹션 */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          옵션 설명
        </Typography>

        {/* 크기 제한 옵션 설명 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            크기 제한 옵션
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    확대 금지 (withoutEnlargement)
                  </Typography>
                  <Typography variant="body2">원본 이미지보다 큰 크기로 확대하지 않습니다.</Typography>
                  <Typography variant="caption" color="text.secondary">
                    원본이 300x200인데 500x400을 요청하면 → 300x200으로 유지
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Fit 모드 설명 */}
        <Typography variant="h6" gutterBottom>
          Fit 모드 설명
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cover
                </Typography>
                <Typography variant="body2">비율 유지하며 전체 영역을 채움, 필요시 잘림</Typography>
                <Typography variant="caption" color="text.secondary">
                  CSS object-fit: cover와 동일 (기본값)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Contain
                </Typography>
                <Typography variant="body2">비율 유지하며 전체 이미지가 영역에 들어가도록 맞춤</Typography>
                <Typography variant="caption" color="text.secondary">
                  여백으로 채움 (확대/축소 모두)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Fill
                </Typography>
                <Typography variant="body2">비율 무시하고 정확히 맞춤</Typography>
                <Typography variant="caption" color="text.secondary">
                  이미지가 늘어나거나 압축됨
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Inside
                </Typography>
                <Typography variant="body2">비율 유지하며 최대 크기 제한</Typography>
                <Typography variant="caption" color="text.secondary">
                  축소만, 확대 안함
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Outside
                </Typography>
                <Typography variant="body2">비율 유지하며 최소 크기 보장</Typography>
                <Typography variant="caption" color="text.secondary">
                  확대만, 축소 안함
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}