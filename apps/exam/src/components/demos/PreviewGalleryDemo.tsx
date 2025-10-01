'use client';

import { processImage, ResizeConfig } from '@cp949/web-image-util';
import { Download, PhotoSizeSelectActual, Storage } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { ImageUploader } from '../common/ImageUploader';

// 처리 옵션 프리셋 정의
interface ProcessPreset {
  id: string;
  category: string;
  name: string;
  description: string;
  options: ResizeConfig & {
    quality: number;
    format: 'jpeg' | 'png' | 'webp';
    blur?: number;
    withoutEnlargement?: boolean;
  };
}

// 프리셋 데이터 정의
const PROCESSING_PRESETS: ProcessPreset[] = [
  // Fit 모드 비교 (300x200 고정)
  {
    id: 'fit-cover',
    category: 'Fit 모드',
    name: 'Cover',
    description: '비율 유지하며 전체 영역 채움, 필요시 잘림',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'fit-contain',
    category: 'Fit 모드',
    name: 'Contain',
    description: '비율 유지하며 전체 이미지가 영역에 들어감',
    options: { width: 300, height: 200, fit: 'contain', quality: 80, format: 'jpeg' },
  },
  {
    id: 'fit-fill',
    category: 'Fit 모드',
    name: 'Fill',
    description: '비율 무시하고 정확히 맞춤',
    options: { width: 300, height: 200, fit: 'fill', quality: 80, format: 'jpeg' },
  },
  {
    id: 'fit-maxFit',
    category: 'Fit 모드',
    name: 'MaxFit (축소만)',
    description: '큰 이미지만 축소, 작은 이미지는 원본 유지',
    options: {
      width: 200,
      height: 150,
      fit: 'maxFit',
      quality: 80,
      format: 'jpeg',
    },
  },
  {
    id: 'fit-minFit',
    category: 'Fit 모드',
    name: 'MinFit (확대만)',
    description: '작은 이미지만 확대, 큰 이미지는 원본 유지',
    options: { width: 400, height: 300, fit: 'minFit', quality: 80, format: 'jpeg' },
  },

  // MaxFit/MinFit 상세 테스트
  {
    id: 'maxfit-test-small',
    category: 'MaxFit 테스트',
    name: 'MaxFit 작은제약 (100x80)',
    description: '작은 이미지에는 영향없음, 큰 이미지만 축소',
    options: { width: 100, height: 80, fit: 'maxFit', quality: 80, format: 'jpeg' },
  },
  {
    id: 'minfit-test-large',
    category: 'MinFit 테스트',
    name: 'MinFit 큰제약 (600x400)',
    description: '큰 이미지에는 영향없음, 작은 이미지만 확대',
    options: { width: 600, height: 400, fit: 'minFit', quality: 80, format: 'jpeg' },
  },

  // 크기별 비교 (Cover 고정)
  {
    id: 'size-thumbnail',
    category: '크기 비교',
    name: '썸네일',
    description: '150×100 픽셀',
    options: { width: 150, height: 100, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'size-small',
    category: '크기 비교',
    name: '소형',
    description: '300×200 픽셀',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'size-medium',
    category: '크기 비교',
    name: '중형',
    description: '600×400 픽셀',
    options: { width: 600, height: 400, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'size-large',
    category: '크기 비교',
    name: '대형',
    description: '900×600 픽셀',
    options: { width: 900, height: 600, fit: 'cover', quality: 80, format: 'jpeg' },
  },

  // 품질별 비교 (300x200, Cover, JPEG)
  {
    id: 'quality-high',
    category: '품질 비교',
    name: '최고 품질',
    description: '95% 품질',
    options: { width: 300, height: 200, fit: 'cover', quality: 95, format: 'jpeg' },
  },
  {
    id: 'quality-good',
    category: '품질 비교',
    name: '고품질',
    description: '85% 품질',
    options: { width: 300, height: 200, fit: 'cover', quality: 85, format: 'jpeg' },
  },
  {
    id: 'quality-normal',
    category: '품질 비교',
    name: '보통',
    description: '70% 품질',
    options: { width: 300, height: 200, fit: 'cover', quality: 70, format: 'jpeg' },
  },
  {
    id: 'quality-low',
    category: '품질 비교',
    name: '저품질',
    description: '50% 품질',
    options: { width: 300, height: 200, fit: 'cover', quality: 50, format: 'jpeg' },
  },

  // 포맷별 비교 (300x200, Cover, 80% 품질)
  {
    id: 'format-jpeg',
    category: '포맷 비교',
    name: 'JPEG',
    description: '손실 압축, 사진에 적합',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'format-png',
    category: '포맷 비교',
    name: 'PNG',
    description: '무손실, 투명도 지원',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'png' },
  },
  {
    id: 'format-webp',
    category: '포맷 비교',
    name: 'WebP',
    description: '고효율 압축, 모던 포맷',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'webp' },
  },

  // 특수 효과 (300x200, Cover)
  {
    id: 'effect-original',
    category: '효과 비교',
    name: '원본',
    description: '효과 없음',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'effect-blur-light',
    category: '효과 비교',
    name: '블러 약함',
    description: '2px 블러 효과',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg', blur: 2 },
  },
  {
    id: 'effect-blur-strong',
    category: '효과 비교',
    name: '블러 강함',
    description: '5px 블러 효과',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg', blur: 5 },
  },
];

