'use client';

import type { ResultCanvas } from '@cp949/web-image-util';
import { processImage } from '@cp949/web-image-util';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

interface ShortcutResult {
  dataURL: string;
  width: number;
  height: number;
  processingTime: number;
}

interface ShortcutOperation {
  name: string;
  description: string;
  operation: (src: File) => Promise<ResultCanvas>;
  code: string;
}

// Direct Mapping 연산들
const DIRECT_OPERATIONS: ShortcutOperation[] = [
  {
    name: 'coverBox(300, 200)',
    description: '300×200 박스에 꽉 채우기 (일부 잘림)',
    operation: (src: File) => processImage(src).shortcut.coverBox(300, 200).toCanvas(),
    code: `await processImage(file)
  .shortcut.coverBox(300, 200)
  .toBlob();`,
  },
  {
    name: 'containBox(300, 200)',
    description: '300×200 박스 안에 전체 이미지 맞추기',
    operation: (src: File) => processImage(src).shortcut.containBox(300, 200).toCanvas(),
    code: `await processImage(file)
  .shortcut.containBox(300, 200)
  .toBlob();`,
  },
  {
    name: 'exactSize(300, 200)',
    description: '정확히 300×200 크기로 변환',
    operation: (src: File) => processImage(src).shortcut.exactSize(300, 200).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactSize(300, 200)
  .toBlob();`,
  },
  {
    name: 'maxWidth(400)',
    description: '최대 너비 400px 제한',
    operation: (src: File) => processImage(src).shortcut.maxWidth(400).toCanvas(),
    code: `await processImage(file)
  .shortcut.maxWidth(400)
  .toBlob();`,
  },
  {
    name: 'maxHeight(300)',
    description: '최대 높이 300px 제한',
    operation: (src: File) => processImage(src).shortcut.maxHeight(300).toCanvas(),
    code: `await processImage(file)
  .shortcut.maxHeight(300)
  .toBlob();`,
  },
  {
    name: 'minWidth(400)',
    description: '최소 너비 400px 보장',
    operation: (src: File) => processImage(src).shortcut.minWidth(400).toCanvas(),
    code: `await processImage(file)
  .shortcut.minWidth(400)
  .toBlob();`,
  },
];

// Lazy 연산들
const LAZY_OPERATIONS: ShortcutOperation[] = [
  {
    name: 'toScale(1.5)',
    description: '1.5배 균등 확대',
    operation: async (src: File) => processImage(src).shortcut.scale(1.5).toCanvas(),
    code: `await processImage(file)
  .shortcut.scale(1.5)
  .toBlob();`,
  },
  {
    name: 'scale(0.5)',
    description: '0.5배 균등 축소',
    operation: async (src: File) => processImage(src).shortcut.scale(0.5).toCanvas(),
    code: `await processImage(file)
  .shortcut.scale(0.5)
  .toBlob();`,
  },
  {
    name: 'exactWidth(200)',
    description: '너비를 200px로 조정',
    operation: async (src: File) => processImage(src).shortcut.exactWidth(200).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactWidth(200)
  .toBlob();`,
  },
  {
    name: 'exactHeight(200)',
    description: '높이를 200px로 조정',
    operation: async (src: File) => processImage(src).shortcut.exactHeight(200).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactHeight(200)
  .toBlob();`,
  },
  {
    name: 'scaleX(2)',
    description: '가로만 2배 확대',
    operation: async (src: File) => processImage(src).shortcut.scaleX(2).toCanvas(),
    code: `await processImage(file)
  .shortcut.scaleX(2)
  .toBlob();`,
  },
  {
    name: 'scaleY(0.5)',
    description: '세로만 0.5배 축소',
    operation: (src: File) => processImage(src).shortcut.scaleY(0.5).toCanvas(),
    code: `await processImage(file)
  .shortcut.scaleY(0.5)
  .toBlob();`,
  },
];

// 체이닝 예제들
const CHAINING_OPERATIONS: ShortcutOperation[] = [
  {
    name: 'coverBox + blur',
    description: '박스 크기 조정 후 블러 효과',
    operation: (src: File) => processImage(src).shortcut.coverBox(300, 200).blur(3).toCanvas(),
    code: `await processImage(file)
  .shortcut.coverBox(300, 200)
  .blur(3)
  .toBlob();`,
  },
  {
    name: 'toScale + blur',
    description: '스케일 조정 후 블러 효과',
    operation: (src: File) => processImage(src).shortcut.scale(1.5).blur(2).toCanvas(),
    code: `await processImage(file)
  .shortcut.scale(1.5)
  .blur(2)
  .toBlob();`,
  },
  {
    name: 'exactWidth + blur',
    description: '너비 조정 후 블러 효과',
    operation: (src: File) => processImage(src).shortcut.exactWidth(300).blur(2).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactWidth(300)
  .blur(2)
  .toBlob();`,
  },
  {
    name: 'containBox + blur',
    description: '박스 안에 맞추고 블러 효과',
    operation: (src: File) => processImage(src).shortcut.containBox(300, 200).blur(1).toCanvas(),
    code: `await processImage(file)
  .shortcut.containBox(300, 200)
  .blur(1)
  .toBlob();`,
  },
];

