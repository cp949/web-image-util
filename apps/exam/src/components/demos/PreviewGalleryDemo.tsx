'use client';

import { processImage, ResizeConfig } from '@cp949/web-image-util';
import { Download, PhotoSizeSelectActual, Storage } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { ImageUploader } from '../common/ImageUploader';

// Processing option preset definitions
interface ProcessPreset {
  id: string;
  category: string;
  name: string;
  description: string;
  options: ResizeConfig & {
    quality: number;
    format: 'jpeg' | 'png' | 'webp';
    blur?: number;
    withoutEnlargement?: boolean;
  };
}

// Preset data definitions
const PROCESSING_PRESETS: ProcessPreset[] = [
  // Fit mode comparison (fixed 300x200)
  {
    id: 'fit-cover',
    category: 'Fit Mode',
    name: 'Cover',
    description: 'Maintain aspect ratio and fill entire area, crop if necessary',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'fit-contain',
    category: 'Fit Mode',
    name: 'Contain',
    description: 'Maintain aspect ratio and fit entire image within area',
    options: { width: 300, height: 200, fit: 'contain', quality: 80, format: 'jpeg' },
  },
  {
    id: 'fit-fill',
    category: 'Fit Mode',
    name: 'Fill',
    description: 'Ignore aspect ratio and fit exactly',
    options: { width: 300, height: 200, fit: 'fill', quality: 80, format: 'jpeg' },
  },
  {
    id: 'fit-maxFit',
    category: 'Fit Mode',
    name: 'MaxFit (Downscale Only)',
    description: 'Only downscale large images, keep small images original',
    options: {
      width: 200,
      height: 150,
      fit: 'maxFit',
      quality: 80,
      format: 'jpeg',
    },
  },
  {
    id: 'fit-minFit',
    category: 'Fit Mode',
    name: 'MinFit (Upscale Only)',
    description: 'Only upscale small images, keep large images original',
    options: { width: 400, height: 300, fit: 'minFit', quality: 80, format: 'jpeg' },
  },

  // MaxFit/MinFit detailed tests
  {
    id: 'maxfit-test-small',
    category: 'MaxFit Test',
    name: 'MaxFit Small Constraint (100x80)',
    description: 'No effect on small images, only downscale large images',
    options: { width: 100, height: 80, fit: 'maxFit', quality: 80, format: 'jpeg' },
  },
  {
    id: 'minfit-test-large',
    category: 'MinFit Test',
    name: 'MinFit Large Constraint (600x400)',
    description: 'No effect on large images, only upscale small images',
    options: { width: 600, height: 400, fit: 'minFit', quality: 80, format: 'jpeg' },
  },

  // Size comparison (Cover fixed)
  {
    id: 'size-thumbnail',
    category: 'Size Comparison',
    name: 'Thumbnail',
    description: '150×100 pixels',
    options: { width: 150, height: 100, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'size-small',
    category: 'Size Comparison',
    name: 'Small',
    description: '300×200 pixels',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'size-medium',
    category: 'Size Comparison',
    name: 'Medium',
    description: '600×400 pixels',
    options: { width: 600, height: 400, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'size-large',
    category: 'Size Comparison',
    name: 'Large',
    description: '900×600 pixels',
    options: { width: 900, height: 600, fit: 'cover', quality: 80, format: 'jpeg' },
  },

  // Quality comparison (300x200, Cover, JPEG)
  {
    id: 'quality-high',
    category: 'Quality Comparison',
    name: 'Highest Quality',
    description: '95% quality',
    options: { width: 300, height: 200, fit: 'cover', quality: 95, format: 'jpeg' },
  },
  {
    id: 'quality-good',
    category: 'Quality Comparison',
    name: 'High Quality',
    description: '85% quality',
    options: { width: 300, height: 200, fit: 'cover', quality: 85, format: 'jpeg' },
  },
  {
    id: 'quality-normal',
    category: 'Quality Comparison',
    name: 'Normal',
    description: '70% quality',
    options: { width: 300, height: 200, fit: 'cover', quality: 70, format: 'jpeg' },
  },
  {
    id: 'quality-low',
    category: 'Quality Comparison',
    name: 'Low Quality',
    description: '50% quality',
    options: { width: 300, height: 200, fit: 'cover', quality: 50, format: 'jpeg' },
  },

  // Format comparison (300x200, Cover, 80% quality)
  {
    id: 'format-jpeg',
    category: 'Format Comparison',
    name: 'JPEG',
    description: 'Lossy compression, suitable for photos',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'format-png',
    category: 'Format Comparison',
    name: 'PNG',
    description: 'Lossless, supports transparency',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'png' },
  },
  {
    id: 'format-webp',
    category: 'Format Comparison',
    name: 'WebP',
    description: 'High-efficiency compression, modern format',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'webp' },
  },

  // Special effects (300x200, Cover)
  {
    id: 'effect-original',
    category: 'Effect Comparison',
    name: 'Original',
    description: 'No effects',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg' },
  },
  {
    id: 'effect-blur-light',
    category: 'Effect Comparison',
    name: 'Light Blur',
    description: '2px blur effect',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg', blur: 2 },
  },
  {
    id: 'effect-blur-strong',
    category: 'Effect Comparison',
    name: 'Strong Blur',
    description: '5px blur effect',
    options: { width: 300, height: 200, fit: 'cover', quality: 80, format: 'jpeg', blur: 5 },
  },
];

