'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Button,
  Alert,
  Card,
  CardContent,
  CardMedia,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from '@mui/material';
import { CompareArrows as CompareIcon, CheckCircle, Cancel } from '@mui/icons-material';
import { processImage } from '@cp949/web-image-util';
import type { ResultBlob } from '@cp949/web-image-util';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

type FormatType = 'jpeg' | 'png' | 'webp';

interface FormatResult {
  format: FormatType;
  processingTime: number;
  size: number;
  url: string;
  quality: number;
  supported: boolean;
}

const FORMAT_LABELS: Record<FormatType, string> = {
  jpeg: 'JPEG (Lossy)',
  png: 'PNG (Lossless)',
  webp: 'WebP (Modern)',
};

export function SmartFormatDemo() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [formatResults, setFormatResults] = useState<FormatResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [browserSupport, setBrowserSupport] = useState({
    webp: false,
    avif: false,
  });

  // Detect browser format support
  const checkFormatSupport = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    const avifSupported = canvas.toDataURL('image/avif').startsWith('data:image/avif');

    setBrowserSupport({
      webp: webpSupported,
      avif: avifSupported,
    });
  };

  const handleImageSelect = async (source: File | string) => {
    try {
      if (typeof source === 'string') {
        setSelectedImage(source);
      } else {
        setSelectedImage(URL.createObjectURL(source));
      }
      setError(null);
      setFormatResults([]);
      await checkFormatSupport();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to select image'));
    }
  };

  // Automatically run format comparison when image is selected
  useEffect(() => {
    if (selectedImage && !processing) {
      handleFormatComparison();
    }
  }, [selectedImage]);

  const handleFormatComparison = async () => {
    if (!selectedImage) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    const formats: FormatType[] = ['jpeg', 'png', 'webp'];
    const results: FormatResult[] = [];
    const quality = 0.8; // 80% quality

    try {
      for (let i = 0; i < formats.length; i++) {
        const format = formats[i];
        setProgress(((i + 1) / formats.length) * 100);

        // Check browser support
        const supported =
          format === 'webp' ? browserSupport.webp : true;

        if (!supported) {
          results.push({
            format,
            processingTime: 0,
            size: 0,
            url: '',
            quality,
            supported: false,
          });
          continue;
        }

        const startTime = performance.now();

        const result: ResultBlob = await processImage(selectedImage)
          .resize({ fit: 'cover', width: 800, height: 600 })
          .toBlob({ format, quality });

        results.push({
          format,
          processingTime: performance.now() - startTime,
          size: result.blob.size,
          url: URL.createObjectURL(result.blob),
          quality,
          supported: true,
        });
      }

      setFormatResults(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to compare formats'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const calculateSavings = (baseline: number, current: number): string => {
    if (baseline === 0 || current === 0) return 'N/A';
    const savings = ((baseline - current) / baseline) * 100;
    return savings > 0 ? `-${savings.toFixed(1)}%` : `+${Math.abs(savings).toFixed(1)}%`;
  };

  // Calculate savings based on PNG
  const pngResult = formatResults.find((r) => r.format === 'png');
  const baselineSize = pngResult?.size || 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Smart Format Comparison Demo
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Compare JPEG, PNG, and WebP formats and check browser support.
        Get automatic recommendations for the optimal format.
      </Alert>

      {/* Browser Support Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Browser Format Support
          </Typography>
          <Stack direction="row" spacing={2}>
            <Chip
              icon={<CheckCircle />}
              label="JPEG"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<CheckCircle />}
              label="PNG"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={browserSupport.webp ? <CheckCircle /> : <Cancel />}
              label="WebP"
              color={browserSupport.webp ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              icon={browserSupport.avif ? <CheckCircle /> : <Cancel />}
              label="AVIF"
              color={browserSupport.avif ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ImageUploader
            onImageSelect={handleImageSelect}
            recommendedSamplesFor="smart-format"
          />

          {selectedImage && processing && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Image selected. Automatically starting format comparison.
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {processing && (
            <Box sx={{ mb: 3 }}>
              <ProcessingStatus
                processing={true}
                progress={progress}
                message={`Comparing formats... ${Math.round(progress)}%`}
              />
            </Box>
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                setError(null);
                if (selectedImage) handleFormatComparison();
              }}
            />
          )}

          {formatResults.length > 0 && (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                {formatResults.map((result) => (
                  <Grid key={result.format} size={{ xs: 12, sm: 4 }}>
                    <Card>
                      {result.supported && result.url && (
                        <CardMedia
                          component="img"
                          image={result.url}
                          alt={`${result.format} format`}
                          sx={{
                            height: 150,
                            objectFit: 'contain',
                            bgcolor: 'grey.100',
                          }}
                        />
                      )}
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">
                            {FORMAT_LABELS[result.format]}
                          </Typography>
                          {!result.supported && (
                            <Chip label="Unsupported" color="default" size="small" />
                          )}
                        </Box>
                        {result.supported ? (
                          <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary">
                              Processing Time: {result.processingTime.toFixed(0)}ms
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              File Size: {formatFileSize(result.size)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Quality: {(result.quality * 100).toFixed(0)}%
                            </Typography>
                            {baselineSize > 0 && (
                              <Typography variant="body2" color="primary">
                                vs PNG: {calculateSavings(baselineSize, result.size)}
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not supported in current browser.
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Detailed Comparison Table
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Format</TableCell>
                          <TableCell align="right">Processing Time</TableCell>
                          <TableCell align="right">File Size</TableCell>
                          <TableCell align="right">vs PNG</TableCell>
                          <TableCell align="right">Quality</TableCell>
                          <TableCell align="center">Browser Support</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {formatResults.map((result) => (
                          <TableRow key={result.format}>
                            <TableCell>{FORMAT_LABELS[result.format]}</TableCell>
                            <TableCell align="right">
                              {result.supported ? `${result.processingTime.toFixed(0)}ms` : 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              {formatFileSize(result.size)}
                            </TableCell>
                            <TableCell align="right">
                              {result.supported ? calculateSavings(baselineSize, result.size) : 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              {result.supported ? `${(result.quality * 100).toFixed(0)}%` : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              {result.supported ? (
                                <CheckCircle color="success" />
                              ) : (
                                <Cancel color="disabled" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Recommended Format */}
              {formatResults.length > 0 && (
                <Alert severity="success">
                  <Typography variant="subtitle2" gutterBottom>
                    Recommended Format
                  </Typography>
                  <Typography variant="body2">
                    {browserSupport.webp
                      ? '• WebP: Offers best compression ratio and quality (modern browsers)'
                      : '• JPEG: Lossy compression format suitable for photos'}
                    <br />
                    {baselineSize > 0 && formatResults.find((r) => r.format === 'webp')?.size && (
                      <>
                        • WebP is approximately{' '}
                        {Math.abs(
                          parseFloat(
                            calculateSavings(
                              baselineSize,
                              formatResults.find((r) => r.format === 'webp')?.size || 0
                            )
                          )
                        ).toFixed(0)}
                        % smaller than PNG
                      </>
                    )}
                  </Typography>
                </Alert>
              )}
            </Stack>
          )}

          {!processing && !error && formatResults.length === 0 && !selectedImage && (
            <Alert severity="info">
              Format comparison will start automatically when you select an image.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}