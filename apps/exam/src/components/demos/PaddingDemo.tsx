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
 * Dedicated demo component for padding functionality
 * Demonstrates both numeric and object padding
 * Phase 4.2: Rendering optimization with useDebounce
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

  // Real-time preview feature (disabled to prevent flickering)
  const realtimePreview = useRealtimePreview(originalImage, {
    debounceMs: 300,
    enabled: false, // Disabled to prevent flickering
  });

  // Padding mode (number vs object)
  const [paddingMode, setPaddingMode] = useState<'number' | 'object'>('object');

  // Numeric padding
  const [numberPadding, setNumberPadding] = useState(20);

  // Object padding
  const [objectPadding, setObjectPadding] = useState({
    top: 10,
    right: 20,
    bottom: 30,
    left: 40,
  });

  // Basic processing options
  const [options, setOptions] = useState<ProcessingOptions>({
    width: 400,
    height: 300,
    fit: 'contain',
    quality: 85,
    format: 'png',
    background: '#f0f0f0',
    withoutEnlargement: false,
  });

  // Latest processed image (manual processing results only) - memoized with useMemo
  const processedImage = useMemo(() => {
    return processedImages[processedImages.length - 1] || null; // Remove real-time preview
  }, [processedImages]);

  // 🎯 Stable processing state to prevent ProcessingStatus flickering (manual processing only)
  const [stableProcessing, setStableProcessing] = useState(false);
  useDebounce(
    () => {
      setStableProcessing(processing); // Remove real-time processing state
    },
    100, // 100ms debounce to prevent flickering
    [processing]
  );

  // Prepare processing options (including padding) - memoized with useMemo
  const processingOptions = useMemo((): ProcessingOptions => {
    return {
      ...options,
      padding: paddingMode === 'number' ? numberPadding : objectPadding,
    };
  }, [options, paddingMode, numberPadding, objectPadding]);

  // Debounce option changes with useDebounce (manual processing only)
  useDebounce(
    async () => {
      if (originalImage && processingOptions) {
        // Use manual processing only (disable real-time processing to prevent flickering)
        await handleProcess(processingOptions);
      }
    },
    600, // 600ms debounce (more stable)
    [originalImage, processingOptions, handleProcess]
  );

  // Set size when image is selected
  useEffect(() => {
    if (originalImage) {
      // Update options with actual size of selected image
      setOptions((prev) => ({
        ...prev,
        width: originalImage.width,
        height: originalImage.height,
      }));

      // Processing is automatically handled by useDebounce
    }
  }, [originalImage]);

  // Retry
  const handleRetryClick = useCallback(async () => {
    await retry(processingOptions);
  }, [retry, processingOptions]);

  // Generate code examples
  const generateCodeExamples = useCallback(() => {
    const padding = paddingMode === 'number' ? numberPadding : objectPadding;
    const paddingStr =
      paddingMode === 'number'
        ? padding.toString()
        : `{ top: ${objectPadding.top}, right: ${objectPadding.right}, bottom: ${objectPadding.bottom}, left: ${objectPadding.left} }`;

    const basicCode = `import { processImage } from '@cp949/web-image-util';

// Image processing with padding applied
const result = await processImage(source)
  .resize({
    fit: '${options.fit}',
    width: ${options.width},
    height: ${options.height},
    padding: ${paddingStr},  // 🎯 Padding configuration
    background: '${options.background}',  // Padding area background color
  })
  .toBlob('${options.format}');

// Result image is original image + padding combined size
console.log('Result size:', result.width, 'x', result.height);`;

    const patternCode = `// 🎨 Padding Usage Patterns

// 1️⃣ Numeric padding - same for all directions
const uniform = await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    padding: 20,  // 20px on all sides
    background: '#ffffff',
  })
  .toBlob();

// 2️⃣ Object padding - individual settings per direction
const custom = await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    padding: { top: 10, right: 20, bottom: 30, left: 40, },
    background: '#f0f0f0',
  })
  .toBlob();

// 3️⃣ Partial direction padding (others are 0)
const partial = await processImage(source)
  .resize({
    fit: 'cover',
    width: 400,
    height: 300,
    padding: {
      top: 20,
      bottom: 20,
      // left, right are 0
    },
    background: 'transparent',
  })
  .toBlob('png');  // PNG for transparency support`;

    return [
      {
        title: 'Basic Usage',
        code: basicCode,
        language: 'typescript',
      },
      {
        title: 'Padding Patterns',
        code: patternCode,
        language: 'typescript',
      },
    ];
  }, [paddingMode, numberPadding, objectPadding, options]);

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        <PaddingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Padding Feature
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Add margin (padding) around images to achieve frame effects, secure safe areas, optimize for social media uploads, and more.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          📐 How Padding Works
        </Typography>
        <Typography variant="body2">
          <strong>Result Size = Image Size + Padding</strong>
          <br />
          Example: 300×200 image with 20px padding → Result is 340×240 (left/right +40, top/bottom +40)
        </Typography>
      </Alert>

      <Grid container spacing={4}>
        {/* Left: Image uploader and options */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Image uploader */}
            <ImageUploader
              onImageSelect={(source) => {
                handleImageSelect(source);
              }}
              recommendedSamplesFor="padding"
            />

            {/* Error display (real-time errors removed) */}
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={canRetry ? handleRetryClick : undefined}
                onClear={clearError}
                canRetry={canRetry}
              />
            )}

            {/* Processing status (using flicker-free stable state) */}
            <ProcessingStatus processing={stableProcessing} message="Applying padding..." />

            {/* Padding settings */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Padding Settings
                </Typography>

                {/* Padding mode selection */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Padding Mode
                  </Typography>
                  <ToggleButtonGroup
                    value={paddingMode}
                    exclusive
                    onChange={(_, value) => value && setPaddingMode(value)}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="number">
                      Number
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        (all sides same)
                      </Typography>
                    </ToggleButton>
                    <ToggleButton value="object">
                      Object
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        (per side)
                      </Typography>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Numeric padding UI */}
                {paddingMode === 'number' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Padding Size: {numberPadding}px (all sides)
                    </Typography>

                    {/* Preset padding buttons */}
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

                {/* Object padding UI */}
                {paddingMode === 'object' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Padding Size by Direction
                    </Typography>

                    {/* Object padding presets */}
                    <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 10, right: 10, bottom: 10, left: 10 })}
                      >
                        Uniform (10px all)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 0, right: 8, bottom: 8, left: 0 })}
                      >
                        Shadow (bottom-right)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 20, right: 20, bottom: 40, left: 20 })}
                      >
                        Caption (bottom space)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setObjectPadding({ top: 30, right: 30, bottom: 30, left: 30 })}
                      >
                        Frame (30px all)
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

                {/* Background color */}
                <TextField
                  fullWidth
                  label="Padding Background Color"
                  value={options.background}
                  onChange={(e) => setOptions((prev) => ({ ...prev, background: e.target.value }))}
                  placeholder="#f0f0f0"
                  sx={{ mb: 3 }}
                  helperText="CSS colors (e.g., #ffffff, rgb(255,0,0), transparent)"
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right: Image comparison and metadata */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Processing settings */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Processing Settings
                </Typography>
                <Grid container spacing={3}>
                  {/* Fit mode */}
                  <Grid size={6}>
                    <FormControl>
                      <FormLabel component="legend" sx={{ mb: 1 }}>
                        Fit Mode
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
                          label="Contain (fit entirely) ⭐"
                        />
                        <FormControlLabel value="cover" control={<Radio size="small" />} label="Cover (fill completely)" />
                        <FormControlLabel value="fill" control={<Radio size="small" />} label="Fill (stretch to fill)" />
                        <FormControlLabel value="maxFit" control={<Radio size="small" />} label="MaxFit (shrink only)" />
                        <FormControlLabel value="minFit" control={<Radio size="small" />} label="MinFit (enlarge only)" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>

                  {/* Format selection */}
                  <Grid size={6}>
                    <FormControl>
                      <FormLabel component="legend" sx={{ mb: 1 }}>
                        Output Format
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
                        <FormControlLabel value="png" control={<Radio size="small" />} label="PNG (transparency support) ⭐" />
                        <FormControlLabel value="jpeg" control={<Radio size="small" />} label="JPEG" />
                        <FormControlLabel value="webp" control={<Radio size="small" />} label="WebP" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Before/After viewer (optimized re-rendering with props memoization) */}
            <BeforeAfterView
              before={useMemo(() => originalImage, [originalImage])}
              after={useMemo(() => processedImage, [processedImage])}
            />

            {/* Metadata */}
            <ImageMetadata original={originalImage} processed={processedImage} />

            {/* Size calculation preview (always shown after image selection) */}
            {originalImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AspectRatio sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {processedImage ? 'Size Change Analysis' : 'Expected Size Calculation'}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="subtitle2" color="primary">
                        Original Size
                      </Typography>
                      <Typography variant="body2">
                        {originalImage.width} × {originalImage.height}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="subtitle2" color={processedImage ? 'success.main' : 'warning.main'}>
                        {processedImage ? 'Result Size' : 'Expected Size'} (with padding)
                      </Typography>
                      <Typography variant="body2">
                        {processedImage ? (
                          <>
                            {processedImage.width} × {processedImage.height}
                          </>
                        ) : (
                          <>
                            {(() => {
                              // Calculate expected size
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
                              <strong>Padding {numberPadding}px</strong> applied → width +{numberPadding * 2}px, height +
                              {numberPadding * 2}px
                            </>
                          ) : (
                            <>
                              <strong>Asymmetric padding</strong> applied → width +{objectPadding.left + objectPadding.right}px
                              (L:{objectPadding.left} + R:{objectPadding.right}), height +
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

            {/* Code snippet */}
            {originalImage && <CodeSnippet title="Padding Usage Examples" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
