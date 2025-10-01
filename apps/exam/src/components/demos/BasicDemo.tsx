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
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ImageMetadata } from '../ui/ImageMetadata';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { OutputFormat, ProcessingOptions, ResizeFit } from './types';

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
  const [usePadding, setUsePadding] = useState(false);
  const [paddingValue, setPaddingValue] = useState(20);

  // 자동 처리를 위한 memoized 옵션
  const processingOptions = useMemo(() => {
    return {
      ...options,
      width: useWidth ? options.width : undefined,
      height: useHeight ? options.height : undefined,
      padding: usePadding ? paddingValue : undefined,
    };
  }, [options, useWidth, useHeight, usePadding, paddingValue]);

  // 최신 처리된 이미지
  const processedImage = useMemo(() => {
    return processedImages[processedImages.length - 1] || null;
  }, [processedImages]);

  // useDebounce를 사용한 자동 처리 (깜빡임 방지)
  const [, cancelDebounce] = useDebounce(
    async () => {
      if (originalImage && processingOptions) {
        await handleProcess(processingOptions);
      }
    },
    500, // 500ms 디바운스
    [originalImage, processingOptions, handleProcess]
  );


  // 재시도
  const handleRetryClick = async () => {
    await retry(processingOptions);
  };

  // 코드 예제 생성
  const generateCodeExamples = () => {
    // ResizeConfig API 사용
    const resizeConfig = `{
    fit: '${options.fit}',${useWidth ? `\n    width: ${options.width},` : ''}${useHeight ? `\n    height: ${options.height},` : ''}${options.withoutEnlargement ? '\n    withoutEnlargement: true,' : ''}${usePadding ? `\n    padding: ${paddingValue},` : ''}${options.background !== '#ffffff' ? `\n    background: '${options.background}',` : ''}
  }`;

    const basicCode = `import { processImage } from '@cp949/web-image-util';

// ✅ ResizeConfig API
const result = await processImage(source)
  .resize(${resizeConfig})
  .toBlob('${options.format}');

// ResultBlob 타입의 메타데이터 활용
console.log('처리 시간:', result.processingTime, 'ms');
console.log('원본 크기:', result.originalSize);
console.log('결과 크기:', result.width, 'x', result.height);`;

    const constraintCode = `// 🚨 resize() 제약: 한 번만 호출 가능!
import { processImage } from '@cp949/web-image-util';

// ✅ 올바른 사용법: resize() 한 번만 호출
const correct = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .blur(2)  // resize() 후 다른 효과는 가능
  .toBlob();

// ❌ 잘못된 사용법: resize() 중복 호출 (컴파일 에러!)
try {
  const wrong = await processImage(source)
    .resize({ fit: 'cover', width: 300, height: 200 })
    .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 에러!
} catch (error) {
  // ImageProcessError: resize()는 한 번만 호출할 수 있습니다
  console.error(error.code); // 'MULTIPLE_RESIZE_NOT_ALLOWED'
}

// ✅ 여러 크기가 필요하면 별도 인스턴스 사용
const [small, large] = await Promise.all([
  processImage(source).resize({ fit: 'cover', width: 150, height: 100 }).toBlob(),
  processImage(source).resize({ fit: 'cover', width: 600, height: 400 }).toBlob()
]);`;

    const qualityCode = `// 🎯 품질 개선: "계산은 미리, 렌더링은 한 번"
import { processImage } from '@cp949/web-image-util';

// SVG 고품질 처리 (scaleFactor 제거됨)
const svgResult = await processImage(svgString)
  .resize({ fit: 'contain', width: 800, height: 600 })
  .toBlob('png');

// 복합 처리도 한 번에 렌더링
const complex = await processImage(source)
  .resize({ fit: 'cover', width: 400, height: 300 })
  .blur(1.5)
  .toBlob('webp');

// 타입 안전성: 컴파일 시점에 제약 검증
const processor = processImage(source);
processor.resize({ fit: 'cover', width: 300, height: 200 });
// processor.resize(...); // ← TypeScript 컴파일 에러!`;

    return [
      {
        title: '기본 사용법',
        code: basicCode,
        language: 'typescript',
      },
      {
        title: 'resize() 제약 및 에러 처리',
        code: constraintCode,
        language: 'typescript',
      },
      {
        title: '품질 개선 특징',
        code: qualityCode,
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
        processImage API의 혁신적인 기능을 체험해보세요. ResizeConfig API, resize() 단일 호출 제약, "계산은 미리,
        렌더링은 한 번" 철학으로 더 나은 성능과 품질을 제공합니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 이미지 업로더 및 옵션 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 이미지 업로더 */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="basic" />

            {/* 에러 표시 */}
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={canRetry ? handleRetryClick : undefined}
                onClear={clearError}
                canRetry={canRetry}
              />
            )}

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
                    <FormControlLabel
                      control={<Checkbox checked={useWidth} onChange={(e) => setUseWidth(e.target.checked)} />}
                      label="너비 사용"
                    />
                    {useWidth && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" gutterBottom>
                          너비: {options.width || 300}px
                        </Typography>
                        <Slider
                          value={options.width || 300}
                          onChange={(_, value) => setOptions((prev) => ({ ...prev, width: value as number }))}
                          min={1}
                          max={1600}
                          step={1}
                          marks={[
                            { value: 1, label: '1' },
                            { value: 400, label: '400' },
                            { value: 800, label: '800' },
                            { value: 1200, label: '1200' },
                            { value: 1600, label: '1600' },
                          ]}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* 높이 */}
                  <Box>
                    <FormControlLabel
                      control={<Checkbox checked={useHeight} onChange={(e) => setUseHeight(e.target.checked)} />}
                      label="높이 사용"
                    />
                    {useHeight && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" gutterBottom>
                          높이: {options.height || 200}px
                        </Typography>
                        <Slider
                          value={options.height || 200}
                          onChange={(_, value) => setOptions((prev) => ({ ...prev, height: value as number }))}
                          min={1}
                          max={1600}
                          step={1}
                          marks={[
                            { value: 1, label: '1' },
                            { value: 400, label: '400' },
                            { value: 800, label: '800' },
                            { value: 1200, label: '1200' },
                            { value: 1600, label: '1600' },
                          ]}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>


                {/* 크기 제한 옵션 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    크기 제한 옵션
                  </Typography>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.withoutEnlargement}
                        onChange={(e) => setOptions((prev) => ({ ...prev, withoutEnlargement: e.target.checked }))}
                      />
                    }
                    label="확대 금지 (withoutEnlargement)"
                    sx={{ display: 'block', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, ml: 4 }}>
                    원본보다 큰 크기로 확대하지 않습니다.
                  </Typography>
                </Box>

                {/* 패딩 옵션 */}
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={<Checkbox checked={usePadding} onChange={(e) => setUsePadding(e.target.checked)} />}
                    label="패딩 추가 (padding)"
                    sx={{ display: 'block', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, ml: 4 }}>
                    이미지 주변에 여백을 추가합니다. (액자 효과, 안전 영역)
                  </Typography>

                  {usePadding && (
                    <Box sx={{ ml: 4, mt: 2 }}>
                      <Typography variant="caption" gutterBottom>
                        패딩 크기: {paddingValue}px (상하좌우)
                      </Typography>

                      {/* 프리셋 패딩 버튼들 */}
                      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                        {[10, 20, 30, 50].map((preset) => (
                          <Button
                            key={preset}
                            size="small"
                            variant={paddingValue === preset ? 'contained' : 'outlined'}
                            onClick={() => setPaddingValue(preset)}
                            sx={{ minWidth: 50 }}
                          >
                            {preset}
                          </Button>
                        ))}
                      </Stack>

                      <Slider
                        value={paddingValue}
                        onChange={(_, value) => setPaddingValue(value as number)}
                        min={0}
                        max={100}
                        step={5}
                        marks={[
                          { value: 0, label: '0' },
                          { value: 50, label: '50' },
                          { value: 100, label: '100' },
                        ]}
                      />
                    </Box>
                  )}
                </Box>


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

                {/* 자동 처리 안내 */}
                <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                  <Typography variant="body2" color="primary.main">
                    ✨ 자동 처리: 이미지 선택이나 옵션 변경 시 자동으로 처리됩니다
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    500ms 딜레이로 깜빡임을 최소화합니다
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* 우측: 상단 옵션, 이미지 비교 및 메타데이터 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 상단: Fit 모드와 출력 포맷 옵션 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  빠른 설정
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {/* Fit 모드 - RadioGroup */}
                    <FormControl>
                      <FormLabel component="legend">Fit 모드</FormLabel>
                      <RadioGroup
                        value={options.fit}
                        onChange={(e) => setOptions((prev) => ({ ...prev, fit: e.target.value as ResizeFit }))}
                      >
                        <FormControlLabel value="cover" control={<Radio />} label="Cover (가득 채우기, 잘림)" />
                        <FormControlLabel value="contain" control={<Radio />} label="Contain (전체 포함, 여백)" />
                        <FormControlLabel value="fill" control={<Radio />} label="Fill (늘려서 채우기)" />
                        <FormControlLabel value="maxFit" control={<Radio />} label="MaxFit (축소만, 확대 안함)" />
                        <FormControlLabel value="minFit" control={<Radio />} label="MinFit (확대만, 축소 안함)" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {/* 출력 포맷 - RadioGroup */}
                    <FormControl>
                      <FormLabel component="legend">출력 포맷</FormLabel>
                      <RadioGroup
                        value={options.format}
                        onChange={(e) => setOptions((prev) => ({ ...prev, format: e.target.value as OutputFormat }))}
                      >
                        <FormControlLabel value="jpeg" control={<Radio />} label="JPEG" />
                        <FormControlLabel value="png" control={<Radio />} label="PNG" />
                        <FormControlLabel value="webp" control={<Radio />} label="WebP" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Before/After 뷰어 */}
            <BeforeAfterView before={originalImage} after={processedImage} />

            {/* 메타데이터 */}
            <ImageMetadata original={originalImage} processed={processedImage} />

            {/* 코드 스니펫 */}
            {originalImage && <CodeSnippet title="현재 설정의 코드 예제" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
