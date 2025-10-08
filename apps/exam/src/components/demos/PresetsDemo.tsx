'use client';

import type { ImageProcessError } from '@cp949/web-image-util';
import { createAvatar, createSocialImage, createThumbnail } from '@cp949/web-image-util/presets';
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
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ImageMetadata } from '../ui/ImageMetadata';
import { ProcessingStatus } from '../ui/ProcessingStatus';
import type { ImageInfo, ProcessedImageInfo } from './types';

const SOCIAL_PLATFORMS = {
  twitter: { width: 1200, height: 675, label: 'Twitter (16:9)' },
  facebook: { width: 1200, height: 630, label: 'Facebook (1.91:1)' },
  instagram: { width: 1080, height: 1080, label: 'Instagram (1:1)' },
  linkedin: { width: 1200, height: 627, label: 'LinkedIn (1.91:1)' },
  youtube: { width: 1280, height: 720, label: 'YouTube (16:9)' },
  pinterest: { width: 1000, height: 1500, label: 'Pinterest (2:3)' },
} as const;

export function PresetsDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [originalImage, setOriginalImage] = useState<ImageInfo | null>(null);
  const [processedImages, setProcessedImages] = useState<ProcessedImageInfo[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<ImageProcessError | Error | null>(null);

  // Thumbnail options
  const [thumbnailOptions, setThumbnailOptions] = useState({
    size: 150,
    format: 'jpeg' as 'jpeg' | 'png' | 'webp',
    quality: 0.8,
    fit: 'cover' as 'cover' | 'contain',
  });

  // Avatar options
  const [avatarOptions, setAvatarOptions] = useState({
    size: 128,
    format: 'png' as 'png' | 'webp',
    circle: false,
  });

  // Social image options
  const [socialOptions, setSocialOptions] = useState({
    platform: 'instagram' as keyof typeof SOCIAL_PLATFORMS,
    background: '#ffffff',
    format: 'jpeg' as 'jpeg' | 'png' | 'webp',
    quality: 0.85,
  });

  const handleImageSelect = (source: File | string) => {
    setProcessedImages([]);
    setError(null);

    if (typeof source === 'string') {
      const img = new Image();
      img.onload = () => {
        setOriginalImage({
          src: source,
          width: img.width,
          height: img.height,
          format: source.split('.').pop()?.toLowerCase(),
          name: source.split('/').pop(),
        });
      };
      img.onerror = () => {
        setError(new Error('Unable to load image.'));
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
          name: source.name,
        });
      };
      img.onerror = () => {
        setError(new Error('Unable to load image.'));
      };
      img.src = url;
    }
  };

  const processThumbnail = async () => {
    if (!originalImage) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createThumbnail(originalImage.src, thumbnailOptions);

      const url = URL.createObjectURL(result.blob);

      const processedInfo: ProcessedImageInfo = {
        src: url,
        width: result.width,
        height: result.height,
        size: result.blob.size,
        format: thumbnailOptions.format,
        processingTime: result.processingTime,
        originalSize: result.originalSize,
        compressionRatio: originalImage.size ? result.blob.size / originalImage.size : undefined,
      };

      setProcessedImages([processedInfo]);
    } catch (err) {
      console.error('Thumbnail creation failed:', err);
      setError(err instanceof Error ? err : new Error('Error occurred while creating thumbnail.'));
    } finally {
      setProcessing(false);
    }
  };

  const processAvatar = async () => {
    if (!originalImage) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createAvatar(originalImage.src, avatarOptions);

      const url = URL.createObjectURL(result.blob);

      const processedInfo: ProcessedImageInfo = {
        src: url,
        width: result.width,
        height: result.height,
        size: result.blob.size,
        format: avatarOptions.format,
        processingTime: result.processingTime,
        originalSize: result.originalSize,
        compressionRatio: originalImage.size ? result.blob.size / originalImage.size : undefined,
      };

      setProcessedImages([processedInfo]);
    } catch (err) {
      console.error('Avatar creation failed:', err);
      setError(err instanceof Error ? err : new Error('Error occurred while creating avatar.'));
    } finally {
      setProcessing(false);
    }
  };

  const processSocialImage = async () => {
    if (!originalImage) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createSocialImage(originalImage.src, socialOptions);

      const url = URL.createObjectURL(result.blob);

      const processedInfo: ProcessedImageInfo = {
        src: url,
        width: result.width,
        height: result.height,
        size: result.blob.size,
        format: socialOptions.format,
        processingTime: result.processingTime,
        originalSize: result.originalSize,
        compressionRatio: originalImage.size ? result.blob.size / originalImage.size : undefined,
      };

      setProcessedImages([processedInfo]);
    } catch (err) {
      console.error('Social image creation failed:', err);
      setError(err instanceof Error ? err : new Error('Error occurred while creating social image.'));
    } finally {
      setProcessing(false);
    }
  };

  // Batch processing (generate multiple sizes simultaneously)
  const processBatch = async () => {
    if (!originalImage) return;

    setProcessing(true);
    setError(null);

    try {
      const sizes = [64, 128, 256, 512];
      const results = await Promise.all(
        sizes.map((size) =>
          createThumbnail(originalImage.src, {
            size,
            format: 'png',
            quality: 0.9,
          })
        )
      );

      const processedBatch: ProcessedImageInfo[] = results.map((result) => ({
        src: URL.createObjectURL(result.blob),
        width: result.width,
        height: result.height,
        size: result.blob.size,
        format: 'png' as const,
        processingTime: result.processingTime,
        originalSize: result.originalSize,
        compressionRatio: originalImage.size ? result.blob.size / originalImage.size : undefined,
      }));

      setProcessedImages(processedBatch);
    } catch (err) {
      console.error('Batch processing failed:', err);
      setError(err instanceof Error ? err : new Error('Error occurred during batch processing.'));
    } finally {
      setProcessing(false);
    }
  };

  const generateCodeExamples = () => {
    switch (activeTab) {
      case 0: // Thumbnail
        return [
          {
            title: 'Thumbnail Generation',
            code: `import { createThumbnail } from '@cp949/web-image-util/presets';

// Basic thumbnail (150px square)
const thumbnail = await createThumbnail(source, {
  size: ${thumbnailOptions.size}
});

// Advanced options
const thumbnail = await createThumbnail(source, {
  size: ${thumbnailOptions.size},
  format: '${thumbnailOptions.format}',
  quality: ${thumbnailOptions.quality},
  fit: '${thumbnailOptions.fit}'
});`,
            language: 'typescript',
          },
        ];

      case 1: // Avatar
        return [
          {
            title: 'Avatar Generation',
            code: `import { createAvatar } from '@cp949/web-image-util/presets';

// Basic avatar (64px)
const avatar = await createAvatar(source);

// Custom size
const avatar = await createAvatar(source, {
  size: ${avatarOptions.size},
  format: '${avatarOptions.format}'
});`,
            language: 'typescript',
          },
        ];

      case 2: // Social image
        return [
          {
            title: 'Social Image Generation',
            code: `import { createSocialImage } from '@cp949/web-image-util/presets';

// Automatically apply platform-specific recommended sizes
const socialImage = await createSocialImage(source, {
  platform: '${socialOptions.platform}'
});

// Custom settings
const socialImage = await createSocialImage(source, {
  platform: '${socialOptions.platform}',
  background: '${socialOptions.background}',
  format: '${socialOptions.format}',
  quality: ${socialOptions.quality}
});`,
            language: 'typescript',
          },
        ];

      case 3: // Batch processing
        return [
          {
            title: 'Batch Processing',
            code: `import { createThumbnail, createSocialImage } from '@cp949/web-image-util/presets';

// Generate multiple sizes simultaneously
const [small, medium, large, xlarge] = await Promise.all([
  createThumbnail(source, { size: 64 }),
  createThumbnail(source, { size: 128 }),
  createThumbnail(source, { size: 256 }),
  createThumbnail(source, { size: 512 })
]);

// Batch generation of social images by platform
const socialImages = await Promise.all([
  createSocialImage(source, { platform: 'instagram' }),
  createSocialImage(source, { platform: 'twitter' }),
  createSocialImage(source, { platform: 'facebook' })
]);`,
            language: 'typescript',
          },
        ];

      default:
        return [];
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Preset Functions
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Convenience functions that allow you to handle commonly used patterns with simple function calls.
      </Typography>

      {/* Error display */}
      {error && <ErrorDisplay error={error} onClear={() => setError(null)} />}

      {/* Processing status */}
      <ProcessingStatus processing={processing} message="Processing presets..." />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="presets" />

            <Card>
              <CardContent>
                <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="fullWidth" sx={{ mb: 3 }}>
                  <Tab label="Thumbnail" />
                  <Tab label="Avatar" />
                  <Tab label="Social" />
                  <Tab label="Batch" />
                </Tabs>

                {/* Thumbnail options */}
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Thumbnail Settings
                    </Typography>

                    <TextField
                      fullWidth
                      label="Size (px)"
                      type="number"
                      value={thumbnailOptions.size}
                      onChange={(e) =>
                        setThumbnailOptions((prev) => ({
                          ...prev,
                          size: parseInt(e.target.value) || 150,
                        }))
                      }
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Format</InputLabel>
                      <Select
                        value={thumbnailOptions.format}
                        label="Format"
                        onChange={(e) =>
                          setThumbnailOptions((prev) => ({
                            ...prev,
                            format: e.target.value as 'jpeg' | 'png' | 'webp',
                          }))
                        }
                      >
                        <MenuItem value="jpeg">JPEG</MenuItem>
                        <MenuItem value="png">PNG</MenuItem>
                        <MenuItem value="webp">WebP</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>Fit Mode</InputLabel>
                      <Select
                        value={thumbnailOptions.fit}
                        label="Fit Mode"
                        onChange={(e) =>
                          setThumbnailOptions((prev) => ({
                            ...prev,
                            fit: e.target.value as 'cover' | 'contain',
                          }))
                        }
                      >
                        <MenuItem value="cover">Cover</MenuItem>
                        <MenuItem value="contain">Contain</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processThumbnail}
                      disabled={!originalImage || processing}
                    >
                      {processing ? 'Generating...' : 'Generate Thumbnail'}
                    </Button>
                  </Box>
                )}

                {/* Avatar options */}
                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Avatar Settings
                    </Typography>

                    <TextField
                      fullWidth
                      label="Size (px)"
                      type="number"
                      value={avatarOptions.size}
                      onChange={(e) =>
                        setAvatarOptions((prev) => ({
                          ...prev,
                          size: parseInt(e.target.value) || 128,
                        }))
                      }
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>Format</InputLabel>
                      <Select
                        value={avatarOptions.format}
                        label="Format"
                        onChange={(e) =>
                          setAvatarOptions((prev) => ({
                            ...prev,
                            format: e.target.value as 'png' | 'webp',
                          }))
                        }
                      >
                        <MenuItem value="jpeg">JPEG</MenuItem>
                        <MenuItem value="png">PNG (Transparency Support)</MenuItem>
                        <MenuItem value="webp">WebP</MenuItem>
                      </Select>
                    </FormControl>

                    <Alert severity="success" sx={{ mb: 2 }}>
                      ✅ Square avatar generation is implemented!
                    </Alert>

                    <Alert severity="info" sx={{ mb: 3 }}>
                      🚧 Circular masking feature will be added in the future.
                    </Alert>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processAvatar}
                      disabled={!originalImage || processing}
                    >
                      {processing ? 'Generating...' : 'Generate Avatar'}
                    </Button>
                  </Box>
                )}

                {/* Social image options */}
                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Social Image Settings
                    </Typography>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Platform</InputLabel>
                      <Select
                        value={socialOptions.platform}
                        label="Platform"
                        onChange={(e) =>
                          setSocialOptions((prev) => ({
                            ...prev,
                            platform: e.target.value as keyof typeof SOCIAL_PLATFORMS,
                          }))
                        }
                      >
                        {Object.entries(SOCIAL_PLATFORMS).map(([key, { label }]) => (
                          <MenuItem key={key} value={key}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Platform information display */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Recommended Size: {SOCIAL_PLATFORMS[socialOptions.platform].width}×
                        {SOCIAL_PLATFORMS[socialOptions.platform].height}
                      </Typography>
                    </Box>

                    <TextField
                      fullWidth
                      label="Background Color"
                      value={socialOptions.background}
                      onChange={(e) =>
                        setSocialOptions((prev) => ({
                          ...prev,
                          background: e.target.value,
                        }))
                      }
                      sx={{ mb: 3 }}
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processSocialImage}
                      disabled={!originalImage || processing}
                    >
                      {processing ? 'Generating...' : 'Generate Social Image'}
                    </Button>
                  </Box>
                )}

                {/* Batch processing options */}
                {activeTab === 3 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Batch Processing
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Generate multiple thumbnail sizes at once.
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Sizes to be generated:
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip label="64×64" size="small" />
                        <Chip label="128×128" size="small" />
                        <Chip label="256×256" size="small" />
                        <Chip label="512×512" size="small" />
                      </Stack>
                    </Box>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processBatch}
                      disabled={!originalImage || processing}
                    >
                      {processing ? 'Generating...' : 'Start Batch Processing'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Metadata display */}
            {processedImages.length === 1 && <ImageMetadata original={originalImage} processed={processedImages[0]} />}

            {/* Results display */}
            {processedImages.length === 1 ? (
              <BeforeAfterView before={originalImage} after={processedImages[0]} />
            ) : processedImages.length > 1 ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Batch Processing Results
                  </Typography>
                  <Grid container spacing={2}>
                    {processedImages.map((image, index) => (
                      <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Box
                            sx={{
                              width: '100%',
                              height: 150,
                              border: 1,
                              borderColor: 'grey.300',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              mb: 1,
                              bgcolor: 'grey.50',
                            }}
                          >
                            <img
                              src={image.src}
                              alt={`Processed ${index + 1}`}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" display="block">
                            {image.width}×{image.height}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {image.size ? `${Math.round(image.size / 1024)}KB` : 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      height: 400,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 1,
                      borderColor: 'grey.300',
                      borderStyle: 'dashed',
                      borderRadius: 1,
                      bgcolor: 'grey.50',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Select an image and try the preset functions
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Code examples */}
            {originalImage && <CodeSnippet title="Code Example for Current Settings" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
