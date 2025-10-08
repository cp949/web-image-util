'use client';

import { CheckCircle, CompareArrows, Download, Error as ErrorIcon, Pending } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  LinearProgress,
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
import { useCallback, useEffect, useState } from 'react';
import { useBatchProcessing, type BatchItem } from '../../hooks/useBatchProcessing';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { ImageUploader } from '../common/ImageUploader';
import { ErrorDisplay } from '../ui/ErrorDisplay';

/**
 * Preset batch items
 */
const BATCH_PRESETS: Record<string, BatchItem[]> = {
  sizes: [
    {
      id: 'thumbnail',
      label: 'Thumbnail (150x150)',
      options: { width: 150, height: 150, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'small',
      label: 'Small (300x200)',
      options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'medium',
      label: 'Medium (600x400)',
      options: { width: 600, height: 400, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'large',
      label: 'Large (1200x800)',
      options: { width: 1200, height: 800, fit: 'cover', quality: 80, format: 'jpeg' },
    },
  ],
  formats: [
    {
      id: 'jpeg-high',
      label: 'JPEG High Quality (95%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 95, format: 'jpeg' },
    },
    {
      id: 'jpeg-medium',
      label: 'JPEG Medium Quality (80%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'jpeg-low',
      label: 'JPEG Low Quality (60%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 60, format: 'jpeg' },
    },
    {
      id: 'png',
      label: 'PNG',
      options: { width: 800, height: 600, fit: 'cover', quality: 100, format: 'png' },
    },
    {
      id: 'webp',
      label: 'WebP (80%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 80, format: 'webp' },
    },
  ],
  fits: [
    {
      id: 'cover',
      label: 'Cover (Fill completely)',
      options: { width: 400, height: 300, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'contain',
      label: 'Contain (Include all)',
      options: {
        width: 400,
        height: 300,
        fit: 'contain',
        quality: 85,
        format: 'jpeg',
        background: '#f0f0f0',
      },
    },
    {
      id: 'fill',
      label: 'Fill (Stretch to fill)',
      options: { width: 400, height: 300, fit: 'fill', quality: 85, format: 'jpeg' },
    },
    {
      id: 'maxFit',
      label: 'MaxFit (Scale down only)',
      options: { width: 400, height: 300, fit: 'maxFit', quality: 85, format: 'jpeg' },
    },
    {
      id: 'minFit',
      label: 'MinFit (Scale up only)',
      options: { width: 400, height: 300, fit: 'minFit', quality: 85, format: 'jpeg' },
    },
  ],
  qualities: [
    {
      id: 'quality-100',
      label: 'Highest Quality (100%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 100, format: 'jpeg' },
    },
    {
      id: 'quality-90',
      label: 'High Quality (90%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 90, format: 'jpeg' },
    },
    {
      id: 'quality-75',
      label: 'Standard (75%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 75, format: 'jpeg' },
    },
    {
      id: 'quality-60',
      label: 'Low Quality (60%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 60, format: 'jpeg' },
    },
    {
      id: 'quality-40',
      label: 'Lowest Quality (40%)',
      options: { width: 800, height: 600, fit: 'cover', quality: 40, format: 'jpeg' },
    },
  ],
  socialMedia: [
    {
      id: 'instagram-post',
      label: 'Instagram Post (1080x1080)',
      options: { width: 1080, height: 1080, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'instagram-story',
      label: 'Instagram Story (1080x1920)',
      options: { width: 1080, height: 1920, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'twitter-post',
      label: 'Twitter Post (1200x675)',
      options: { width: 1200, height: 675, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'facebook-cover',
      label: 'Facebook Cover (820x312)',
      options: { width: 820, height: 312, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'youtube-thumbnail',
      label: 'YouTube Thumbnail (1280x720)',
      options: { width: 1280, height: 720, fit: 'cover', quality: 90, format: 'jpeg' },
    },
  ],
  responsive: [
    {
      id: 'desktop-hd',
      label: 'Desktop HD (1920x1080)',
      options: { width: 1920, height: 1080, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'laptop',
      label: 'Laptop (1366x768)',
      options: { width: 1366, height: 768, fit: 'cover', quality: 85, format: 'jpeg' },
    },
    {
      id: 'tablet',
      label: 'Tablet (768x1024)',
      options: { width: 768, height: 1024, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'mobile',
      label: 'Mobile (375x667)',
      options: { width: 375, height: 667, fit: 'cover', quality: 80, format: 'jpeg' },
    },
  ],
  backgrounds: [
    {
      id: 'bg-white',
      label: 'Background: White',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#ffffff' },
    },
    {
      id: 'bg-black',
      label: 'Background: Black',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#000000' },
    },
    {
      id: 'bg-gray',
      label: 'Background: Gray',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#808080' },
    },
    {
      id: 'bg-blue',
      label: 'Background: Blue',
      options: { width: 400, height: 300, fit: 'contain', quality: 85, format: 'jpeg', background: '#4A90E2' },
    },
  ],
  thumbnails: [
    {
      id: 'thumb-small',
      label: 'Small Thumbnail (100x100)',
      options: { width: 100, height: 100, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'thumb-medium',
      label: 'Medium Thumbnail (200x200)',
      options: { width: 200, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
    },
    {
      id: 'thumb-large',
      label: 'Large Thumbnail (300x300)',
      options: { width: 300, height: 300, fit: 'cover', quality: 80, format: 'jpeg' },
    },
  ],
};

/**
 * Preset category structure
 */
const PRESET_CATEGORIES = [
  {
    category: 'Thumbnails',
    presets: [{ key: 'thumbnails', label: 'Thumbnail Comparison', count: 3, description: 'Compare various thumbnail sizes' }],
  },
  {
    category: 'Size & Resolution',
    presets: [
      { key: 'sizes', label: 'Size Comparison', count: 4, description: 'Compare various sizes' },
      { key: 'responsive', label: 'Responsive Web', count: 4, description: 'Optimal sizes by device' },
    ],
  },
  {
    category: 'Format & Quality',
    presets: [
      { key: 'formats', label: 'Format Comparison', count: 5, description: 'Compare JPEG, PNG, WebP' },
      { key: 'qualities', label: 'Quality Comparison', count: 5, description: 'Compare file sizes by compression quality' },
    ],
  },
  {
    category: 'Fit Modes',
    presets: [
      { key: 'fits', label: 'Fit Mode Comparison', count: 5, description: 'Compare 5 different fit modes' },
      { key: 'backgrounds', label: 'Background Color Comparison', count: 4, description: 'Contain fit background colors' },
    ],
  },
  {
    category: 'Social Media',
    presets: [
      {
        key: 'socialMedia',
        label: 'Platform Optimization',
        count: 5,
        description: 'Instagram, Twitter, etc.',
      },
    ],
  },
];

/**
 * Batch processing and result comparison demo
 * Phase 4.2: Simultaneous processing with multiple settings and result comparison
 */
export function BatchComparisonDemo() {
  const { originalImage, handleImageSelect } = useImageProcessing();

  const { results, processing, progress, error, successfulResults, failedResults, processBatch, cancel, reset, stats } =
    useBatchProcessing(originalImage, {
      concurrency: 3,
      onProgress: (completed, total) => {
        // For progress display
      },
    });

  const [selectedPreset, setSelectedPreset] = useState<string>('thumbnails');

  /**
   * Process preset
   */
  const handlePresetProcess = useCallback(
    async (presetKey: string) => {
      const items = BATCH_PRESETS[presetKey];
      if (!items) return;

      setSelectedPreset(presetKey);
      await processBatch(items);
    },
    [processBatch]
  );

  // Automatically start batch processing with default preset when image is selected
  useEffect(() => {
    if (originalImage && !processing && selectedPreset) {
      handlePresetProcess(selectedPreset);
    }
  }, [originalImage, selectedPreset, handlePresetProcess]);

  /**
   * Download individual image
   */
  const downloadSingleImage = useCallback(async (result: (typeof results)[number]) => {
    if (!result.result?.src) return;

    try {
      const FileSaver = await import('file-saver');
      const response = await fetch(result.result.src);
      const blob = await response.blob();
      const extension = result.options.format || 'jpg';
      const filename = `${result.id}.${extension}`;

      FileSaver.saveAs(blob, filename);
    } catch (err) {
      console.error('Individual image download failed:', err);
      alert('Image download failed.');
    }
  }, []);

  /**
   * Format file size
   */
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /**
   * Format processing time
   */
  const formatTime = (ms?: number) => {
    if (!ms) return '-';
    return `${ms.toFixed(0)}ms`;
  };

  /**
   * Status icon
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <Pending color="info" />;
      default:
        return <Pending color="disabled" />;
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        <CompareArrows sx={{ mr: 1, verticalAlign: 'middle' }} />
        Batch Processing & Result Comparison
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Process images simultaneously with multiple settings and compare results.
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Controls */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Image uploader */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="basic" />

            {/* Error display */}
            {error && <ErrorDisplay error={error} onClear={reset} />}

            {/* Progress */}
            {processing && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Processing...
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {progress.completed} / {progress.total} completed
                  </Typography>
                  <LinearProgress variant="determinate" value={(progress.completed / progress.total) * 100} />
                  <Button fullWidth variant="outlined" color="error" onClick={cancel} sx={{ mt: 2 }}>
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Statistics
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Total:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {stats.total} items
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="success.main">
                        Completed:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {stats.completed} items
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="error.main">
                        Failed:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="error.main">
                        {stats.failed} items
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="info.main">
                        In Progress:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="info.main">
                        {stats.processing} items
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Button fullWidth variant="outlined" onClick={reset}>
                      Reset
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* Right: Results */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Preset selection */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Select Preset
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {PRESET_CATEGORIES.flatMap((category) =>
                    category.presets.map((preset) => (
                      <Button
                        key={preset.key}
                        size="small"
                        variant={selectedPreset === preset.key ? 'contained' : 'outlined'}
                        onClick={() => setSelectedPreset(preset.key)}
                        disabled={!originalImage || processing}
                        endIcon={<Chip label={preset.count} size="small" />}
                      >
                        {preset.label}
                      </Button>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>

            {results.length === 0 ? (
              <Alert severity="info">
                <Typography variant="body2">Select a preset to start batch processing.</Typography>
              </Alert>
            ) : (
              <>
                {/* Image grid */}
                {successfulResults.length > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Image Preview
                      </Typography>
                      <Grid container spacing={2}>
                        {successfulResults.map((result) => (
                          <Grid key={result.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card variant="outlined">
                              <Box
                                sx={{
                                  position: 'relative',
                                  paddingTop: '75%',
                                  overflow: 'hidden',
                                  backgroundColor: '#f5f5f5',
                                }}
                              >
                                {result.result && result.result.src ? (
                                  <img
                                    src={result.result.src}
                                    alt={result.label}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'contain',
                                    }}
                                    onError={(e) => {
                                      console.error('Image load failed:', result.label, result.result?.src, e);
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      color: '#666',
                                      textAlign: 'center',
                                    }}
                                  >
                                    No Image
                                    <br />
                                    {result.result ? '(no src)' : '(no result)'}
                                  </div>
                                )}
                              </Box>
                              <CardContent>
                                <Typography variant="subtitle2" gutterBottom>
                                  {result.label}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                                  <Chip
                                    label={`${result.result?.width}×${result.result?.height}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={formatFileSize(result.result?.size)}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                  />
                                </Stack>
                                <Button
                                  fullWidth
                                  size="small"
                                  variant="outlined"
                                  startIcon={<Download />}
                                  onClick={() => downloadSingleImage(result)}
                                >
                                  Download
                                </Button>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                {/* Failed results */}
                {failedResults.length > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="error">
                        Failed Processing
                      </Typography>
                      <Stack spacing={1}>
                        {failedResults.map((result) => (
                          <Alert key={result.id} severity="error">
                            <Typography variant="body2">
                              <strong>{result.label}</strong>: {result.error?.message}
                            </Typography>
                          </Alert>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* Results table */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Processing Results
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Status</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell align="right">Size</TableCell>
                            <TableCell align="right">File Size</TableCell>
                            <TableCell align="right">Processing Time</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {results.map((result) => (
                            <TableRow key={result.id}>
                              <TableCell>{getStatusIcon(result.status)}</TableCell>
                              <TableCell>{result.label}</TableCell>
                              <TableCell align="right">
                                {result.result ? `${result.result.width}×${result.result.height}` : '-'}
                              </TableCell>
                              <TableCell align="right">{formatFileSize(result.result?.size)}</TableCell>
                              <TableCell align="right">{formatTime(result.processingTime)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
