'use client';

import { AspectRatio, Padding as PaddingIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { useRealtimePreview } from '../../hooks/useRealtimePreview';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ImageMetadata } from '../ui/ImageMetadata';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { ProcessingOptions } from './types';

/**
 * 패딩 기능 전용 데모 컴포넌트
 * 숫자 패딩과 객체 패딩을 모두 시연
 * Phase 4.2: useDebounce로 렌더링 최적화
 */
export function PaddingDemo() {
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

  // 실시간 미리보기 기능 (깜빡임 방지를 위해 비활성화)
  const realtimePreview = useRealtimePreview(originalImage, {
    debounceMs: 300,
    enabled: false, // 깜빡임 방지를 위해 비활성화
  });

  // 패딩 모드 (숫자 vs 객체)
  const [paddingMode, setPaddingMode] = useState<'number' | 'object'>('object');

  // 숫자 패딩
  const [numberPadding, setNumberPadding] = useState(20);

  // 객체 패딩
  const [objectPadding, setObjectPadding] = useState({
    top: 10,
    right: 20,
    bottom: 30,
    left: 40,
  });

  // 기본 처리 옵션
  const [options, setOptions] = useState<ProcessingOptions>({
    width: 400,
    height: 300,
    fit: 'contain',
    quality: 85,
    format: 'png',
    background: '#f0f0f0',
    withoutEnlargement: false,
  });

  // 최신 처리된 이미지 (수동 처리 결과만 사용) - useMemo로 메모이제이션
  const processedImage = useMemo(() => {
    return processedImages[processedImages.length - 1] || null; // 실시간 preview 제거
  }, [processedImages]);

  // 🎯 ProcessingStatus 깜빡임 방지를 위한 안정적인 처리 상태 (수동 처리만 사용)
  const [stableProcessing, setStableProcessing] = useState(false);
  const [, cancelProcessingDebounce] = useDebounce(
    () => {
      setStableProcessing(processing); // 실시간 처리 상태 제거
    },
    100, // 100ms 디바운스로 깜빡임 방지
    [processing]
  );


  // 처리 옵션 준비 (패딩 포함) - useMemo로 메모이제이션
  const processingOptions = useMemo((): ProcessingOptions => {
    return {
      ...options,
      padding: paddingMode === 'number' ? numberPadding : objectPadding,
    };
  }, [options, paddingMode, numberPadding, objectPadding]);

  // useDebounce로 옵션 변경 디바운싱 (수동 처리만 사용)
  const [, cancelDebounce] = useDebounce(
    async () => {
      if (originalImage && processingOptions) {
        // 수동 처리만 사용 (실시간 처리 비활성화로 깜빡임 방지)
        await handleProcess(processingOptions);
      }
    },
    600, // 600ms 디바운스 (더 안정적)
    [originalImage, processingOptions, handleProcess]
  );

  // 이미지 선택 시 크기 설정
  useEffect(() => {
    if (originalImage) {
      // 선택된 이미지의 실제 크기로 옵션 업데이트
      setOptions((prev) => ({
        ...prev,
        width: originalImage.width,
        height: originalImage.height,
      }));

      // 처리는 useDebounce가 자동으로 처리함
    }
  }, [originalImage]);

  // 재시도
  const handleRetryClick = useCallback(async () => {
    await retry(processingOptions);
  }, [retry, processingOptions]);

  // 코드 예제 생성
  const generateCodeExamples = useCallback(() => {
    const padding = paddingMode === 'number' ? numberPadding : objectPadding;
    const paddingStr =
      paddingMode === 'number'
        ? padding.toString()
        : `{ top: ${objectPadding.top}, right: ${objectPadding.right}, bottom: ${objectPadding.bottom}, left: ${objectPadding.left} }`;

    const basicCode = `import { processImage } from '@cp949/web-image-util';

// 패딩 적용 이미지 처리
const result = await processImage(source)
  .resize({
    fit: '${options.fit}',
    width: ${options.width},
    height: ${options.height},
    padding: ${paddingStr},  // 🎯 패딩 설정
    background: '${options.background}',  // 패딩 영역 배경색
  })
  .toBlob('${options.format}');

// 결과 이미지는 원본 이미지 + 패딩을 합친 크기
console.log('결과 크기:', result.width, 'x', result.height);`;

    const patternCode = `// 🎨 패딩 사용 패턴들

// 1️⃣ 숫자 패딩 - 모든 방향 동일
const uniform = await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    padding: 20,  // 상하좌우 모두 20px
    background: '#ffffff',
  })
  .toBlob();

// 2️⃣ 객체 패딩 - 각 방향별 개별 설정
const custom = await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    padding: {
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    },
    background: '#f0f0f0',
  })
  .toBlob();

// 3️⃣ 일부 방향만 패딩 (나머지는 0)
const partial = await processImage(source)
  .resize({
    fit: 'cover',
    width: 400,
    height: 300,
    padding: {
      top: 20,
      bottom: 20,
      // left, right는 0
    },
    background: 'transparent',
  })
  .toBlob('png');  // 투명도 지원 위해 PNG`;

    const useCaseCode = `// 💡 실제 사용 사례

// 🖼️ 액자 효과 (프레임)
const frame = await processImage(photo)
  .resize({
    fit: 'contain',
    width: 500,
    height: 400,
    padding: 30,  // 액자 테두리
    background: '#8b4513',  // 나무색 프레임
  })
  .toBlob();

// 📱 SNS 업로드 (안전 영역 확보)
const social = await processImage(image)
  .resize({
    fit: 'contain',
    width: 1080,
    height: 1080,
    padding: 50,  // 잘림 방지 여백
    background: '#ffffff',
  })
  .toBlob('jpeg');

// 🎨 썸네일 (그림자 효과용 여백)
const thumbnail = await processImage(source)
  .resize({
    fit: 'cover',
    width: 200,
    height: 200,
    padding: {
      right: 8,   // 그림자 공간
      bottom: 8,  // 그림자 공간
    },
    background: 'transparent',
  })
  .toBlob('png');`;

    return [
      {
        title: '기본 사용법',
        code: basicCode,
        language: 'typescript',
      },
      {
        title: '패딩 패턴들',
        code: patternCode,
        language: 'typescript',
      },
      {
        title: '실제 사용 사례',
        code: useCaseCode,
        language: 'typescript',
      },
    ];
  }, [paddingMode, numberPadding, objectPadding, options]);

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        <PaddingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        패딩 기능
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        이미지 주변에 여백(패딩)을 추가하여 액자 효과, 안전 영역 확보, SNS 업로드 최적화 등을 구현할 수 있습니다.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          📐 패딩 작동 원리
        </Typography>
        <Typography variant="body2">
          <strong>결과 크기 = 이미지 크기 + 패딩</strong>
          <br />
          예: 300×200 이미지에 20px 패딩 → 결과는 340×240 (좌우 +40, 상하 +40)
        </Typography>
      </Alert>

      <Grid container spacing={4}>
        {/* 좌측: 이미지 업로더 및 옵션 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 이미지 업로더 */}
            <ImageUploader
              onImageSelect={(source) => {
                handleImageSelect(source);
              }}
              recommendedSamplesFor="padding"
            />

            {/* 에러 표시 (실시간 에러 제거) */}
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={canRetry ? handleRetryClick : undefined}
                onClear={clearError}
                canRetry={canRetry}
              />
            )}

            {/* 처리 상태 (깜빡임 방지된 안정 상태 사용) */}
            <ProcessingStatus processing={stableProcessing} message="패딩을 적용하고 있습니다..." />

            {/* 패딩 설정 */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  패딩 설정
                </Typography>

                {/* 패딩 모드 선택 */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    패딩 모드
                  </Typography>
                  <ToggleButtonGroup
                    value={paddingMode}
                    exclusive
                    onChange={(_, value) => value && setPaddingMode(value)}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="number">
                      숫자
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        (모든 방향 동일)
                      </Typography>
                    </ToggleButton>
                    <ToggleButton value="object">
                      객체
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        (각 방향별)
                      </Typography>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* 숫자 패딩 UI */}
                {paddingMode === 'number' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      패딩 크기: {numberPadding}px (상하좌우 모두)
                    </Typography>

                    {/* 프리셋 패딩 버튼들 */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      {[0, 10, 20, 30, 50].map((preset) => (
                        <Button
                          key={preset}
                          size="small"
                          variant={numberPadding === preset ? 'contained' : 'outlined'}
                          onClick={() => setNumberPadding(preset)}
                          sx={{ minWidth: 60 }}
                        >
                          {preset}px
                        </Button>
                      ))}
                    </Stack>

                    <Slider
                      value={numberPadding}
                      onChange={(_, value) => setNumberPadding(value as number)}
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

                {/* 객체 패딩 UI */}
                {paddingMode === 'object' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      각 방향별 패딩 크기
                    </Typography>

                    {/* 객체 패딩 프리셋 */}
                    <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 10, right: 10, bottom: 10, left: 10 })}
                      >
                        균일 (10px 전체)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 0, right: 8, bottom: 8, left: 0 })}
                      >
                        그림자용 (우하단)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 20, right: 20, bottom: 40, left: 20 })}
                      >
                        캡션용 (하단 여백)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 30, right: 30, bottom: 30, left: 30 })}
                      >
                        액자 (30px 전체)
                      </Button>
                    </Stack>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption">Top: {objectPadding.top}px</Typography>
                      <Slider
                        value={objectPadding.top}
                        onChange={(_, value) => setObjectPadding((prev) => ({ ...prev, top: value as number }))}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption">Right: {objectPadding.right}px</Typography>
                      <Slider
                        value={objectPadding.right}
                        onChange={(_, value) => setObjectPadding((prev) => ({ ...prev, right: value as number }))}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption">Bottom: {objectPadding.bottom}px</Typography>
                      <Slider
                        value={objectPadding.bottom}
                        onChange={(_, value) => setObjectPadding((prev) => ({ ...prev, bottom: value as number }))}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </Box>

                    <Box>
                      <Typography variant="caption">Left: {objectPadding.left}px</Typography>
                      <Slider
                        value={objectPadding.left}
                        onChange={(_, value) => setObjectPadding((prev) => ({ ...prev, left: value as number }))}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </Box>
                  </Box>
                )}

                {/* 배경색 */}
                <TextField
                  fullWidth
                  label="패딩 배경색"
                  value={options.background}
                  onChange={(e) => setOptions((prev) => ({ ...prev, background: e.target.value }))}
                  placeholder="#f0f0f0"
                  sx={{ mb: 3 }}
                  helperText="CSS 색상 (예: #ffffff, rgb(255,0,0), transparent)"
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* 우측: 이미지 비교 및 메타데이터 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 처리 설정 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  처리 설정
                </Typography>
                <Grid container spacing={3}>
                  {/* Fit 모드 */}
                  <Grid size={6}>
                    <FormControl>
                      <FormLabel component="legend" sx={{ mb: 1 }}>
                        Fit 모드
                      </FormLabel>
                      <RadioGroup
                        value={options.fit}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            fit: e.target.value as ProcessingOptions['fit'],
                          }))
                        }
                      >
                        <FormControlLabel
                          value="contain"
                          control={<Radio size="small" />}
                          label="Contain (전체 포함) ⭐"
                        />
                        <FormControlLabel value="cover" control={<Radio size="small" />} label="Cover (가득 채우기)" />
                        <FormControlLabel value="fill" control={<Radio size="small" />} label="Fill (늘려서 채우기)" />
                        <FormControlLabel value="maxFit" control={<Radio size="small" />} label="MaxFit (축소만)" />
                        <FormControlLabel value="minFit" control={<Radio size="small" />} label="MinFit (확대만)" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>

                  {/* 포맷 선택 */}
                  <Grid size={6}>
                    <FormControl>
                      <FormLabel component="legend" sx={{ mb: 1 }}>
                        출력 포맷
                      </FormLabel>
                      <RadioGroup
                        value={options.format}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            format: e.target.value as ProcessingOptions['format'],
                          }))
                        }
                      >
                        <FormControlLabel value="png" control={<Radio size="small" />} label="PNG (투명도 지원) ⭐" />
                        <FormControlLabel value="jpeg" control={<Radio size="small" />} label="JPEG" />
                        <FormControlLabel value="webp" control={<Radio size="small" />} label="WebP" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Before/After 뷰어 (props memoization으로 리렌더링 최적화) */}
            <BeforeAfterView
              before={useMemo(() => originalImage, [originalImage])}
              after={useMemo(() => processedImage, [processedImage])}
            />

            {/* 메타데이터 */}
            <ImageMetadata original={originalImage} processed={processedImage} />

            {/* 크기 계산 미리보기 (이미지 선택 후 항상 표시) */}
            {originalImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AspectRatio sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {processedImage ? '크기 변화 분석' : '예상 크기 계산'}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="subtitle2" color="primary">
                        원본 크기
                      </Typography>
                      <Typography variant="body2">
                        {originalImage.width} × {originalImage.height}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="subtitle2" color={processedImage ? 'success.main' : 'warning.main'}>
                        {processedImage ? '결과 크기' : '예상 크기'} (패딩 포함)
                      </Typography>
                      <Typography variant="body2">
                        {processedImage ? (
                          <>
                            {processedImage.width} × {processedImage.height}
                          </>
                        ) : (
                          <>
                            {(() => {
                              // 예상 크기 계산
                              const targetWidth = options.width || originalImage.width;
                              const targetHeight = options.height || originalImage.height;
                              const paddingH =
                                paddingMode === 'number' ? numberPadding * 2 : objectPadding.left + objectPadding.right;
                              const paddingV =
                                paddingMode === 'number' ? numberPadding * 2 : objectPadding.top + objectPadding.bottom;
                              return `${targetWidth + paddingH} × ${targetHeight + paddingV}`;
                            })()}
                          </>
                        )}
                      </Typography>
                    </Grid>
                    <Grid size={12}>
                      <Alert severity={processedImage ? 'success' : 'info'} sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          {paddingMode === 'number' ? (
                            <>
                              <strong>패딩 {numberPadding}px</strong> 적용 시 → 너비 +{numberPadding * 2}px, 높이 +
                              {numberPadding * 2}px
                            </>
                          ) : (
                            <>
                              <strong>비대칭 패딩</strong> 적용 시 → 너비 +{objectPadding.left + objectPadding.right}px
                              (L:{objectPadding.left} + R:{objectPadding.right}), 높이 +
                              {objectPadding.top + objectPadding.bottom}px (T:{objectPadding.top} + B:
                              {objectPadding.bottom})
                            </>
                          )}
                        </Typography>
                      </Alert>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* 코드 스니펫 */}
            {originalImage && <CodeSnippet title="패딩 사용 예제" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
