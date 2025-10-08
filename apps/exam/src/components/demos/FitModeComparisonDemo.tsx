'use client';

import { processImage, type ResizeFit } from '@cp949/web-image-util';
import { Download, ZoomIn } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';
import { ImageUploader } from '../common/ImageUploader';

interface ProcessResult {
  originalUrl: string;
  processedUrl: string;
  processingTime: number;
  fileSize: number;
  dimensions: { width: number; height: number };
  fit: string;
  actualDimensions?: { width: number; height: number };
  scaleFactor: number; // Scale factor compared to original
  originalDimensions?: { width: number; height: number }; // Original SVG dimensions
}

interface ComparisonState {
  results: Record<string, ProcessResult | null>;
  processingProgress: number;
  isProcessing: boolean;
}

export function FitModeComparisonDemo() {
  const [selectedImage, setSelectedImage] = useState<File | string | null>(null);
  const [targetSize, setTargetSize] = useState({ width: 400, height: 300 });
  const [comparisonState, setComparisonState] = useState<ComparisonState>({
    results: {},
    processingProgress: 0,
    isProcessing: false,
  });
  const [error, setError] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpeg'>('png');
  const [showQualityComparison, setShowQualityComparison] = useState(false);

  const fitModes = [
    { key: 'cover', name: 'Cover', color: '#f44336', description: 'Image fills the area completely (may crop)' },
    { key: 'contain', name: 'Contain', color: '#2196f3', description: 'Entire image fits within area (may have padding)' },
    { key: 'fill', name: 'Fill', color: '#ff9800', description: 'Fits area ignoring aspect ratio' },
    { key: 'maxFit', name: 'MaxFit', color: '#4caf50', description: 'Scale down only, no enlargement' },
    { key: 'minFit', name: 'MinFit', color: '#9c27b0', description: 'Scale up only, no reduction' },
  ];

  // Quality comparison sizes (demonstrating SVG resolution independence)
  const qualityTestSizes = [
    { width: 100, height: 75, label: 'Small' },
    { width: 400, height: 300, label: 'Medium' },
    { width: 800, height: 600, label: 'Large' },
    { width: 1200, height: 900, label: 'Extra Large' },
  ];

  // UTF-8 safe SVG Data URL creation function
  const createSvgDataUrl = useCallback((svgString: string) => {
    // Use direct URL encoding instead of Base64 (UTF-8 safe)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  }, []);

  // Function to extract original SVG dimensions
  const extractSvgDimensions = useCallback((svgString: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (!svgElement) return null;

      // Extract from width, height attributes
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr && heightAttr) {
        const width = parseFloat(widthAttr.replace(/[^\d.]/g, ''));
        const height = parseFloat(heightAttr.replace(/[^\d.]/g, ''));
        if (!isNaN(width) && !isNaN(height)) {
          return { width, height };
        }
      }

      // Extract from viewBox
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const values = viewBox.split(/\s+/).map((v) => parseFloat(v));
        if (values.length === 4 && !values.some(isNaN)) {
          return { width: values[2], height: values[3] };
        }
      }

      // Return default values (SVG standard default size)
      return { width: 300, height: 150 };
    } catch (error) {
      return { width: 300, height: 150 };
    }
  }, []);

  // SVG fit mode processing
  const handleSvgProcessing = useCallback(async () => {
    if (!selectedImage || comparisonState.isProcessing) return;

    setComparisonState((prev) => ({ ...prev, isProcessing: true, processingProgress: 0 }));
    setError('');

    try {
      // Prepare SVG source
      let svgSource: string;
      if (typeof selectedImage === 'string') {
        if (selectedImage.endsWith('.svg')) {
          const response = await fetch(selectedImage);
          svgSource = await response.text();
        } else {
          setError('Only SVG files are supported. Please select an SVG sample.');
          return;
        }
      } else {
        if (selectedImage.type === 'image/svg+xml' || selectedImage.name?.endsWith('.svg')) {
          svgSource = await selectedImage.text();
        } else {
          setError('Only SVG files are supported. Please upload an SVG file.');
          return;
        }
      }

      const totalSteps = showQualityComparison ? qualityTestSizes.length * fitModes.length : fitModes.length;
      let currentStep = 0;

      const results: Record<string, ProcessResult> = {};

      // Extract original SVG dimensions
      const originalDimensions = extractSvgDimensions(svgSource) ?? undefined;

      if (showQualityComparison) {
        // Quality comparison mode: process same SVG at various sizes
        for (const size of qualityTestSizes) {
          for (const mode of fitModes) {
            try {
              const startTime = Date.now();
              const processed = await processImage(svgSource)
                .resize({ fit: mode.key as ResizeFit, width: size.width, height: size.height })
                .toBlob({ format: selectedFormat, quality: 0.9 });

              const scaleFactor = Math.max(size.width / 400, size.height / 300); // Compared to reference size

              results[`${size.label}-${mode.key}`] = {
                originalUrl: createSvgDataUrl(svgSource),
                processedUrl: URL.createObjectURL(processed.blob),
                processingTime: Date.now() - startTime,
                fileSize: processed.blob.size,
                dimensions: { width: size.width, height: size.height },
                fit: `${size.label} ${mode.name}`,
                actualDimensions: { width: processed.width, height: processed.height },
                scaleFactor,
                originalDimensions,
              };

              currentStep++;
              setComparisonState((prev) => ({
                ...prev,
                processingProgress: (currentStep / totalSteps) * 100,
                results: { ...prev.results, [`${size.label}-${mode.key}`]: results[`${size.label}-${mode.key}`] },
              }));
            } catch (err) {
              console.error(`Processing error (${size.label} ${mode.name}):`, err);
            }
          }
        }
      } else {
        // Normal mode: compare fit modes at single size
        for (const mode of fitModes) {
          try {
            const startTime = Date.now();
            const processed = await processImage(svgSource)
              .resize({ fit: mode.key as ResizeFit, width: targetSize.width, height: targetSize.height })
              .toBlob({ format: selectedFormat, quality: 0.9 });

            const scaleFactor = Math.max(targetSize.width / 400, targetSize.height / 300); // Compared to reference size

            results[mode.key] = {
              originalUrl: createSvgDataUrl(svgSource),
              processedUrl: URL.createObjectURL(processed.blob),
              processingTime: Date.now() - startTime,
              fileSize: processed.blob.size,
              dimensions: targetSize,
              fit: mode.key,
              actualDimensions: { width: processed.width, height: processed.height },
              scaleFactor,
              originalDimensions,
            };

            currentStep++;
            setComparisonState((prev) => ({
              ...prev,
              processingProgress: (currentStep / totalSteps) * 100,
              results: { ...prev.results, [mode.key]: results[mode.key] },
            }));
          } catch (err) {
            console.error(`Processing error (${mode.name}):`, err);
          }
        }
      }
    } catch (err) {
      setError('An error occurred during image processing: ' + (err instanceof Error ? err.message : err));
    } finally {
      setComparisonState((prev) => ({ ...prev, isProcessing: false }));
    }
  }, [
    selectedImage,
    targetSize,
    selectedFormat,
    fitModes,
    showQualityComparison,
    qualityTestSizes,
    comparisonState.isProcessing,
  ]);

  // Auto re-run with 1-second debounce when target size changes
  useDebounce(
    () => {
      if (selectedImage && !comparisonState.isProcessing && !showQualityComparison) {
        handleSvgProcessing();
      }
    },
    1000, // 1-second debounce
    [targetSize.width, targetSize.height, selectedImage]
  );

  // Target size change handler
  const handleTargetSizeChange = useCallback((dimension: 'width' | 'height', value: number) => {
    setTargetSize((prev) => ({ ...prev, [dimension]: value }));
  }, []);

  // Image selection handler - start processing immediately
  const handleImageSelect = useCallback(
    async (source: File | string) => {
      setError('');
      setSelectedImage(source);
      setComparisonState({
        results: {},
        processingProgress: 0,
        isProcessing: false,
      });

      // Start processing immediately when image is selected
      setTimeout(() => {
        handleSvgProcessing();
      }, 100);
    },
    [handleSvgProcessing]
  );

  // Quality comparison mode toggle
  const handleQualityComparisonToggle = useCallback(
    (checked: boolean) => {
      setShowQualityComparison(checked);
      setComparisonState({
        results: {},
        processingProgress: 0,
        isProcessing: false,
      });

      if (selectedImage && checked) {
        setTimeout(() => {
          handleSvgProcessing();
        }, 100);
      }
    },
    [selectedImage, handleSvgProcessing]
  );

  // Download result
  const handleDownload = useCallback(
    (resultKey: string) => {
      const result = comparisonState.results[resultKey];
      if (!result) return;

      const link = document.createElement('a');
      link.href = result.processedUrl;
      link.download = `svg-${resultKey}-${result.dimensions.width}x${result.dimensions.height}.${selectedFormat}`;
      link.click();
    },
    [comparisonState, selectedFormat]
  );

  const displayResults = showQualityComparison
    ? qualityTestSizes.flatMap((size) =>
        fitModes.map((mode) => ({
          key: `${size.label}-${mode.key}`,
          result: comparisonState.results[`${size.label}-${mode.key}`],
          mode: { ...mode, name: `${size.label} ${mode.name}` },
        }))
      )
    : fitModes.map((mode) => ({
        key: mode.key,
        result: comparisonState.results[mode.key],
        mode,
      }));

  return (
    <Container maxWidth="xl">
      <Typography variant="h3" component="h1" gutterBottom>
        SVG Fit Modes: Vector Processing Without Quality Loss
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        Experience high-quality fit mode processing using SVG's resolution-independent characteristics. Vector quality is
        maintained at any size.
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Settings */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Select SVG Image
                </Typography>
                <ImageUploader
                  onImageSelect={handleImageSelect}
                  supportedFormats={['svg']}
                  sampleSelectorType="svg"
                  recommendedSamplesFor="svg-quality"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Processing Mode
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showQualityComparison}
                      onChange={(e) => handleQualityComparisonToggle(e.target.checked)}
                    />
                  }
                  label="Quality Comparison Mode"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {showQualityComparison ? 'Compare SVG quality at various sizes' : 'Compare fit modes (adjustable size)'}
                </Typography>
              </CardContent>
            </Card>

            {!showQualityComparison && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Target Size Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Automatically reprocessed 1 second after slider changes
                  </Typography>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Width: {targetSize.width}px
                      </Typography>
                      <Slider
                        value={targetSize.width}
                        onChange={(_, value) => handleTargetSizeChange('width', value as number)}
                        min={100}
                        max={1000}
                        step={50}
                        marks={[
                          { value: 100, label: '100px' },
                          { value: 500, label: '500px' },
                          { value: 1000, label: '1000px' },
                        ]}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Height: {targetSize.height}px
                      </Typography>
                      <Slider
                        value={targetSize.height}
                        onChange={(_, value) => handleTargetSizeChange('height', value as number)}
                        min={100}
                        max={800}
                        step={50}
                        marks={[
                          { value: 100, label: '100px' },
                          { value: 400, label: '400px' },
                          { value: 800, label: '800px' },
                        ]}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Output Settings
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Output Format</InputLabel>
                  <Select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value as 'png' | 'jpeg')}>
                    <MenuItem value="png">PNG (Lossless)</MenuItem>
                    <MenuItem value="jpeg">JPEG (Lossy)</MenuItem>
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            {selectedImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Selected SVG
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      File: {typeof selectedImage === 'string' ? selectedImage.split('/').pop() : selectedImage.name}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      ✨ Vector Image (Resolution Independent)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Processed Automatically
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* Right: Results */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Stack spacing={3}>
            {/* Progress */}
            {comparisonState.isProcessing && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Processing SVG... ({comparisonState.processingProgress.toFixed(0)}%)
                  </Typography>
                  <LinearProgress variant="determinate" value={comparisonState.processingProgress} />
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && <Alert severity="error">{error}</Alert>}

            {/* SVG Quality Information */}
            {selectedImage && (
              <Alert severity="info" icon={<ZoomIn />}>
                <Typography variant="subtitle2" gutterBottom>
                  🎯 Advantages of SVG Vector Processing
                </Typography>
                <Typography variant="body2">
                  • Resolution Independent: No pixelation at any size
                  <br />
                  • Sharp Curves: Smooth lines with vector-based rendering<br />
                  • Free Scaling: Infinite zoom without quality degradation
                  <br />• File Efficiency: Small file size even for complex images
                </Typography>
              </Alert>
            )}

            {/* Results by Fit Mode */}
            {Object.keys(comparisonState.results).length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {showQualityComparison
                      ? 'SVG Quality Comparison Results'
                      : `Results by Fit Mode (${targetSize.width}×${targetSize.height})`}
                  </Typography>

                  <Grid container spacing={3}>
                    {displayResults.map(({ key, result, mode }) => {
                      if (!result) return null;

                      return (
                        <Grid size={{ xs: 12, sm: 6, lg: showQualityComparison ? 3 : 4 }} key={key}>
                          <Card variant="outlined" sx={{ border: 2, borderColor: mode.color, height: '100%' }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: mode.color }}>
                                  {mode.name}
                                </Typography>
                                <Chip
                                  label={`${result.scaleFactor.toFixed(1)}x`}
                                  size="small"
                                  color={result.scaleFactor > 1 ? 'success' : 'primary'}
                                  variant="outlined"
                                />
                              </Stack>

                              {!showQualityComparison && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                  {mode.description}
                                </Typography>
                              )}

                              <Box
                                sx={{
                                  border: 1,
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  p: 2,
                                  textAlign: 'center',
                                  bgcolor: 'grey.50',
                                  mb: 2,
                                  height: showQualityComparison ? 120 : 150,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                }}
                              >
                                <img
                                  src={result.processedUrl}
                                  alt={`SVG ${mode.name} Result`}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                  }}
                                />
                              </Box>

                              <Stack spacing={1}>
                                {result.originalDimensions && (
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Original Size:
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {result.originalDimensions.width}×{result.originalDimensions.height}
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption">Target Size:</Typography>
                                  <Typography variant="caption">
                                    {result.dimensions.width}×{result.dimensions.height}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" fontWeight="bold">
                                    Actual Size:
                                  </Typography>
                                  <Typography variant="caption" fontWeight="bold" color="primary.main">
                                    {result.actualDimensions?.width}×{result.actualDimensions?.height}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption">Processing Time:</Typography>
                                  <Typography variant="caption">{result.processingTime}ms</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption">File Size:</Typography>
                                  <Typography variant="caption">{(result.fileSize / 1024).toFixed(1)} KB</Typography>
                                </Box>
                              </Stack>

                              <Button
                                fullWidth
                                variant="outlined"
                                size="small"
                                startIcon={<Download />}
                                onClick={() => handleDownload(key)}
                                sx={{ mt: 2 }}
                              >
                                Download
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
