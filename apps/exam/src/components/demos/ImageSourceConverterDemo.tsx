'use client';

import { processImage } from '@cp949/web-image-util';
import {
  Download as DownloadIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { saveAs } from 'file-saver';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CodeSnippet } from '../common/CodeSnippet';
import { SampleImageSelector } from '../common/SampleImageSelector';

interface ConversionResult {
  type: string;
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
  size?: number;
}

interface ConversionOptions {
  toCanvas: boolean;
  toBlob: boolean;
  toDataURL: boolean;
  toElement: boolean;
  toFile: boolean;
  toArrayBuffer: boolean;
  toUint8Array: boolean;
}

export function ImageSourceConverterDemo() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [results, setResults] = useState<ConversionResult[]>([]);

  const [options, setOptions] = useState<ConversionOptions>({
    toCanvas: true,
    toBlob: true,
    toDataURL: true,
    toElement: true,
    toFile: true,
    toArrayBuffer: true,
    toUint8Array: true,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSourceFile(file);

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSourcePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Initialize results
      setResults([]);
    }
  }, []);

  // Sample image selection handler
  const handleSampleImageSelect = useCallback(async (imagePath: string) => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], imagePath.split('/').pop() || 'sample.jpg', { type: blob.type });

      setSourceFile(file);
      setSourcePreview(imagePath);
      setResults([]);
    } catch (error) {
      console.error('Sample image load failed:', error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
    },
    multiple: false,
  });

  const handleConvert = async () => {
    if (!sourceFile) return;

    setConverting(true);
    setResults([]);

    const conversionTasks = [];

    // Prepare selected conversion tasks
    if (options.toCanvas) {
      conversionTasks.push({
        type: 'Canvas',
        task: async () => {
          return await processImage(sourceFile).toCanvas();
        },
      });
    }

    if (options.toBlob) {
      conversionTasks.push({
        type: 'Blob',
        task: async () => {
          return await processImage(sourceFile).toBlob();
        },
      });
    }

    if (options.toDataURL) {
      conversionTasks.push({
        type: 'DataURL',
        task: async () => {
          return await processImage(sourceFile).toDataURL();
        },
      });
    }

    if (options.toElement) {
      conversionTasks.push({
        type: 'Element',
        task: async () => {
          // Create HTMLImageElement (using Result object's toElement() method)
          const result = await processImage(sourceFile).toDataURL();
          const img = new Image();
          img.src = result.dataURL;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          return img;
        },
      });
    }

    if (options.toFile) {
      conversionTasks.push({
        type: 'File',
        task: async () => {
          return await processImage(sourceFile).toFile('converted-image.png');
        },
      });
    }

    if (options.toArrayBuffer) {
      conversionTasks.push({
        type: 'ArrayBuffer',
        task: async () => {
          // ArrayBuffer conversion (using ResultBlob's toArrayBuffer() method)
          const result = await processImage(sourceFile).toBlob();
          return await result.toArrayBuffer();
        },
      });
    }

    if (options.toUint8Array) {
      conversionTasks.push({
        type: 'Uint8Array',
        task: async () => {
          // Uint8Array conversion (using ResultBlob's toUint8Array() method)
          const result = await processImage(sourceFile).toBlob();
          return await result.toUint8Array();
        },
      });
    }

    // Execute all conversion tasks
    const newResults: ConversionResult[] = [];

    for (const conversionTask of conversionTasks) {
      const startTime = performance.now();

      try {
        const result = await conversionTask.task();
        const endTime = performance.now();

        let size: number | undefined;
        if (result instanceof Blob || result instanceof File) {
          size = result.size;
        } else if (result instanceof ArrayBuffer) {
          size = result.byteLength;
        } else if (result instanceof Uint8Array) {
          size = result.length;
        } else if (result instanceof HTMLImageElement) {
          // Cannot get size information for HTMLImageElement
          size = undefined;
        } else if (typeof result === 'string') {
          size = new Blob([result]).size;
        }

        newResults.push({
          type: conversionTask.type,
          success: true,
          result,
          processingTime: endTime - startTime,
          size,
        });
      } catch (error) {
        const endTime = performance.now();

        newResults.push({
          type: conversionTask.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: endTime - startTime,
        });
      }

      // Real-time result updates
      setResults([...newResults]);
    }

    setConverting(false);
  };

  // Automatically start conversion when image is selected
  useEffect(() => {
    if (sourceFile && !converting && Object.values(options).some(Boolean)) {
      handleConvert();
    }
  }, [sourceFile]);

  const handleDownload = async (result: ConversionResult) => {
    if (!result.success || !result.result) return;

    try {
      const fileName = `converted-${result.type.toLowerCase()}-${Date.now()}`;

      if (result.result instanceof Blob || result.result instanceof File) {
        saveAs(result.result, `${fileName}.${result.type.toLowerCase()}`);
      } else if (result.result instanceof ArrayBuffer) {
        const blob = new Blob([result.result]);
        saveAs(blob, `${fileName}.bin`);
      } else if (result.result instanceof Uint8Array) {
        const blob = new Blob([new Uint8Array(result.result)]);
        saveAs(blob, `${fileName}.bin`);
      } else if (result.result instanceof HTMLImageElement) {
        // Convert HTMLImageElement using library API for download
        try {
          const processed = await processImage(result.result).toBlob();
          saveAs(processed.blob, `${fileName}.png`);
        } catch (error) {
          console.error('Failed to convert HTMLImageElement:', error);
        }
      } else if (typeof result.result === 'string') {
        if (result.type === 'DataURL') {
          // Download DataURL as image
          const link = document.createElement('a');
          link.href = result.result;
          link.download = `${fileName}.png`;
          link.click();
        } else {
          const blob = new Blob([result.result], { type: 'text/plain' });
          saveAs(blob, `${fileName}.txt`);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      console.error('An error occurred during download.');
    }
  };

  const generateCodeExample = () => {
    const selectedConversions = Object.entries(options)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type.replace('to', ''));

    const code = `import { convertToBlob, convertToDataURL, convertToFile, convertToElement } from '@cp949/web-image-util';

// Basic usage - Function-based API

// Chaining conversion examples
${selectedConversions
  .map((type) => {
    switch (type) {
      case 'Canvas':
        return `const canvas = await converter.toCanvas();`;
      case 'Blob':
        return `const blob = await converter.toBlob({ format: 'image/png', quality: 0.9 });`;
      case 'DataURL':
        return `const dataURL = await converter.toDataURL({ format: 'image/jpeg', quality: 0.8 });`;
      case 'Element':
        return `const element = await converter.toElement();`;
      case 'File':
        return `const file = await converter.toFile({ filename: 'image.png', format: 'image/png' });`;
      case 'ArrayBuffer':
        return `const arrayBuffer = await converter.toArrayBuffer();`;
      case 'Uint8Array':
        return `const uint8Array = await converter.toUint8Array();`;
      default:
        return `const result = await converter.to${type}();`;
    }
  })
  .join('\n')}

// Builder pattern API - more concise syntax
const canvas = await from(imageSource).to.canvas();
const blob = await from(canvas).to.blob({ format: 'image/webp', quality: 0.9 });
const file = await from(blob).to.file('converted-image.webp', { format: 'image/webp' });

// Sequential conversion examples
const canvas = await converter.toCanvas();
const blob = await ImageSourceConverter.from(canvas).toBlob();
const dataURL = await ImageSourceConverter.from(blob).toDataURL();

// Support for various input source types
const fromFile = ImageSourceConverter.from(file);           // File
const fromBlob = ImageSourceConverter.from(blob);           // Blob
const fromDataURL = ImageSourceConverter.from(dataURL);     // DataURL string
const fromCanvas = ImageSourceConverter.from(canvas);       // HTMLCanvasElement
const fromImage = ImageSourceConverter.from(imageElement);  // HTMLImageElement
const fromArrayBuffer = ImageSourceConverter.from(buffer);  // ArrayBuffer
const fromUint8Array = ImageSourceConverter.from(uint8);    // Uint8Array
const fromSvg = ImageSourceConverter.from(svgString);       // SVG XML string
const fromUrl = ImageSourceConverter.from('image.jpg');     // URL string`;

    return [
      {
        title: 'convertTo functions usage examples',
        code,
        language: 'typescript' as const,
      },
    ];
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    return `${Math.round(ms * 100) / 100}ms`;
  };

  const ResultPreview: React.FC<{ result: ConversionResult }> = ({ result }) => {
    if (!result.success || !result.result) return null;

    if (result.type === 'Canvas' && result.result instanceof HTMLCanvasElement) {
      return (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <canvas
            width={Math.min(result.result.width, 200)}
            height={Math.min(result.result.height, 200)}
            style={{ border: '1px solid #ccc', borderRadius: 4 }}
            ref={(canvas) => {
              if (canvas && result.result) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const scale = Math.min(200 / result.result.width, 200 / result.result.height);
                  canvas.width = result.result.width * scale;
                  canvas.height = result.result.height * scale;
                  ctx.drawImage(result.result, 0, 0, canvas.width, canvas.height);
                }
              }
            }}
          />
        </Box>
      );
    }

    if (result.type === 'DataURL' && typeof result.result === 'string') {
      return (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <img
            src={result.result}
            alt="Converted"
            style={{
              maxWidth: 200,
              maxHeight: 200,
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
        </Box>
      );
    }

    return null;
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Image Conversion Functions Test
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Test all features of the new convertTo conversion functions. Supports conversion from various input formats to multiple output formats.
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Settings and input */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* File upload */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Image Upload
                </Typography>

                <Box
                  {...getRootProps()}
                  sx={{
                    border: 2,
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    borderStyle: 'dashed',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isDragActive ? 'primary.50' : 'background.paper',
                    mb: 2,
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="body1" gutterBottom>
                    {isDragActive ? 'Drop files here' : 'Drag and drop images or click to select'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supports JPEG, PNG, GIF, BMP, WebP, SVG
                  </Typography>
                </Box>

                {sourcePreview && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Original Preview
                    </Typography>
                    <img
                      src={sourcePreview}
                      alt="Source preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        border: '1px solid #ccc',
                        borderRadius: 4,
                      }}
                    />
                    {sourceFile && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {sourceFile.name} ({formatFileSize(sourceFile.size)})
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Sample images */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Sample Images
                </Typography>
                <SampleImageSelector onImageSelect={handleSampleImageSelect} recommendedFor="image-source-converter" />
              </CardContent>
            </Card>

            {/* Conversion options */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Conversion Options
                </Typography>

                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toCanvas}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toCanvas: e.target.checked }))}
                      />
                    }
                    label="Canvas (HTMLCanvasElement)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toBlob}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toBlob: e.target.checked }))}
                      />
                    }
                    label="Blob"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toDataURL}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toDataURL: e.target.checked }))}
                      />
                    }
                    label="DataURL (Base64 string)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toElement}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toElement: e.target.checked }))}
                      />
                    }
                    label="Element (HTMLImageElement)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toFile}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toFile: e.target.checked }))}
                      />
                    }
                    label="File"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toArrayBuffer}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toArrayBuffer: e.target.checked }))}
                      />
                    }
                    label="ArrayBuffer"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.toUint8Array}
                        onChange={(e) => setOptions((prev) => ({ ...prev, toUint8Array: e.target.checked }))}
                      />
                    }
                    label="Uint8Array"
                  />
                </FormGroup>

                {converting && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Converting... ({results.length} / {Object.values(options).filter(Boolean).length})
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right: Results */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Conversion results */}
            {results.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Conversion Results
                  </Typography>

                  <Grid container spacing={2}>
                    {results.map((result, index) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                        <Paper
                          sx={{
                            p: 2,
                            border: 1,
                            borderColor: result.success ? 'success.main' : 'error.main',
                            borderRadius: 2,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {result.success ? (
                              <SuccessIcon color="success" sx={{ mr: 1 }} />
                            ) : (
                              <ErrorIcon color="error" sx={{ mr: 1 }} />
                            )}
                            <Typography variant="subtitle1" fontWeight="bold">
                              {result.type}
                            </Typography>
                          </Box>

                          {result.success ? (
                            <>
                              <Typography variant="body2" color="text.secondary">
                                Processing time: {formatTime(result.processingTime)}
                              </Typography>
                              {result.size && (
                                <Typography variant="body2" color="text.secondary">
                                  Size: {formatFileSize(result.size)}
                                </Typography>
                              )}

                              <ResultPreview result={result} />

                              <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleDownload(result)}
                                sx={{ mt: 2 }}
                                size="small"
                              >
                                Download
                              </Button>
                            </>
                          ) : (
                            <>
                              <Typography variant="body2" color="error.main">
                                Error: {result.error}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Processing time: {formatTime(result.processingTime)}
                              </Typography>
                            </>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Performance statistics */}
            {results.length > 0 && results.some((r) => r.success) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Statistics
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Successful Conversions
                      </Typography>
                      <Typography variant="h6">
                        {results.filter((r) => r.success).length} / {results.length}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Average Processing Time
                      </Typography>
                      <Typography variant="h6">
                        {formatTime(
                          results.filter((r) => r.success).reduce((sum, r) => sum + r.processingTime, 0) /
                            results.filter((r) => r.success).length || 0
                        )}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Fastest Conversion
                      </Typography>
                      <Typography variant="h6">
                        {results.filter((r) => r.success).length > 0
                          ? results
                              .filter((r) => r.success)
                              .reduce((min, r) => (r.processingTime < min.processingTime ? r : min)).type
                          : '-'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Output Size
                      </Typography>
                      <Typography variant="h6">
                        {formatFileSize(
                          results.filter((r) => r.success && r.size).reduce((sum, r) => sum + (r.size || 0), 0)
                        )}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Usage tips */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>convertTo Functions Features:</strong>
                <br />
                • Type-safe conversion: Each method returns the exact type
                <br />
                • Chainable: Results can be used as input for other conversions
                <br />
                • Diverse input support: Supports File, Blob, Canvas, Image, DataURL, SVG, URL
                <br />• Performance optimization: Provides optimized conversion paths through metadata injection
              </Typography>
            </Alert>

            {/* Code examples */}
            <CodeSnippet title="convertTo Functions Usage" examples={generateCodeExample()} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
