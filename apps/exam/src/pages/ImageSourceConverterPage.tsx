'use client'

import {
  Assignment as ConvertIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { saveAs } from 'file-saver';
import { CodeSnippet } from '../components/common/CodeSnippet';
import { ImageSourceConverter } from '../../../../sub/web-image-util/dist/utils';
import { processImage } from '../../../../sub/web-image-util/dist';

interface ConversionResult {
  type: string;
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
  size?: number;
}

interface ConversionOptions {
  toCanvas: boolean;
  toBlob: boolean;
  toDataURL: boolean;
  toElement: boolean;
  toFile: boolean;
  toArrayBuffer: boolean;
  toUint8Array: boolean;
}

export function ImageSourceConverterPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [results, setResults] = useState<ConversionResult[]>([]);

  const [options, setOptions] = useState<ConversionOptions>({
    toCanvas: true,
    toBlob: true,
    toDataURL: true,
    toElement: true,
    toFile: true,
    toArrayBuffer: true,
    toUint8Array: true,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSourceFile(file);

      // 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setSourcePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // 결과 초기화
      setResults([]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
    },
    multiple: false,
  });

  const handleConvert = async () => {
    if (!sourceFile) return;

    setConverting(true);
    setResults([]);

    const conversionTasks = [];

    // 선택된 변환 작업들 준비
    if (options.toCanvas) {
      conversionTasks.push({
        type: 'Canvas',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toCanvas();
        },
      });
    }

    if (options.toBlob) {
      conversionTasks.push({
        type: 'Blob',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toBlob();
        },
      });
    }

    if (options.toDataURL) {
      conversionTasks.push({
        type: 'DataURL',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toDataURL();
        },
      });
    }

    if (options.toElement) {
      conversionTasks.push({
        type: 'Element',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toElement();
        },
      });
    }

    if (options.toFile) {
      conversionTasks.push({
        type: 'File',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toFile({ filename: 'converted-image.png', format: 'image/png' });
        },
      });
    }

    if (options.toArrayBuffer) {
      conversionTasks.push({
        type: 'ArrayBuffer',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toArrayBuffer();
        },
      });
    }

    if (options.toUint8Array) {
      conversionTasks.push({
        type: 'Uint8Array',
        task: async () => {
          const converter = ImageSourceConverter.from(sourceFile);
          return await converter.toUint8Array();
        },
      });
    }

    // 모든 변환 작업 실행
    const newResults: ConversionResult[] = [];

    for (const conversionTask of conversionTasks) {
      const startTime = performance.now();

      try {
        const result = await conversionTask.task();
        const endTime = performance.now();

        let size: number | undefined;
        if (result instanceof Blob || result instanceof File) {
          size = result.size;
        } else if (result instanceof ArrayBuffer) {
          size = result.byteLength;
        } else if (result instanceof Uint8Array) {
          size = result.length;
        } else if (result instanceof HTMLImageElement) {
          // HTMLImageElement의 경우 크기 정보를 가져올 수 없음
          size = undefined;
        } else if (typeof result === 'string') {
          size = new Blob([result]).size;
        }

        newResults.push({
          type: conversionTask.type,
          success: true,
          result,
          processingTime: endTime - startTime,
          size,
        });
      } catch (error) {
        const endTime = performance.now();

        newResults.push({
          type: conversionTask.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: endTime - startTime,
        });
      }

      // 실시간 결과 업데이트
      setResults([...newResults]);
    }

    setConverting(false);
  };

  const handleDownload = async (result: ConversionResult) => {
    if (!result.success || !result.result) return;

    try {
      const fileName = `converted-${result.type.toLowerCase()}-${Date.now()}`;

      if (result.result instanceof Blob || result.result instanceof File) {
        saveAs(result.result, `${fileName}.${result.type.toLowerCase()}`);
      } else if (result.result instanceof ArrayBuffer) {
        const blob = new Blob([result.result]);
        saveAs(blob, `${fileName}.bin`);
      } else if (result.result instanceof Uint8Array) {
        const blob = new Blob([new Uint8Array(result.result)]);
        saveAs(blob, `${fileName}.bin`);
      } else if (result.result instanceof HTMLImageElement) {
        // HTMLImageElement를 라이브러리 API로 변환하여 다운로드
        try {
          const processed = await processImage(result.result).toBlob();
          saveAs(processed.blob, `${fileName}.png`);
        } catch (error) {
          console.error('Failed to convert HTMLImageElement:', error);
        }
      } else if (typeof result.result === 'string') {
        if (result.type === 'DataURL') {
          // DataURL을 이미지로 다운로드
          const link = document.createElement('a');
          link.href = result.result;
          link.download = `${fileName}.png`;
          link.click();
        } else {
          const blob = new Blob([result.result], { type: 'text/plain' });
          saveAs(blob, `${fileName}.txt`);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      console.error('다운로드 중 오류가 발생했습니다.');
    }
  };

  const generateCodeExample = () => {
    const selectedConversions = Object.entries(options)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type.replace('to', ''));

    const code = `import { ImageSourceConverter, from } from '@cp949/web-image-util/utils';

// 기본 사용법 - 클래스 기반 API
const converter = ImageSourceConverter.from(imageSource);

// 체이닝 변환 예제
${selectedConversions
  .map((type) => {
    switch (type) {
      case 'Canvas':
        return `const canvas = await converter.toCanvas();`;
      case 'Blob':
        return `const blob = await converter.toBlob({ format: 'image/png', quality: 0.9 });`;
      case 'DataURL':
        return `const dataURL = await converter.toDataURL({ format: 'image/jpeg', quality: 0.8 });`;
      case 'Element':
        return `const element = await converter.toElement();`;
      case 'File':
        return `const file = await converter.toFile({ filename: 'image.png', format: 'image/png' });`;
      case 'ArrayBuffer':
        return `const arrayBuffer = await converter.toArrayBuffer();`;
      case 'Uint8Array':
        return `const uint8Array = await converter.toUint8Array();`;
      default:
        return `const result = await converter.to${type}();`;
    }
  })
  .join('\n')}

// 빌더 패턴 API - 더 간결한 문법
const canvas = await from(imageSource).to.canvas();
const blob = await from(canvas).to.blob({ format: 'image/webp', quality: 0.9 });
const file = await from(blob).to.file('converted-image.webp', { format: 'image/webp' });

// 연속 변환 예제
const canvas = await converter.toCanvas();
const blob = await ImageSourceConverter.from(canvas).toBlob();
const dataURL = await ImageSourceConverter.from(blob).toDataURL();

// 다양한 입력 소스 타입 지원
const fromFile = ImageSourceConverter.from(file);           // File
const fromBlob = ImageSourceConverter.from(blob);           // Blob
const fromDataURL = ImageSourceConverter.from(dataURL);     // DataURL string
const fromCanvas = ImageSourceConverter.from(canvas);       // HTMLCanvasElement
const fromImage = ImageSourceConverter.from(imageElement);  // HTMLImageElement
const fromArrayBuffer = ImageSourceConverter.from(buffer);  // ArrayBuffer
const fromUint8Array = ImageSourceConverter.from(uint8);    // Uint8Array
const fromSvg = ImageSourceConverter.from(svgString);       // SVG XML string
const fromUrl = ImageSourceConverter.from('image.jpg');     // URL string`;

    return [
      {
        title: 'ImageSourceConverter 사용 예제',
        code,
        language: 'typescript' as const,
      },
    ];
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    return `${Math.round(ms * 100) / 100}ms`;
  };

  const ResultPreview: React.FC<{ result: ConversionResult }> = ({ result }) => {
    if (!result.success || !result.result) return null;

    if (result.type === 'Canvas' && result.result instanceof HTMLCanvasElement) {
      return (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <canvas
            width={Math.min(result.result.width, 200)}
            height={Math.min(result.result.height, 200)}
            style={{ border: '1px solid #ccc', borderRadius: 4 }}
            ref={(canvas) => {
              if (canvas && result.result) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const scale = Math.min(200 / result.result.width, 200 / result.result.height);
                  canvas.width = result.result.width * scale;
                  canvas.height = result.result.height * scale;
                  ctx.drawImage(result.result, 0, 0, canvas.width, canvas.height);
                }
              }
            }}
          />
        </Box>
      );
    }

    if (result.type === 'DataURL' && typeof result.result === 'string') {
      return (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <img
            src={result.result}
            alt="Converted"
            style={{
              maxWidth: 200,
              maxHeight: 200,
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
        </Box>
      );
    }

    return null;
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        ImageSourceConverter 테스트
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        ImageSourceConverter의 모든 변환 기능을 테스트해보세요. 다양한 입력 형태에서 여러 출력 형태로의 변환을
        지원합니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 설정 및 입력 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* 파일 업로드 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  이미지 업로드
                </Typography>

                <Box
                  {...getRootProps()}
                  sx={{
                    border: 2,
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    borderStyle: 'dashed',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isDragActive ? 'primary.50' : 'background.paper',
                    mb: 2,
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="body1" gutterBottom>
                    {isDragActive ? '파일을 여기에 놓으세요' : '이미지를 드래그하거나 클릭하여 선택'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    JPEG, PNG, GIF, BMP, WebP, SVG 지원
                  </Typography>
                </Box>

                {sourcePreview && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      원본 미리보기
                    </Typography>
                    <img
                      src={sourcePreview}
                      alt="Source preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        border: '1px solid #ccc',
                        borderRadius: 4,
                      }}
                    />
                    {sourceFile && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {sourceFile.name} ({formatFileSize(sourceFile.size)})
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* 변환 옵션 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  변환 옵션
                </Typography>

                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toCanvas}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toCanvas: e.target.checked }))}
                      />
                    }
                    label="Canvas (HTMLCanvasElement)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toBlob}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toBlob: e.target.checked }))}
                      />
                    }
                    label="Blob"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toDataURL}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toDataURL: e.target.checked }))}
                      />
                    }
                    label="DataURL (Base64 string)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toElement}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toElement: e.target.checked }))}
                      />
                    }
                    label="Element (HTMLImageElement)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toFile}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toFile: e.target.checked }))}
                      />
                    }
                    label="File"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toArrayBuffer}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toArrayBuffer: e.target.checked }))}
                      />
                    }
                    label="ArrayBuffer"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toUint8Array}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toUint8Array: e.target.checked }))}
                      />
                    }
                    label="Uint8Array"
                  />
                </FormGroup>

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ConvertIcon />}
                  onClick={handleConvert}
                  disabled={!sourceFile || converting || !Object.values(options).some(Boolean)}
                  sx={{ mt: 2 }}
                  size="large"
                >
                  {converting ? '변환 중...' : '변환 시작'}
                </Button>

                {converting && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      변환 진행 중... ({results.length} / {Object.values(options).filter(Boolean).length})
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* 우측: 결과 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 변환 결과 */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    변환 결과
                  </Typography>

                  <Grid container spacing={2}>
                    {results.map((result, index) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                        <Paper
                          sx={{
                            p: 2,
                            border: 1,
                            borderColor: result.success ? 'success.main' : 'error.main',
                            borderRadius: 2,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {result.success ? (
                              <SuccessIcon color="success" sx={{ mr: 1 }} />
                            ) : (
                              <ErrorIcon color="error" sx={{ mr: 1 }} />
                            )}
                            <Typography variant="subtitle1" fontWeight="bold">
                              {result.type}
                            </Typography>
                          </Box>

                          {result.success ? (
                            <>
                              <Typography variant="body2" color="text.secondary">
                                처리 시간: {formatTime(result.processingTime)}
                              </Typography>
                              {result.size && (
                                <Typography variant="body2" color="text.secondary">
                                  크기: {formatFileSize(result.size)}
                                </Typography>
                              )}

                              <ResultPreview result={result} />

                              <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleDownload(result)}
                                sx={{ mt: 2 }}
                                size="small"
                              >
                                다운로드
                              </Button>
                            </>
                          ) : (
                            <>
                              <Typography variant="body2" color="error.main">
                                오류: {result.error}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                처리 시간: {formatTime(result.processingTime)}
                              </Typography>
                            </>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* 성능 통계 */}
            {results.length > 0 && results.some((r) => r.success) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    성능 통계
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        성공한 변환
                      </Typography>
                      <Typography variant="h6">
                        {results.filter((r) => r.success).length} / {results.length}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        평균 처리 시간
                      </Typography>
                      <Typography variant="h6">
                        {formatTime(
                          results.filter((r) => r.success).reduce((sum, r) => sum + r.processingTime, 0) /
                            results.filter((r) => r.success).length || 0
                        )}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        가장 빠른 변환
                      </Typography>
                      <Typography variant="h6">
                        {results.filter((r) => r.success).length > 0
                          ? results
                              .filter((r) => r.success)
                              .reduce((min, r) => (r.processingTime < min.processingTime ? r : min)).type
                          : '-'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        총 출력 크기
                      </Typography>
                      <Typography variant="h6">
                        {formatFileSize(
                          results.filter((r) => r.success && r.size).reduce((sum, r) => sum + (r.size || 0), 0)
                        )}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* 사용 팁 */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>ImageSourceConverter 특징:</strong>
                <br />
                • 타입 안전한 변환: 각 메서드는 정확한 타입을 반환합니다
                <br />
                • 체이닝 가능: 결과를 다른 변환의 입력으로 사용할 수 있습니다
                <br />
                • 다양한 입력 지원: File, Blob, Canvas, Image, DataURL, SVG, URL 모두 지원
                <br />• 성능 최적화: 메타데이터 주입을 통한 최적화된 변환 경로 제공
              </Typography>
            </Alert>

            {/* 코드 예제 */}
            <CodeSnippet title="ImageSourceConverter 사용법" examples={generateCodeExample()} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

export default ImageSourceConverterPage;