// 모든 operation을 합친 배열
const ALL_OPERATIONS: ShortcutOperation[] = [...DIRECT_OPERATIONS, ...LAZY_OPERATIONS, ...CHAINING_OPERATIONS];

export function ShortcutApiDemo() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [results, setResults] = useState<{ [key: string]: ShortcutResult }>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 이미지 선택 핸들러 - 선택 즉시 Shortcut 처리 실행
  const handleImageSelect = async (source: string | File) => {
    setResults({});
    setError(null);

    if (source instanceof File) {
      // File 객체인 경우
      setSelectedImage(source);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const preview = e.target?.result as string;
        setOriginalPreview(preview);

        // 이미지 로드 완료 후 자동으로 Shortcut 처리 실행
        await processAllShortcuts(source);
      };
      reader.readAsDataURL(source);
    } else {
      // string (URL/경로)인 경우 - 샘플 이미지 처리
      try {
        setOriginalPreview(source);

        // URL에서 File 객체 생성
        const response = await fetch(source);
        const blob = await response.blob();

        // 파일명을 URL에서 추출하거나 기본값 사용
        const filename = source.split('/').pop() || 'sample-image';
        const file = new File([blob], filename, { type: blob.type });

        setSelectedImage(file);

        // 샘플 이미지 로드 완료 후 자동으로 Shortcut 처리 실행
        await processAllShortcuts(file);
      } catch (err) {
        console.error('샘플 이미지 로드 실패:', err);
        setError(new Error('샘플 이미지를 로드할 수 없습니다.'));
        setSelectedImage(null);
        setOriginalPreview(null);
      }
    }
  };

  // 모든 카테고리의 연산들 가져오기
  const getAllOperations = () => {
    return ALL_OPERATIONS;
  };

  // 모든 shortcut 처리
  const processAllShortcuts = async (imageFile?: File) => {
    const targetImage = imageFile || selectedImage;
    if (!targetImage) return;

    setProcessing(true);
    setError(null);
    const newResults: { [key: string]: ShortcutResult } = {};

    try {
      const operations = getAllOperations();

      for (const shortcut of operations) {
        const startTime = performance.now();
        const result: ResultCanvas = await shortcut.operation(targetImage);
        const processingTime = performance.now() - startTime;

        // Canvas를 Data URL로 변환
        const dataURL = result.canvas.toDataURL('image/png');
        newResults[shortcut.name] = {
          dataURL,
          width: result.canvas.width,
          height: result.canvas.height,
          processingTime,
        };
      }

      setResults(newResults);
    } catch (err) {
      console.error('Shortcut processing error:', err);
      setError(err instanceof Error ? err : new Error('처리 중 오류가 발생했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" gutterBottom>
          🚀 Shortcut API
        </Typography>

        {/* 이미지 업로더 */}
        <Box sx={{ mb: 3 }}>
          <Container maxWidth="sm">
            <ImageUploader onImageSelect={handleImageSelect} />
          </Container>
        </Box>

        {/* 처리 상태 */}
        <ProcessingStatus processing={processing} />

        {/* 에러 표시 */}
        {error && <ErrorDisplay error={error} onClear={() => setError(null)} />}

        {/* 결과 표시 */}
        {Object.keys(results).length > 0 && (
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {getAllOperations().map((shortcut) => {
              const result = results[shortcut.name];
              if (!result) return null;

              return (
                <Grid key={shortcut.name} size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {shortcut.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {shortcut.description}
                          </Typography>
                        </Box>

                        {/* Before/After 비교 */}
                        {originalPreview && (
                          <BeforeAfterView
                            before={{ src: originalPreview }}
                            after={{
                              src: result.dataURL,
                              width: result.width,
                              height: result.height,
                              processingTime: result.processingTime,
                              format: 'png',
                            }}
                          />
                        )}

                        {/* 처리 정보 */}
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            크기: {result.width} × {result.height}px
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            처리 시간: {result.processingTime.toFixed(2)}ms
                          </Typography>
                        </Box>

                        {/* 코드 예제 */}
                        <CodeSnippet
                          examples={[
                            {
                              title: shortcut.name,
                              code: shortcut.code,
                              language: 'typescript',
                            },
                          ]}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Container>
  );
}
