'use client';

import { Photo, PhotoSizeSelectLarge, PhotoSizeSelectSmall } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ImageMetadata } from '../ui/ImageMetadata';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { ProcessingOptions } from './types';

/**
 * One-click preview demo
 * Simple demo component showcasing autoProcess functionality
 */
export function QuickPreviewDemo() {
  // Predefined preset options
  const [selectedPreset, setSelectedPreset] = useState<'thumbnail' | 'medium' | 'large'>('medium');

  // Processing options per preset
  const presets: Record<'thumbnail' | 'medium' | 'large', ProcessingOptions> = {
    thumbnail: {
      fit: 'cover',
      width: 150,
      height: 150,
      quality: 75,
      format: 'jpeg',
    },
    medium: {
      fit: 'cover',
      width: 400,
      height: 300,
      quality: 85,
      format: 'jpeg',
    },
    large: {
      fit: 'contain',
      width: 800,
      height: 600,
      quality: 90,
      format: 'webp',
    },
  };

  // Use hook with autoProcess enabled
  const imageProcessing = useImageProcessing({
    autoProcess: true, // 🎯 Enable one-click automatic processing
    defaultOptions: presets[selectedPreset],
  });

  const {
    originalImage,
    processedImages,
    processing,
    error,
    handleImageSelect,
    handleProcess,
    clearError,
    getErrorMessage,
  } = imageProcessing;

  // Reprocess if image exists when preset changes
  useEffect(() => {
    if (originalImage && !processing) {
      handleProcess(presets[selectedPreset]);
    }
  }, [selectedPreset]); // originalImage and processing intentionally excluded (infinite loop prevention)

  // Latest processed image
  const processedImage = processedImages[processedImages.length - 1] || null;

  // Generate code example
  const generateCodeExample = () => {
    const preset = presets[selectedPreset];
    return `import { useImageProcessing } from '@/hooks/useImageProcessing';

// 🎯 Enable one-click processing with autoProcess option
const {
  handleImageSelect,
  processedImages,
  processing
} = useImageProcessing({
  autoProcess: true,  // ✨ Automatic processing immediately upon image selection
  defaultOptions: {
    fit: '${preset.fit}',
    width: ${preset.width},
    height: ${preset.height},
    quality: ${preset.quality},
    format: '${preset.format}',
  }
});

// Images are automatically processed just by selecting them!
// No need to click a separate "Process" button
<ImageUploader onImageSelect={handleImageSelect} />`;
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        One-Click Preview
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Image uploader and information */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {/* Preset selection UI */}
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Preset Selection
                </Typography>
                <ToggleButtonGroup
                  value={selectedPreset}
                  exclusive
                  onChange={(_, value) => value && setSelectedPreset(value)}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                >
                  <ToggleButton
                    value="thumbnail"
                    component="div"
                    sx={{ display: 'inline-flex', flexDirection: 'column' }}
                  >
                    Thumbnail
                    <Chip label="150×150" size="small" />
                  </ToggleButton>
                  <ToggleButton value="medium" component="div" sx={{ display: 'inline-flex', flexDirection: 'column' }}>
                    Medium
                    <Chip label="400×300" size="small" sx={{ ml: 1 }} />
                  </ToggleButton>
                  <ToggleButton value="large" component="div" sx={{ display: 'inline-flex', flexDirection: 'column' }}>
                    Large
                    <Chip label="800×600" size="small" sx={{ ml: 1 }} />
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Fit: <strong>{presets[selectedPreset].fit}</strong> | Quality:{' '}
                  <strong>{presets[selectedPreset].quality}</strong> | Format:{' '}
                  <strong>{presets[selectedPreset].format.toUpperCase()}</strong>
                </Typography>
              </CardContent>
            </Card>

            {/* Image uploader */}
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="quick-preview" />

            {/* Error display */}
            {error && <ErrorDisplay error={error} onClear={clearError} canRetry={false} />}

            {/* Processing status */}
            <ProcessingStatus processing={processing} message="Automatically processing image..." />

            {/* Processing result metadata */}
            {originalImage && processedImage && <ImageMetadata original={originalImage} processed={processedImage} />}
          </Stack>
        </Grid>

        {/* Right: Comparison view and code examples */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            {/* Before/After comparison */}
            {originalImage && processedImage && (
              <BeforeAfterView
                before={{
                  src: originalImage.src,
                  width: originalImage.width,
                  height: originalImage.height,
                  size: originalImage.size,
                  format: originalImage.format,
                }}
                after={{
                  src: processedImage.src,
                  width: processedImage.width,
                  height: processedImage.height,
                  size: processedImage.size,
                  format: processedImage.format,
                  processingTime: processedImage.processingTime,
                }}
              />
            )}

            {/* Instruction message */}
            {!originalImage && (
              <Card sx={{ bgcolor: 'background.default' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    How to Use
                  </Typography>
                  <Typography variant="body2" paragraph>
                    1. <strong>Select a preset</strong> on the left (Thumbnail/Medium/Large)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    2. Click a sample image or upload a file
                  </Typography>
                  <Typography variant="body2" paragraph>
                    3. Images are <strong>automatically processed immediately</strong> when selected
                  </Typography>
                  <Typography variant="body2">4. Images are automatically reprocessed when you change presets</Typography>
                </CardContent>
              </Card>
            )}

            {/* Code examples */}
            <CodeSnippet
              examples={[
                {
                  title: 'autoProcess Usage',
                  code: generateCodeExample(),
                  language: 'typescript',
                },
              ]}
              title="Code Examples"
            />

            {/* Benefits explanation */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ✨ Benefits of autoProcess
                </Typography>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      1. Immediate Feedback
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      You can see processing results immediately upon image selection, improving user experience.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      2. Simple User Flow
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      No need to click a separate "Process" button, making the UI simpler.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      3. Optimal for Preview Systems
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Useful for cases requiring quick feedback like thumbnail generation and gallery previews.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      4. Customizable
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      You can predefine desired processing settings through defaultOptions.
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="primary">
                      5. Real-time Preset Switching
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Images are automatically reprocessed when presets change, allowing quick comparison of different sizes.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