// 처리 결과 타입
interface ProcessResult {
  preset: ProcessPreset;
  imageUrl: string;
  width: number;
  height: number;
  fileSize: number;
  processingTime: number;
  error?: string;
}

export function PreviewGalleryDemo() {
  const [originalImage, setOriginalImage] = useState<any>(null);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const handleImageSelect = useCallback(async (source: File | string) => {
    setResults([]);
    setProcessedCount(0);

    // 원본 이미지 정보 설정
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

    // 모든 프리셋으로 처리 시작
    await processAllPresets(source);
  }, []);

  const processAllPresets = async (source: File | string) => {
    setProcessing(true);
    const newResults: ProcessResult[] = [];

    for (let i = 0; i < PROCESSING_PRESETS.length; i++) {
      const preset = PROCESSING_PRESETS[i];

      try {
        const startTime = Date.now();

        // 타입 안전성을 위해 기본값 제공
        const width = preset.options.width || 300;
        const height = preset.options.height || 200;

        const resizeConfig =
          preset.options.fit === 'contain'
            ? {
                fit: 'contain' as const,
                width,
                height,
                ...(preset.options.withoutEnlargement ? { withoutEnlargement: true } : {}),
              }
            : preset.options.fit === 'cover'
              ? {
                  fit: 'cover' as const,
                  width,
                  height,
                }
              : preset.options.fit === 'fill'
                ? {
                    fit: 'fill' as const,
                    width,
                    height,
                  }
                : preset.options.fit === 'maxFit'
                  ? {
                      fit: 'maxFit' as const,
                      width,
                      height,
                    }
                  : {
                      fit: 'minFit' as const,
                      width,
                      height,
                    };


        let processor = processImage(source) //
          .resize(resizeConfig);

        // 블러 효과 적용
        if (preset.options.blur) {
          processor = processor.blur(preset.options.blur);
        }

        const result = await processor.toBlob({
          format: preset.options.format || 'jpeg',
          quality: (preset.options.quality || 80) / 100,
        });

        const processingTime = Date.now() - startTime;
        const imageUrl = URL.createObjectURL(result.blob);


        newResults.push({
          preset,
          imageUrl,
          width: result.width,
          height: result.height,
          fileSize: result.blob.size,
          processingTime,
        });
      } catch (error) {
        console.error(`Processing failed for preset ${preset.id}:`, error);
        newResults.push({
          preset,
          imageUrl: '',
          width: 0,
          height: 0,
          fileSize: 0,
          processingTime: 0,
          error: error instanceof Error ? error.message : '처리 실패',
        });
      }

      setProcessedCount(i + 1);
      setResults([...newResults]);
    }

    setProcessing(false);
  };

  const handleDownload = (result: ProcessResult) => {
    if (result.imageUrl) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `${result.preset.name.replace(/\s+/g, '_')}.${result.preset.options.format || 'jpeg'}`;
      link.click();
    }
  };

  // 파일 크기를 읽기 쉽게 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 간단한 체인 형태 코드 예제 생성 (새로운 ResizeConfig API)
  const generateCodeForPreset = (preset: ProcessPreset): string => {
    const { options } = preset;

    // 프리셋 헤더
    let code = `// ${preset.name} 프리셋 예제\n`;
    code += `// ${preset.description}\n\n`;

    // 체인 형태로 코드 생성
    let chain = 'processImage(source)';

    // resize 추가 - 새로운 ResizeConfig 객체 방식
    if (options.width || options.height) {
      const resizeConfig: string[] = [];

      // fit 속성 (기본값 cover)
      const fit = options.fit || 'cover';
      resizeConfig.push(`fit: '${fit}'`);

      // width/height 속성
      if (options.width) {
        resizeConfig.push(`width: ${options.width}`);
      }
      if (options.height) {
        resizeConfig.push(`height: ${options.height}`);
      }

      // withoutEnlargement 속성 (contain 모드에서만 유효)
      if (options.withoutEnlargement && fit === 'contain') {
        resizeConfig.push('withoutEnlargement: true');
      }

      chain += `.resize({ ${resizeConfig.join(', ')} })`;
    }

    // blur 추가
    if (options.blur) {
      chain += `.blur(${options.blur})`;
    }

    // 출력 옵션
    const outputOptions: string[] = [];
    if (options.format && options.format !== 'jpeg') {
      outputOptions.push(`format: '${options.format}'`);
    }
    if (options.quality && options.quality !== 80) {
      outputOptions.push(`quality: ${options.quality / 100}`);
    }

    // toDataURL 체인 완성
    chain += '.toDataURL(';
    if (outputOptions.length > 0) {
      chain += `{ ${outputOptions.join(', ')} }`;
    }
    chain += ')';

    // 멀티라인 체인 형태로 포맷팅
    const formattedChain = chain
      .replace(/processImage\(source\)/, 'processImage(source)')
      .replace(/\.resize\(([^)]+)\)/, '\n  .resize($1)')
      .replace(/\.blur\(([^)]+)\)/, '\n  .blur($1)')
      .replace(/\.toDataURL\(([^)]*)\)/, '\n  .toDataURL($1)');

    code += `const result = await ${formattedChain};`;

    return code;
  };

  // 카테고리별로 결과 그룹핑
  const groupedResults = results.reduce(
    (groups, result) => {
      const category = result.preset.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(result);
      return groups;
    },
    {} as Record<string, ProcessResult[]>
  );

  return (
    <Container maxWidth="xl">
      <Typography variant="h3" component="h1" gutterBottom>
        변환 미리보기
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        이미지 하나로 모든 처리 옵션을 한눈에 비교해보세요. 다양한 크기, 품질, 포맷, 효과가 적용된 결과를 실시간으로
        확인할 수 있습니다.
      </Typography>

      {/* 이미지 업로더 */}
      <Box sx={{ mb: 4, maxWidth: 400 }}>
        <ImageUploader onImageSelect={handleImageSelect} />
      </Box>

      {/* 원본 이미지 정보 */}
      {originalImage && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              원본 이미지 정보
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <PhotoSizeSelectActual color="primary" />
                  <Typography variant="caption" display="block">
                    크기
                  </Typography>
                  <Typography variant="h6">
                    {originalImage.width} × {originalImage.height}
                  </Typography>
                </Box>
              </Grid>
              {originalImage.size && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Storage color="primary" />
                    <Typography variant="caption" display="block">
                      파일 크기
                    </Typography>
                    <Typography variant="h6">{formatFileSize(originalImage.size)}</Typography>
                  </Box>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" display="block">
                    포맷
                  </Typography>
                  <Chip label={originalImage.format?.toUpperCase() || 'Unknown'} color="primary" />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 진행률 표시 */}
      {processing && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              처리 중... ({processedCount}/{PROCESSING_PRESETS.length})
            </Typography>
            <LinearProgress variant="determinate" value={(processedCount / PROCESSING_PRESETS.length) * 100} />
          </CardContent>
        </Card>
      )}

      {/* 결과 표시 */}
      {Object.entries(groupedResults).map(([category, categoryResults]) => (
        <Box key={category} sx={{ mb: 6 }}>
          <Typography variant="h5" gutterBottom>
            {category}
          </Typography>
          <Grid container spacing={3}>
            {categoryResults.map((result) => (
              <Grid size={{ xs: 12, lg: 6 }} key={result.preset.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* 이미지 또는 에러 표시 */}
                    {result.error ? (
                      <Box
                        sx={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                          color: 'error.main',
                        }}
                      >
                        <Typography variant="body2" align="center">
                          처리 실패
                          <br />
                          {result.error}
                        </Typography>
                      </Box>
                    ) : result.imageUrl ? (
                      <Box sx={{ mb: 2 }}>
                        <img
                          src={result.imageUrl}
                          alt={result.preset.name}
                          style={{
                            width: 'auto',
                            height: 'auto',
                            maxHeight: 200,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: 4,
                            border: '2px dashed #f44336',
                            display: 'block',
                            margin: '0 auto',
                          }}
                        />
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          처리 중...
                        </Typography>
                      </Box>
                    )}

                    {/* 프리셋 정보 */}
                    <Typography variant="h6" gutterBottom>
                      {result.preset.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {result.preset.description}
                    </Typography>

                    {/* 결과 정보 */}
                    {!result.error && result.imageUrl && (
                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            크기:
                          </Typography>
                          <Typography variant="caption">
                            {result.width} × {result.height}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            파일 크기:
                          </Typography>
                          <Typography variant="caption">{formatFileSize(result.fileSize)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            처리 시간:
                          </Typography>
                          <Typography variant="caption">{result.processingTime}ms</Typography>
                        </Box>
                      </Stack>
                    )}

                    {/* 코드 스니펫 */}
                    {!result.error && result.imageUrl && (
                      <Box sx={{ mb: 2, flexGrow: 1 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '0.85rem' }}>
                          사용법
                        </Typography>
                        <Box
                          sx={{
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            p: 1,
                            maxHeight: 200,
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            lineHeight: 1.4,
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {generateCodeForPreset(result.preset)}
                          </pre>
                        </Box>
                      </Box>
                    )}

                    {/* 다운로드 버튼 */}
                    {!result.error && result.imageUrl && (
                      <Box sx={{ mt: 'auto' }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          startIcon={<Download />}
                          onClick={() => handleDownload(result)}
                        >
                          다운로드
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* 결과 없음 메시지 */}
      {!processing && results.length === 0 && originalImage && (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center" color="text.secondary">
              이미지 처리 결과가 없습니다.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

// removed old export default;