// Processing result type
interface ProcessResult {
  preset: ProcessPreset;
  imageUrl: string;
  width: number;
  height: number;
  fileSize: number;
  processingTime: number;
  error?: string;
}

export function PreviewGalleryDemo() {
  const [originalImage, setOriginalImage] = useState<any>(null);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const handleImageSelect = useCallback(async (source: File | string) => {
    setResults([]);
    setProcessedCount(0);

    // Set original image information
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
        });
      };
      img.src = url;
    }

    // Start processing with all presets
    await processAllPresets(source);
  }, []);

  const processAllPresets = async (source: File | string) => {
    setProcessing(true);
    const newResults: ProcessResult[] = [];

    for (let i = 0; i < PROCESSING_PRESETS.length; i++) {
      const preset = PROCESSING_PRESETS[i];

      try {
        const startTime = Date.now();

        // Provide default values for type safety
        const width = preset.options.width || 300;
        const height = preset.options.height || 200;

        const resizeConfig =
          preset.options.fit === 'contain'
            ? {
                fit: 'contain' as const,
                width,
                height,
                ...(preset.options.withoutEnlargement ? { withoutEnlargement: true } : {}),
              }
            : preset.options.fit === 'cover'
              ? {
                  fit: 'cover' as const,
                  width,
                  height,
                }
              : preset.options.fit === 'fill'
                ? {
                    fit: 'fill' as const,
                    width,
                    height,
                  }
                : preset.options.fit === 'maxFit'
                  ? {
                      fit: 'maxFit' as const,
                      width,
                      height,
                    }
                  : {
                      fit: 'minFit' as const,
                      width,
                      height,
                    };


        let processor = processImage(source) //
          .resize(resizeConfig);

        // Apply blur effect
        if (preset.options.blur) {
          processor = processor.blur(preset.options.blur);
        }

        const result = await processor.toBlob({
          format: preset.options.format || 'jpeg',
          quality: (preset.options.quality || 80) / 100,
        });

        const processingTime = Date.now() - startTime;
        const imageUrl = URL.createObjectURL(result.blob);


        newResults.push({
          preset,
          imageUrl,
          width: result.width,
          height: result.height,
          fileSize: result.blob.size,
          processingTime,
        });
      } catch (error) {
        console.error(`Processing failed for preset ${preset.id}:`, error);
        newResults.push({
          preset,
          imageUrl: '',
          width: 0,
          height: 0,
          fileSize: 0,
          processingTime: 0,
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      }

      setProcessedCount(i + 1);
      setResults([...newResults]);
    }

    setProcessing(false);
  };

  const handleDownload = (result: ProcessResult) => {
    if (result.imageUrl) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `${result.preset.name.replace(/\s+/g, '_')}.${result.preset.options.format || 'jpeg'}`;
      link.click();
    }
  };

  // Format file size for readability
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Generate simple chain-style code examples (new ResizeConfig API)
  const generateCodeForPreset = (preset: ProcessPreset): string => {
    const { options } = preset;

    // Preset header
    let code = `// ${preset.name} preset example\n`;
    code += `// ${preset.description}\n\n`;

    // Generate code in chain format
    let chain = 'processImage(source)';

    // Add resize - new ResizeConfig object approach
    if (options.width || options.height) {
      const resizeConfig: string[] = [];

      // fit property (default cover)
      const fit = options.fit || 'cover';
      resizeConfig.push(`fit: '${fit}'`);

      // width/height properties
      if (options.width) {
        resizeConfig.push(`width: ${options.width}`);
      }
      if (options.height) {
        resizeConfig.push(`height: ${options.height}`);
      }

      // withoutEnlargement property (valid only in contain mode)
      if (options.withoutEnlargement && fit === 'contain') {
        resizeConfig.push('withoutEnlargement: true');
      }

      chain += `.resize({ ${resizeConfig.join(', ')} })`;
    }

    // Add blur
    if (options.blur) {
      chain += `.blur(${options.blur})`;
    }

    // Output options
    const outputOptions: string[] = [];
    if (options.format && options.format !== 'jpeg') {
      outputOptions.push(`format: '${options.format}'`);
    }
    if (options.quality && options.quality !== 80) {
      outputOptions.push(`quality: ${options.quality / 100}`);
    }

    // Complete toDataURL chain
    chain += '.toDataURL(';
    if (outputOptions.length > 0) {
      chain += `{ ${outputOptions.join(', ')} }`;
    }
    chain += ')';

    // Format as multiline chain
    const formattedChain = chain
      .replace(/processImage\(source\)/, 'processImage(source)')
      .replace(/\.resize\(([^)]+)\)/, '\n  .resize($1)')
      .replace(/\.blur\(([^)]+)\)/, '\n  .blur($1)')
      .replace(/\.toDataURL\(([^)]*)\)/, '\n  .toDataURL($1)');

    code += `const result = await ${formattedChain};`;

    return code;
  };

  // Group results by category
  const groupedResults = results.reduce(
    (groups, result) => {
      const category = result.preset.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(result);
      return groups;
    },
    {} as Record<string, ProcessResult[]>
  );

  return (
    <Container maxWidth="xl">
      <Typography variant="h3" component="h1" gutterBottom>
        Conversion Preview
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        Compare all processing options at a glance with a single image. View results with various sizes, qualities, formats, and effects applied in real-time.
      </Typography>

      {/* Image Uploader */}
      <Box sx={{ mb: 4, maxWidth: 400 }}>
        <ImageUploader onImageSelect={handleImageSelect} />
      </Box>

      {/* Original Image Information */}
      {originalImage && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Original Image Information
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <PhotoSizeSelectActual color="primary" />
                  <Typography variant="caption" display="block">
                    Size
                  </Typography>
                  <Typography variant="h6">
                    {originalImage.width} × {originalImage.height}
                  </Typography>
                </Box>
              </Grid>
              {originalImage.size && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Storage color="primary" />
                    <Typography variant="caption" display="block">
                      File Size
                    </Typography>
                    <Typography variant="h6">{formatFileSize(originalImage.size)}</Typography>
                  </Box>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" display="block">
                    Format
                  </Typography>
                  <Chip label={originalImage.format?.toUpperCase() || 'Unknown'} color="primary" />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Progress Display */}
      {processing && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Processing... ({processedCount}/{PROCESSING_PRESETS.length})
            </Typography>
            <LinearProgress variant="determinate" value={(processedCount / PROCESSING_PRESETS.length) * 100} />
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {Object.entries(groupedResults).map(([category, categoryResults]) => (
        <Box key={category} sx={{ mb: 6 }}>
          <Typography variant="h5" gutterBottom>
            {category}
          </Typography>
          <Grid container spacing={3}>
            {categoryResults.map((result) => (
              <Grid size={{ xs: 12, lg: 6 }} key={result.preset.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Image or Error Display */}
                    {result.error ? (
                      <Box
                        sx={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                          color: 'error.main',
                        }}
                      >
                        <Typography variant="body2" align="center">
                          Processing Failed
                          <br />
                          {result.error}
                        </Typography>
                      </Box>
                    ) : result.imageUrl ? (
                      <Box sx={{ mb: 2 }}>
                        <img
                          src={result.imageUrl}
                          alt={result.preset.name}
                          style={{
                            width: 'auto',
                            height: 'auto',
                            maxHeight: 200,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: 4,
                            border: '2px dashed #f44336',
                            display: 'block',
                            margin: '0 auto',
                          }}
                        />
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Processing...
                        </Typography>
                      </Box>
                    )}

                    {/* Preset Information */}
                    <Typography variant="h6" gutterBottom>
                      {result.preset.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {result.preset.description}
                    </Typography>

                    {/* Result Information */}
                    {!result.error && result.imageUrl && (
                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            Size:
                          </Typography>
                          <Typography variant="caption">
                            {result.width} × {result.height}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            File Size:
                          </Typography>
                          <Typography variant="caption">{formatFileSize(result.fileSize)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            Processing Time:
                          </Typography>
                          <Typography variant="caption">{result.processingTime}ms</Typography>
                        </Box>
                      </Stack>
                    )}

                    {/* Code Snippet */}
                    {!result.error && result.imageUrl && (
                      <Box sx={{ mb: 2, flexGrow: 1 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '0.85rem' }}>
                          Usage
                        </Typography>
                        <Box
                          sx={{
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            p: 1,
                            maxHeight: 200,
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            lineHeight: 1.4,
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {generateCodeForPreset(result.preset)}
                          </pre>
                        </Box>
                      </Box>
                    )}

                    {/* Download Button */}
                    {!result.error && result.imageUrl && (
                      <Box sx={{ mt: 'auto' }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          startIcon={<Download />}
                          onClick={() => handleDownload(result)}
                        >
                          Download
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* No Results Message */}
      {!processing && results.length === 0 && originalImage && (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center" color="text.secondary">
              No image processing results available.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

// removed old export default;
