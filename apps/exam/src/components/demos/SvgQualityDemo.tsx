'use client';

import type { ResultBlob } from '@cp949/web-image-util';
import { processImage } from '@cp949/web-image-util';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

// Quality level type definition
type QualityLevel = 'standard' | 'high' | 'ultra';

// Quality level labels
const QUALITY_LABELS: Record<QualityLevel, string> = {
  standard: 'Standard Quality',
  high: 'High Quality',
  ultra: 'Ultra Quality',
};

// Quality level rendering sizes (direct rendering, scaleFactor removed)
const QUALITY_SIZES: Record<QualityLevel, { width: number; height: number }> = {
  standard: { width: 400, height: 300 }, // Default size
  high: { width: 800, height: 600 }, // 2x size
  ultra: { width: 1600, height: 1200 }, // 4x size (pixel perfect)
};

interface QualityResult {
  quality: QualityLevel;
  processingTime: number;
  size: number;
  url: string;
  width: number;
  height: number;
}

export function SvgQualityDemo() {
  const [selectedSvg, setSelectedSvg] = useState<string | null>(null);
  const [qualityResults, setQualityResults] = useState<QualityResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const handleImageSelect = async (source: File | string) => {
    try {
      if (typeof source === 'string') {
        if (!source.endsWith('.svg') && !source.includes('svg')) {
          throw new Error('Only SVG files can be selected.');
        }
        setSelectedSvg(source);
      } else {
        if (!source.type.includes('svg')) {
          throw new Error('Only SVG files can be selected.');
        }
        setSelectedSvg(URL.createObjectURL(source));
      }
      setError(null);
      setQualityResults([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to select image'));
    }
  };

  // Automatically run quality comparison when image is selected
  useEffect(() => {
    if (selectedSvg && !processing) {
      handleQualityComparison();
    }
  }, [selectedSvg]);

  const handleQualityComparison = async () => {
    if (!selectedSvg) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    const qualities: QualityLevel[] = ['standard', 'high', 'ultra'];
    const results: QualityResult[] = [];

    try {
      for (let i = 0; i < qualities.length; i++) {
        const quality = qualities[i];
        const { width, height } = QUALITY_SIZES[quality];

        setProgress(((i + 1) / qualities.length) * 100);

        const startTime = performance.now();

        // Direct high-resolution rendering (scaleFactor removed)
        const result: ResultBlob = await processImage(selectedSvg)
          .resize({ fit: 'contain', width, height })
          .toBlob('png');

        results.push({
          quality,
          processingTime: performance.now() - startTime,
          size: result.blob.size,
          url: URL.createObjectURL(result.blob),
          width,
          height,
        });
      }

      setQualityResults(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to compare quality'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        SVG Quality Comparison Demo
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Experience innovative SVG quality processing. "Calculate early, render once" philosophy perfectly preserves vector quality.
      </Alert>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ImageUploader
            onImageSelect={handleImageSelect}
            supportedFormats={['svg']}
            sampleSelectorType="svg"
            recommendedSamplesFor="svg-quality"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {processing && (
            <ProcessingStatus processing={true} message={`Comparing quality... ${Math.round(progress)}%`} />
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                setError(null);
                if (selectedSvg) handleQualityComparison();
              }}
            />
          )}

          {qualityResults.length > 0 && (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                {qualityResults.map((result) => (
                  <Grid key={result.quality} size={{ xs: 12, sm: 6 }}>
                    <Card>
                      <CardMedia
                        component="img"
                        image={result.url}
                        alt={`${result.quality} quality`}
                        sx={{
                          height: 200,
                          objectFit: 'contain',
                          bgcolor: 'grey.100',
                        }}
                      />
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">{QUALITY_LABELS[result.quality]}</Typography>
                          <Chip label={`${result.width}×${result.height}`} color="primary" size="small" />
                        </Box>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            Processing Time: {result.processingTime.toFixed(0)}ms
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            File Size: {formatFileSize(result.size)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Resolution: {result.width}×{result.height}px
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Detailed Comparison
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Quality</TableCell>
                          <TableCell align="right">Resolution</TableCell>
                          <TableCell align="right">Processing Time</TableCell>
                          <TableCell align="right">File Size</TableCell>
                          <TableCell align="right">Efficiency</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {qualityResults.map((result) => (
                          <TableRow key={result.quality}>
                            <TableCell>{QUALITY_LABELS[result.quality]}</TableCell>
                            <TableCell align="right">
                              {result.width}×{result.height}
                            </TableCell>
                            <TableCell align="right">{result.processingTime.toFixed(0)}ms</TableCell>
                            <TableCell align="right">{formatFileSize(result.size)}</TableCell>
                            <TableCell align="right">{(result.size / result.processingTime).toFixed(0)} B/ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              <Alert severity="success">
                <Typography variant="subtitle2" gutterBottom>
                  Quality Improvement Analysis Results
                </Typography>
                <Typography variant="body2">
                  • Ultra quality file size is{' '}
                  {((qualityResults[2]?.size || 0) / (qualityResults[0]?.size || 1)).toFixed(1)}x larger than standard quality
                  <br />• Processing time increases by approximately{' '}
                  {((qualityResults[2]?.processingTime || 0) / (qualityResults[0]?.processingTime || 1)).toFixed(1)}x
                  <br />
                  • ⚡ New direct rendering: Perfect SVG vector quality preservation by removing scaleFactor
                  <br />• 🎯 "Calculate early, render once" philosophy improves both performance and quality
                </Typography>
              </Alert>
            </Stack>
          )}

          {!processing && !error && qualityResults.length === 0 && !selectedSvg && (
            <Alert severity="info">Quality comparison will start automatically when you select an SVG image.</Alert>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
