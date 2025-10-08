'use client';

import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';
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
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
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
import { ProcessingStatus } from '../ui/ProcessingStatus';

type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface TextWatermarkOptions {
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  stroke: boolean;
  strokeColor: string;
  strokeWidth: number;
}

interface ImageWatermarkOptions {
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  rotation: number;
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light';
}

interface ImageData {
  src: string;
  width: number;
  height: number;
  size?: number;
  format?: string;
}

export function AdvancedDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [watermarkImage, setWatermarkImage] = useState<ImageData | null>(null);
  const [processedImage, setProcessedImage] = useState<ImageData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Text watermark options
  const [textOptions, setTextOptions] = useState<TextWatermarkOptions>({
    text: 'Copyright © 2024',
    position: 'bottom-right',
    fontSize: 24,
    color: '#ffffff',
    opacity: 0.8,
    rotation: 0,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    stroke: true,
    strokeColor: '#000000',
    strokeWidth: 2,
  });

  // Image watermark options
  const [imageOptions, setImageOptions] = useState<ImageWatermarkOptions>({
    position: 'bottom-right',
    opacity: 0.7,
    scale: 0.2,
    rotation: 0,
    blendMode: 'normal',
  });

  const positionOptions = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-center', label: 'Top Center' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'center-left', label: 'Center Left' },
    { value: 'center', label: 'Center' },
    { value: 'center-right', label: 'Center Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-center', label: 'Bottom Center' },
    { value: 'bottom-right', label: 'Bottom Right' },
  ];

  const handleImageSelect = (source: File | string) => {
    setProcessedImage(null);

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
  };

  const handleWatermarkImageSelect = (source: File | string) => {
    if (typeof source === 'string') {
      const img = new Image();
      img.onload = () => {
        setWatermarkImage({ src: source, width: img.width, height: img.height });
      };
      img.src = source;
    } else {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => {
        setWatermarkImage({ src: url, width: img.width, height: img.height, size: source.size });
      };
      img.src = url;
    }
  };

  const processTextWatermark = async () => {
    if (!originalImage) return;

    setProcessing(true);
    setError(null);
    try {
      // First convert the base image to Canvas
      const processor = processImage(originalImage.src);
      const canvasResult = await processor.toCanvas();

      // Add text watermark
      const watermarkedCanvas = SimpleWatermark.addText(canvasResult.canvas, {
        text: textOptions.text,
        position: textOptions.position,
        size: textOptions.fontSize,
        opacity: textOptions.opacity,
        style: {
          fontFamily: textOptions.fontFamily,
          color: textOptions.color,
          strokeColor: textOptions.stroke ? textOptions.strokeColor : undefined,
          strokeWidth: textOptions.stroke ? textOptions.strokeWidth : undefined,
          fontWeight: textOptions.fontWeight,
        },
        rotation: textOptions.rotation,
        margin: { x: 5, y: 5 }, // Set small margin
      });

      // Convert result to Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (blob: Blob | null) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create Blob'));
          },
          'image/png',
          0.9
        );
      });

      const url = URL.createObjectURL(blob);
      setProcessedImage({
        src: url,
        width: watermarkedCanvas.width,
        height: watermarkedCanvas.height,
        format: 'png',
      });
    } catch (err) {
      console.error('Error processing text watermark:', err);
      setError(err instanceof Error ? err : new Error('An error occurred while processing text watermark.'));
    } finally {
      setProcessing(false);
    }
  };

  const processImageWatermark = async () => {
    if (!originalImage || !watermarkImage) return;

    setProcessing(true);
    setError(null);
    try {
      // First convert the base image to Canvas
      const processor = processImage(originalImage.src);
      const canvasResult = await processor.toCanvas();

      // Load watermark image
      const watermarkImg = new Image();
      watermarkImg.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        watermarkImg.onload = resolve;
        watermarkImg.onerror = reject;
        watermarkImg.src = watermarkImage.src;
      });

      // Add image watermark
      const watermarkedCanvas = SimpleWatermark.addImage(canvasResult.canvas, {
        image: watermarkImg,
        position: imageOptions.position,
        size: imageOptions.scale,
        opacity: imageOptions.opacity,
        rotation: imageOptions.rotation,
        blendMode: imageOptions.blendMode,
      });

      // Convert result to Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (blob: Blob | null) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create Blob'));
          },
          'image/png',
          0.9
        );
      });

      const url = URL.createObjectURL(blob);
      setProcessedImage({
        src: url,
        width: watermarkedCanvas.width,
        height: watermarkedCanvas.height,
        format: 'png',
      });
    } catch (err) {
      console.error('Error processing image watermark:', err);
      setError(err instanceof Error ? err : new Error('An error occurred while processing image watermark.'));
    } finally {
      setProcessing(false);
    }
  };

  const generateCodeExamples = () => {
    switch (activeTab) {
      case 0: // Text watermark
        return [
          {
            title: 'Text Watermark',
            code: `import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// Basic image processing
const processor = processImage(source);
const canvasResult = await processor.toCanvas();

// Add text watermark
const watermarkedCanvas = SimpleWatermark.addText(canvasResult, {
  text: '${textOptions.text}',
  position: '${textOptions.position}',
  size: ${textOptions.fontSize},
  opacity: ${textOptions.opacity},
  style: {
    color: '${textOptions.color}',
    fontFamily: '${textOptions.fontFamily}',
    fontWeight: '${textOptions.fontWeight}'${
      textOptions.stroke
        ? `,
    strokeColor: '${textOptions.strokeColor}',
    strokeWidth: ${textOptions.strokeWidth}`
        : ''
    }
  },
  rotation: ${textOptions.rotation},
  margin: { x: 5, y: 5 } // Set small margin
});

// Convert to Blob
const blob = await new Promise(resolve => {
  watermarkedCanvas.toBlob(resolve, 'image/png', 0.9);
});`,
            language: 'typescript',
          },
        ];

      case 1: // Image watermark
        return [
          {
            title: 'Image Watermark',
            code: `import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// Basic image processing
const processor = processImage(source);
const canvasResult = await processor.toCanvas();

// Load watermark image
const watermarkImg = new Image();
watermarkImg.src = watermarkImageSrc;
await new Promise(resolve => watermarkImg.onload = resolve);

// Add image watermark
const watermarkedCanvas = SimpleWatermark.addImage(canvasResult, {
  image: watermarkImg,
  position: '${imageOptions.position}',
  size: ${imageOptions.scale},
  opacity: ${imageOptions.opacity},
  rotation: ${imageOptions.rotation},
  blendMode: '${imageOptions.blendMode}'
});

// Convert to Blob
const blob = await new Promise(resolve => {
  watermarkedCanvas.toBlob(resolve, 'image/png', 0.9);
});`,
            language: 'typescript',
          },
        ];

      case 2: // Image composition
        return [
          {
            title: 'Image Composition',
            code: `import { processImage } from '@cp949/web-image-util';
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// Multiple watermark composition example
const processor = processImage(source);
const canvasResult = await processor.resize({ fit: 'cover', width: 800, height: 600 }).toCanvas();

// Add logo
const logoCanvas = SimpleWatermark.addLogo(canvasResult, logoImage, {
  position: 'top-right',
  maxSize: 0.15,
  opacity: 0.8
});

// Add copyright text
const finalCanvas = SimpleWatermark.addCopyright(logoCanvas, '© 2024 Company Name', {
  position: 'bottom-right',
  style: 'light'
});

// Convert to Blob
const blob = await new Promise(resolve => {
  finalCanvas.toBlob(resolve, 'image/png', 0.9);
});`,
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
        Advanced Features
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Experience advanced image processing features including watermark addition, image composition, and multi-layer processing.
      </Typography>

      {/* Error display */}
      {error && <ErrorDisplay error={error} onClear={() => setError(null)} />}

      {/* Processing status */}
      <ProcessingStatus processing={processing} message="Processing watermark..." />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* Main image uploader */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Main Image
                </Typography>
                <ImageUploader onImageSelect={handleImageSelect} recommendedSamplesFor="advanced" />
              </CardContent>
            </Card>

            {/* Feature selection tabs */}
            <Card>
              <CardContent>
                <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="fullWidth" sx={{ mb: 3 }}>
                  <Tab label="Text" />
                  <Tab label="Image" />
                  <Tab label="Composite" />
                </Tabs>

                {/* Text watermark options */}
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Text Watermark
                    </Typography>

                    <TextField
                      fullWidth
                      label="Watermark Text"
                      value={textOptions.text}
                      onChange={(e) =>
                        setTextOptions((prev) => ({
                          ...prev,
                          text: e.target.value,
                        }))
                      }
                      sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Position</InputLabel>
                      <Select
                        value={textOptions.position}
                        label="Position"
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            position: e.target.value as WatermarkPosition,
                          }))
                        }
                      >
                        {positionOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Font Size: {textOptions.fontSize}px
                      </Typography>
                      <Slider
                        value={textOptions.fontSize}
                        onChange={(_, value) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            fontSize: value as number,
                          }))
                        }
                        min={12}
                        max={72}
                        marks={[
                          { value: 12, label: '12px' },
                          { value: 36, label: '36px' },
                          { value: 72, label: '72px' },
                        ]}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Opacity: {Math.round(textOptions.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={textOptions.opacity}
                        onChange={(_, value) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            opacity: value as number,
                          }))
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        marks={[
                          { value: 0, label: '0%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' },
                        ]}
                      />
                    </Box>

                    <TextField
                      fullWidth
                      label="Text Color"
                      type="color"
                      value={textOptions.color}
                      onChange={(e) =>
                        setTextOptions((prev) => ({
                          ...prev,
                          color: e.target.value,
                        }))
                      }
                      sx={{ mb: 2 }}
                      InputProps={{
                        inputProps: {
                          style: { height: 40 },
                        },
                      }}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={textOptions.stroke}
                          onChange={(e) =>
                            setTextOptions((prev) => ({
                              ...prev,
                              stroke: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Use Outline"
                      sx={{ mb: 2 }}
                    />

                    {textOptions.stroke && (
                      <TextField
                        fullWidth
                        label="Outline Color"
                        type="color"
                        value={textOptions.strokeColor}
                        onChange={(e) =>
                          setTextOptions((prev) => ({
                            ...prev,
                            strokeColor: e.target.value,
                          }))
                        }
                        sx={{ mb: 2 }}
                        InputProps={{
                          inputProps: {
                            style: { height: 40 },
                          },
                        }}
                      />
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processTextWatermark}
                      disabled={!originalImage || processing}
                    >
                      {processing ? 'Processing...' : 'Apply Text Watermark'}
                    </Button>
                  </Box>
                )}

                {/* Image watermark options */}
                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Image Watermark
                    </Typography>

                    {/* Watermark image uploader */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Watermark Image
                      </Typography>
                      <ImageUploader onImageSelect={handleWatermarkImageSelect} />
                    </Box>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Position</InputLabel>
                      <Select
                        value={imageOptions.position}
                        label="Position"
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            position: e.target.value as WatermarkPosition,
                          }))
                        }
                      >
                        {positionOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Size: {Math.round(imageOptions.scale * 100)}%
                      </Typography>
                      <Slider
                        value={imageOptions.scale}
                        onChange={(_, value) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            scale: value as number,
                          }))
                        }
                        min={0.1}
                        max={1}
                        step={0.05}
                        marks={[
                          { value: 0.1, label: '10%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' },
                        ]}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Opacity: {Math.round(imageOptions.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={imageOptions.opacity}
                        onChange={(_, value) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            opacity: value as number,
                          }))
                        }
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </Box>

                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>Blend Mode</InputLabel>
                      <Select
                        value={imageOptions.blendMode}
                        label="Blend Mode"
                        onChange={(e) =>
                          setImageOptions((prev) => ({
                            ...prev,
                            blendMode: e.target.value as 'normal' | 'multiply' | 'overlay' | 'soft-light',
                          }))
                        }
                      >
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="multiply">Multiply</MenuItem>
                        <MenuItem value="overlay">Overlay</MenuItem>
                        <MenuItem value="soft-light">Soft Light</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={processImageWatermark}
                      disabled={!originalImage || !watermarkImage || processing}
                    >
                      {processing ? 'Processing...' : 'Apply Image Watermark'}
                    </Button>
                  </Box>
                )}

                {/* Image Composition Options */}
                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Image Composition
                    </Typography>

                    <Stack spacing={1} sx={{ mb: 3 }}>
                      <Chip label="✅ Text Watermark" color="success" />
                      <Chip label="✅ Image Watermark" color="success" />
                      <Chip label="✅ Logo Watermark" color="success" />
                      <Chip label="✅ Copyright Watermark" color="success" />
                      <Chip label="✅ Multiple Watermark Composition" color="success" />
                      <Chip label="🚧 Grid Layout" variant="outlined" />
                      <Chip label="🚧 Collage Generation" variant="outlined" />
                      <Chip label="🚧 Masking" variant="outlined" />
                    </Stack>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      Try the watermark composition features in the Text and Image tabs above. You can apply multiple watermarks sequentially to create complex composition effects.
                    </Alert>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Before/After Viewer */}
            <BeforeAfterView before={originalImage} after={processedImage} />

            {/* Watermark Image Preview (Image Watermark tab only) */}
            {activeTab === 1 && watermarkImage && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Watermark Image
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 200,
                      border: 1,
                      borderColor: 'grey.300',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      bgcolor: 'grey.50',
                    }}
                  >
                    <img
                      src={watermarkImage.src}
                      alt="Watermark"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Code Examples */}
            {originalImage && <CodeSnippet title="Code Examples for Current Settings" examples={generateCodeExamples()} />}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
