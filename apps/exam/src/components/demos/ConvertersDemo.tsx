'use client'

import { processImage } from '@cp949/web-image-util';
import { ContentCopy as CopyIcon, Download as DownloadIcon, Info as InfoIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';

interface ConversionResult {
  type: 'blob' | 'dataURL' | 'file';
  data: Blob | string | File;
  size: number;
  format: string;
  processingTime: number;
  metadata?: {
    width?: number;
    height?: number;
    colorDepth?: number;
    compression?: string;
  };
}

export function ConvertersDemo() {
  const [originalImage, setOriginalImage] = useState<any>(null);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [processing, setProcessing] = useState(false);

  const [options, setOptions] = useState({
    format: 'png' as 'jpeg' | 'png' | 'webp' | 'avif',
    quality: 80,
    includeMetadata: true,
  });

  const handleImageSelect = (source: File | string) => {
    setResults([]);

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
          file: source,
        });
      };
      img.src = url;
    }
  };

  const performConversions = async () => {
    if (!originalImage) return;

    setProcessing(true);
    const newResults: ConversionResult[] = [];

    try {
      // processImage를 통해 처리된 결과 가져오기
      const processor = processImage(originalImage.src);

      // toBlob 변환
      const blobStart = Date.now();
      const blobResult = await processor.toBlob({
        format: options.format,
        quality: options.quality / 100,
      });
      newResults.push({
        type: 'blob',
        data: blobResult.blob,
        size: blobResult.blob.size,
        format: options.format,
        processingTime: Date.now() - blobStart,
        metadata: options.includeMetadata
          ? {
              width: blobResult.width,
              height: blobResult.height,
            }
          : undefined,
      });

      // toDataURL 변환
      const dataURLStart = Date.now();
      const dataURLResult = await processor.toDataURL({
        format: options.format,
        quality: options.quality / 100,
      });
      const dataURLSize = new Blob([dataURLResult.dataURL]).size;
      newResults.push({
        type: 'dataURL',
        data: dataURLResult.dataURL,
        size: dataURLSize,
        format: options.format,
        processingTime: Date.now() - dataURLStart,
      });

      // toFile 변환 (원본이 파일인 경우만)
      if (originalImage.file) {
        const fileStart = Date.now();
        const fileResult = await processor.toFile(`converted.${options.format}`, {
          format: options.format,
          quality: options.quality / 100,
        });
        newResults.push({
          type: 'file',
          data: fileResult.file,
          size: fileResult.file.size,
          format: options.format,
          processingTime: Date.now() - fileStart,
        });
      }

      setResults(newResults);
    } catch (error) {
      console.error('Conversion failed:', error);
      console.error('변환 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyDataURL = (dataURL: string) => {
    navigator.clipboard.writeText(dataURL).then(() => {
      console.log('Data URL이 클립보드에 복사되었습니다!');
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const generateCodeExample = () => {
    const code = `import { processImage } from '@cp949/web-image-util';

// 1. Blob으로 변환
const blobResult = await processImage(source).toBlob({
  format: '${options.format}',
  quality: ${options.quality / 100}
});

console.log('Blob 크기:', blobResult.blob.size);
console.log('이미지 크기:', blobResult.width, 'x', blobResult.height);

// 2. Data URL로 변환
const dataURLResult = await processImage(source).toDataURL({
  format: '${options.format}',
  quality: ${options.quality / 100}
});

// HTML에서 사용
const img = document.createElement('img');
img.src = dataURLResult.dataURL;

// 3. File 객체로 변환
const fileResult = await processImage(source).toFile('converted.${options.format}', {
  format: '${options.format}',
  quality: ${options.quality / 100}
});

// FormData에 추가
const formData = new FormData();
formData.append('image', fileResult.file);

// 서버로 업로드
fetch('/api/upload', {
  method: 'POST',
  body: formData
});

// 4. 다운로드 함수
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 사용 예시
downloadBlob(blobResult.blob, 'converted.${options.format}');`;

    return [
      {
        title: '변환 유틸리티 사용법',
        code,
        language: 'typescript',
      },
    ];
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        변환 도구
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        이미지를 다양한 형태로 변환하여 웹 개발에서 활용할 수 있습니다.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <ImageUploader onImageSelect={handleImageSelect} />

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  변환 옵션
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>출력 포맷</InputLabel>
                  <Select
                    value={options.format}
                    label="출력 포맷"
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        format: e.target.value as 'jpeg' | 'png' | 'webp' | 'avif',
                      }))
                    }
                  >
                    <MenuItem value="jpeg">JPEG</MenuItem>
                    <MenuItem value="png">PNG</MenuItem>
                    <MenuItem value="webp">WebP</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="품질 (%)"
                  type="number"
                  value={options.quality}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      quality: parseInt(e.target.value) || 80,
                    }))
                  }
                  inputProps={{ min: 10, max: 100 }}
                  sx={{ mb: 3 }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  onClick={performConversions}
                  disabled={!originalImage || processing}
                  size="large"
                >
                  {processing ? '변환 중...' : '모든 형태로 변환'}
                </Button>
              </CardContent>
            </Card>

            {/* 변환 유형 설명 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  변환 유형
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Chip label="toBlob()" color="primary" size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2">
                      브라우저의 Blob 객체로 변환. 파일 다운로드나 서버 업로드에 사용.
                    </Typography>
                  </Box>
                  <Box>
                    <Chip label="toDataURL()" color="secondary" size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2">
                      Base64 인코딩된 Data URL로 변환. HTML img 태그의 src에 직접 사용.
                    </Typography>
                  </Box>
                  <Box>
                    <Chip label="toFile()" color="success" size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2">File 객체로 변환. FormData와 함께 서버 업로드에 최적화.</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 변환 결과 */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    변환 결과
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>유형</TableCell>
                          <TableCell>크기</TableCell>
                          <TableCell>처리 시간</TableCell>
                          <TableCell>액션</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {results.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip
                                label={result.type}
                                color={
                                  result.type === 'blob'
                                    ? 'primary'
                                    : result.type === 'dataURL'
                                      ? 'secondary'
                                      : 'success'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{formatFileSize(result.size)}</TableCell>
                            <TableCell>{result.processingTime}ms</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                {result.type === 'blob' && (
                                  <Button
                                    size="small"
                                    startIcon={<DownloadIcon />}
                                    onClick={() => downloadBlob(result.data as Blob, `converted.${result.format}`)}
                                  >
                                    다운로드
                                  </Button>
                                )}
                                {result.type === 'dataURL' && (
                                  <Button
                                    size="small"
                                    startIcon={<CopyIcon />}
                                    onClick={() => copyDataURL(result.data as string)}
                                  >
                                    복사
                                  </Button>
                                )}
                                {result.type === 'file' && (
                                  <Button
                                    size="small"
                                    startIcon={<DownloadIcon />}
                                    onClick={() => {
                                      const file = result.data as File;
                                      downloadBlob(file, file.name);
                                    }}
                                  >
                                    다운로드
                                  </Button>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* Data URL 미리보기 */}
            {results.find((r) => r.type === 'dataURL') && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Data URL 미리보기
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 300,
                      border: 1,
                      borderColor: 'grey.300',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      bgcolor: 'grey.50',
                      mb: 2,
                    }}
                  >
                    <img
                      src={results.find((r) => r.type === 'dataURL')?.data as string}
                      alt="Data URL Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Data URL 길이:{' '}
                    {(results.find((r) => r.type === 'dataURL')?.data as string)?.length.toLocaleString()} 문자
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            <CodeSnippet title="변환 도구 코드 예제" examples={generateCodeExample()} />

            {/* 사용 사례 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  사용 사례
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Blob 사용 사례
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • 파일 다운로드
                        <br />
                        • 서버 업로드
                        <br />
                        • 로컬 저장소 저장
                        <br />• Canvas 처리
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Data URL 사용 사례
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • IMG 태그 src
                        <br />
                        • CSS background-image
                        <br />
                        • 이메일 임베드
                        <br />• 미리보기 표시
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        File 사용 사례
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • FormData 업로드
                        <br />
                        • 드래그앤드롭
                        <br />
                        • File Input 대체
                        <br />• 파일 시스템 API
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Alert severity="info">
              <Typography variant="body2">
                <strong>성능 팁:</strong>
                <br />
                • Data URL은 Base64 인코딩으로 인해 원본보다 약 33% 더 큽니다
                <br />
                • 대용량 이미지는 Blob을 사용하는 것이 메모리 효율적입니다
                <br />• File 객체는 FormData 업로드에 최적화되어 있습니다
              </Typography>
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
