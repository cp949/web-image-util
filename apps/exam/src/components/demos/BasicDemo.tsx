'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ImageMetadata } from '../ui/ImageMetadata';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { OutputFormat, ProcessingOptions, ResizeFit } from './types';

export function BasicDemo() {
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

  const [options, setOptions] = useState<ProcessingOptions>({
    width: 300,
    height: 200,
    fit: 'cover',
    quality: 80,
    format: 'jpeg',
    background: '#ffffff',
    withoutEnlargement: false,
  });

  // UI-only state
  const [useWidth, setUseWidth] = useState(true);
  const [useHeight, setUseHeight] = useState(true);
  const [usePadding, setUsePadding] = useState(false);
  const [paddingValue, setPaddingValue] = useState(20);

  // Memoized options for automatic processing
  const processingOptions = useMemo(() => {
    return {
      ...options,
      width: useWidth ? options.width : undefined,
      height: useHeight ? options.height : undefined,
      padding: usePadding ? paddingValue : undefined,
    };
  }, [options, useWidth, useHeight, usePadding, paddingValue]);

  // Latest processed image
  const processedImage = useMemo(() => {
    return processedImages[processedImages.length - 1] || null;
  }, [processedImages]);

  // Automatic processing with useDebounce (prevents flickering)
  const [, cancelDebounce] = useDebounce(
    async () => {
      if (originalImage && processingOptions) {
        await handleProcess(processingOptions);
      }
    },
    500, // 500ms debounce
    [originalImage, processingOptions, handleProcess]
  );

  // Retry
  const handleRetryClick = async () => {
    await retry(processingOptions);
  };

  // Generate code examples
  const generateCodeExamples = () => {
    // Using ResizeConfig API
    const resizeConfig = `{
    fit: '${options.fit}',${useWidth ? `\n    width: ${options.width},` : ''}${useHeight ? `\n    height: ${options.height},` : ''}${options.withoutEnlargement ? '\n    withoutEnlargement: true,' : ''}${usePadding ? `\n    padding: ${paddingValue},` : ''}${options.background !== '#ffffff' ? `\n    background: '${options.background}',` : ''}
  }`;

    const basicCode = `import { processImage } from '@cp949/web-image-util';

// ✅ ResizeConfig API
const result = await processImage(source)
  .resize(${resizeConfig})
  .toBlob('${options.format}');

// Utilize ResultBlob type metadata
console.log('Processing time:', result.processingTime, 'ms');
console.log('Original size:', result.originalSize);
console.log('Result size:', result.width, 'x', result.height);`;

    return [
      {
        title: 'Basic Usage',
        code: basicCode,
        language: 'typescript',
      },
    ];
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Basic Image Processing
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Experience the innovative features of the processImage API. The ResizeConfig API with single resize() call constraint and "calculate ahead, render once" philosophy provides better performance and quality.
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Image uploader and options */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Image uploader */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="basic" />

            {/* Error display */}
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={canRetry ? handleRetryClick : undefined}
                onClear={clearError}
                canRetry={canRetry}
              />
            )}

            {/* Processing status */}
            <ProcessingStatus processing={processing} message="Processing image..." />

            {/* Processing options */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Processing Options
                </Typography>

                {/* Size settings */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Output Size
                  </Typography>

                  {/* Width */}
                  <Box sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={<Checkbox checked={useWidth} onChange={(e) => setUseWidth(e.target.checked)} />}
                      label="Use Width"
                    />
                    {useWidth && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" gutterBottom>
                          Width: {options.width || 300}px
                        </Typography>
                        <Slider
                          value={options.width || 300}
                          onChange={(_, value) => setOptions((prev) => ({ ...prev, width: value as number }))}
                          min={1}
                          max={1600}
                          step={1}
                          marks={[
                            { value: 1, label: '1' },
                            { value: 400, label: '400' },
                            { value: 800, label: '800' },
                            { value: 1200, label: '1200' },
                            { value: 1600, label: '1600' },
                          ]}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* Height */}
                  <Box>
                    <FormControlLabel
                      control={<Checkbox checked={useHeight} onChange={(e) => setUseHeight(e.target.checked)} />}
                      label="Use Height"
                    />
                    {useHeight && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" gutterBottom>
                          Height: {options.height || 200}px
                        </Typography>
                        <Slider
                          value={options.height || 200}
                          onChange={(_, value) => setOptions((prev) => ({ ...prev, height: value as number }))}
                          min={1}
                          max={1600}
                          step={1}
                          marks={[
                            { value: 1, label: '1' },
                            { value: 400, label: '400' },
                            { value: 800, label: '800' },
                            { value: 1200, label: '1200' },
                            { value: 1600, label: '1600' },
                          ]}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Size constraint options */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Size Constraint Options
                  </Typography>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.withoutEnlargement}
                        onChange={(e) => setOptions((prev) => ({ ...prev, withoutEnlargement: e.target.checked }))}
                      />
                    }
                    label="Prevent Enlargement (withoutEnlargement)"
                    sx={{ display: 'block', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, ml: 4 }}>
                    Does not enlarge to a size larger than the original.
                  </Typography>
                </Box>

                {/* Padding options */}
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={<Checkbox checked={usePadding} onChange={(e) => setUsePadding(e.target.checked)} />}
                    label="Add Padding (padding)"
                    sx={{ display: 'block', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, ml: 4 }}>
                    Adds margin around the image.
                  </Typography>

                  {usePadding && (
                    <Box sx={{ ml: 4, mt: 2 }}>
                      <Typography variant="caption" gutterBottom>
                        Padding Size: {paddingValue}px (all sides)
                      </Typography>

                      {/* Preset padding buttons */}
                      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                        {[10, 20, 30, 50].map((preset) => (
                          <Button
                            key={preset}
                            size="small"
                            variant={paddingValue === preset ? 'contained' : 'outlined'}
                            onClick={() => setPaddingValue(preset)}
                            sx={{ minWidth: 50 }}
                          >
                            {preset}
                          </Button>
                        ))}
                      </Stack>

                      <Slider
                        value={paddingValue}
                        onChange={(_, value) => setPaddingValue(value as number)}
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
                </Box>

                {/* Quality slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Quality: {options.quality}%
                  </Typography>
                  <Slider
                    value={options.quality}
                    onChange={(_, value) => setOptions((prev) => ({ ...prev, quality: value as number }))}
                    min={10}
                    max={100}
                    step={5}
                    marks={[
                      { value: 10, label: '10%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' },
                    ]}
                  />
                </Box>

                {/* Background color */}
                <TextField
                  fullWidth
                  label="Background Color (transparent areas)"
                  value={options.background}
                  onChange={(e) => setOptions((prev) => ({ ...prev, background: e.target.value }))}
                  placeholder="#ffffff"
                  sx={{ mb: 3 }}
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right: Top options, image comparison and metadata */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Top: Fit mode and output format options */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {/* Fit mode - RadioGroup */}
                    <FormControl>
                      <FormLabel component="legend">Fit Mode</FormLabel>
                      <RadioGroup
                        value={options.fit}
                        onChange={(e) => setOptions((prev) => ({ ...prev, fit: e.target.value as ResizeFit }))}
                      >
                        <FormControlLabel value="cover" control={<Radio />} label="Cover (fill completely, may crop)" />
                        <FormControlLabel value="contain" control={<Radio />} label="Contain (fit entirely, with padding)" />
                        <FormControlLabel value="fill" control={<Radio />} label="Fill (stretch to fill)" />
                        <FormControlLabel value="maxFit" control={<Radio />} label="MaxFit (shrink only, no enlargement)" />
                        <FormControlLabel value="minFit" control={<Radio />} label="MinFit (enlarge only, no shrinking)" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {/* Output format - RadioGroup */}
                    <FormControl>
                      <FormLabel component="legend">Output Format</FormLabel>
                      <RadioGroup
                        value={options.format}
                        onChange={(e) => setOptions((prev) => ({ ...prev, format: e.target.value as OutputFormat }))}
                      >
                        <FormControlLabel value="jpeg" control={<Radio />} label="JPEG" />
                        <FormControlLabel value="png" control={<Radio />} label="PNG" />
                        <FormControlLabel value="webp" control={<Radio />} label="WebP" />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Before/After viewer */}
            <BeforeAfterView before={originalImage} after={processedImage} />

            {/* Metadata */}
            <ImageMetadata original={originalImage} processed={processedImage} />

            {/* Code snippet */}
            {originalImage && <CodeSnippet title="Code Examples for Current Settings" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
