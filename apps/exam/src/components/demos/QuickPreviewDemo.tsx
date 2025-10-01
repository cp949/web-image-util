'use client';

import { Photo, PhotoSizeSelectLarge, PhotoSizeSelectSmall } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ImageMetadata } from '../ui/ImageMetadata';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { ProcessingOptions } from './types';

/**
 * 원클릭 미리보기 데모
 * autoProcess 기능을 시연하는 간단한 데모 컴포넌트
 */
export function QuickPreviewDemo() {
  // 미리 정의된 프리셋 옵션
  const [selectedPreset, setSelectedPreset] = useState<'thumbnail' | 'medium' | 'large'>('medium');

  // 프리셋별 처리 옵션
  const presets: Record<'thumbnail' | 'medium' | 'large', ProcessingOptions> = {
    thumbnail: {
      fit: 'cover',
      width: 150,
      height: 150,
      quality: 75,
      format: 'jpeg',
    },
    medium: {
      fit: 'cover',
      width: 400,
      height: 300,
      quality: 85,
      format: 'jpeg',
    },
    large: {
      fit: 'contain',
      width: 800,
      height: 600,
      quality: 90,
      format: 'webp',
    },
  };

  // autoProcess 활성화된 훅 사용
  const imageProcessing = useImageProcessing({
    autoProcess: true, // 🎯 원클릭 자동 처리 활성화
    defaultOptions: presets[selectedPreset],
  });

  const {
    originalImage,
    processedImages,
    processing,
    error,
    handleImageSelect,
    handleProcess,
    clearError,
    getErrorMessage,
  } = imageProcessing;

  // 프리셋 변경 시 이미지가 있으면 재처리
  useEffect(() => {
    if (originalImage && !processing) {
      handleProcess(presets[selectedPreset]);
    }
  }, [selectedPreset]); // originalImage와 processing은 의도적으로 제외 (무한 루프 방지)

  // 최신 처리된 이미지
  const processedImage = processedImages[processedImages.length - 1] || null;

  // 코드 예제 생성
  const generateCodeExample = () => {
    const preset = presets[selectedPreset];
    return `import { useImageProcessing } from '@/hooks/useImageProcessing';

// 🎯 autoProcess 옵션으로 원클릭 처리 활성화
const {
  handleImageSelect,
  processedImages,
  processing
} = useImageProcessing({
  autoProcess: true,  // ✨ 이미지 선택 즉시 자동 처리
  defaultOptions: {
    fit: '${preset.fit}',
    width: ${preset.width},
    height: ${preset.height},
    quality: ${preset.quality},
    format: '${preset.format}',
  }
});

// 이미지 선택만 하면 자동으로 처리됨!
// 별도의 "처리하기" 버튼 클릭 불필요
<ImageUploader onImageSelect={handleImageSelect} />`;
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        원클릭 미리보기
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 이미지 업로더 및 정보 */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {/* 프리셋 선택 UI */}
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  프리셋 선택
                </Typography>
                <ToggleButtonGroup
                  value={selectedPreset}
                  exclusive
                  onChange={(_, value) => value && setSelectedPreset(value)}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                >
                  <ToggleButton
                    value="thumbnail"
                    component="div"
                    sx={{ display: 'inline-flex', flexDirection: 'column' }}
                  >
                    썸네일
                    <Chip label="150×150" size="small" />
                  </ToggleButton>
                  <ToggleButton value="medium" component="div" sx={{ display: 'inline-flex', flexDirection: 'column' }}>
                    중간
                    <Chip label="400×300" size="small" sx={{ ml: 1 }} />
                  </ToggleButton>
                  <ToggleButton value="large" component="div" sx={{ display: 'inline-flex', flexDirection: 'column' }}>
                    큰 크기
                    <Chip label="800×600" size="small" sx={{ ml: 1 }} />
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Fit: <strong>{presets[selectedPreset].fit}</strong> | Quality:{' '}
                  <strong>{presets[selectedPreset].quality}</strong> | Format:{' '}
                  <strong>{presets[selectedPreset].format.toUpperCase()}</strong>
                </Typography>
              </CardContent>
            </Card>

            {/* 이미지 업로더 */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="quick-preview" />

            {/* 에러 표시 */}
            {error && <ErrorDisplay error={error} onClear={clearError} canRetry={false} />}

            {/* 처리 상태 */}
            <ProcessingStatus processing={processing} message="이미지를 자동으로 처리하고 있습니다..." />

            {/* 처리 결과 메타데이터 */}
            {originalImage && processedImage && <ImageMetadata original={originalImage} processed={processedImage} />}
          </Stack>
        </Grid>

        {/* 우측: 비교 뷰 및 코드 예제 */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            {/* Before/After 비교 */}
            {originalImage && processedImage && (
              <BeforeAfterView
                before={{
                  src: originalImage.src,
                  width: originalImage.width,
                  height: originalImage.height,
                  size: originalImage.size,
                  format: originalImage.format,
                }}
                after={{
                  src: processedImage.src,
                  width: processedImage.width,
                  height: processedImage.height,
                  size: processedImage.size,
                  format: processedImage.format,
                  processingTime: processedImage.processingTime,
                }}
              />
            )}

            {/* 안내 메시지 */}
            {!originalImage && (
              <Card sx={{ bgcolor: 'background.default' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    사용 방법
                  </Typography>
                  <Typography variant="body2" paragraph>
                    1. 왼쪽에서 <strong>프리셋을 선택</strong>하세요 (썸네일/중간/큰 크기)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    2. 샘플 이미지를 클릭하거나 파일을 업로드하세요
                  </Typography>
                  <Typography variant="body2" paragraph>
                    3. 이미지가 선택되면 <strong>자동으로 즉시 처리</strong>됩니다
                  </Typography>
                  <Typography variant="body2">4. 프리셋을 변경하면 이미지가 자동으로 재처리됩니다</Typography>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            <CodeSnippet
              examples={[
                {
                  title: 'autoProcess 사용법',
                  code: generateCodeExample(),
                  language: 'typescript',
                },
              ]}
              title="코드 예제"
            />

            {/* 장점 설명 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ✨ autoProcess의 장점
                </Typography>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      1. 즉각적인 피드백
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      이미지 선택 즉시 처리 결과를 확인할 수 있어 사용자 경험이 향상됩니다.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      2. 단순한 사용 흐름
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      별도의 "처리하기" 버튼 클릭이 불필요하여 UI가 단순해집니다.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      3. 미리보기 시스템에 최적
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      썸네일 생성, 갤러리 미리보기 등 빠른 피드백이 필요한 경우에 유용합니다.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      4. 커스터마이징 가능
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      defaultOptions를 통해 원하는 처리 설정을 미리 정의할 수 있습니다.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      5. 실시간 프리셋 전환
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      프리셋 변경 시 이미지가 자동으로 재처리되어 다양한 크기를 빠르게 비교할 수 있습니다.
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
