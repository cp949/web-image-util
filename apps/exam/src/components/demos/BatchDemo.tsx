'use client'

import { createAvatar, createSocialImage, createThumbnail, processImage } from '@cp949/web-image-util';
import {
  CheckCircle as CompleteIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  PlayArrow as StartIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CodeSnippet } from '../common/CodeSnippet';

interface BatchFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: Blob;
  error?: string;
  processingTime?: number;
}

interface BatchOptions {
  operation: 'resize' | 'thumbnail' | 'avatar' | 'social';
  width?: number;
  height?: number;
  size?: number;
  format: 'jpeg' | 'png' | 'webp' | 'avif';
  quality: number;
  socialPlatform?: 'instagram' | 'twitter' | 'facebook';
}

export function BatchDemo() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [options, setOptions] = useState<BatchOptions>({
    operation: 'resize',
    width: 300,
    height: 200,
    format: 'jpeg',
    quality: 80,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: BatchFile[] = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
    },
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setProgress(0);
  };

  const processBatch = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setProgress(0);

    const updatedFiles = [...files];
    let completedCount = 0;

    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i];
      file.status = 'processing';
      setFiles([...updatedFiles]);

      const startTime = Date.now();

      try {
        let result: Blob;

        switch (options.operation) {
          case 'resize':
            const resizeResult = await processImage(file.file)
              .resize({ fit: 'cover', width: options.width!, height: options.height! })
              .toBlob({
                format: options.format as 'png' | 'jpeg' | 'webp',
                quality: options.quality / 100,
              });
            result = resizeResult.blob;
            break;

          case 'thumbnail':
            const thumbnailResult = await createThumbnail(file.file, {
              size: options.size || 150,
              format: options.format as 'png' | 'webp',
              quality: options.quality / 100,
            });
            result = thumbnailResult.blob;
            break;

          case 'avatar':
            const avatarResult = await createAvatar(file.file, {
              size: options.size || 128,
              format: options.format as 'png' | 'webp',
            });
            result = avatarResult.blob;
            break;

          case 'social':
            const socialResult = await createSocialImage(file.file, {
              platform: options.socialPlatform || 'instagram',
              format: options.format as 'png' | 'webp',
              quality: options.quality / 100,
            });
            result = socialResult.blob;
            break;

          default:
            throw new Error('Unknown operation');
        }

        file.status = 'completed';
        file.result = result;
        file.processingTime = Date.now() - startTime;
      } catch (error) {
        file.status = 'error';
        file.error = error instanceof Error ? error.message : 'Error occurred during processing';
      }

      completedCount++;
      setProgress((completedCount / updatedFiles.length) * 100);
      setFiles([...updatedFiles]);
    }

    setProcessing(false);
  };

  const downloadResults = async () => {
    const completedFiles = files.filter((file) => file.status === 'completed' && file.result);

    if (completedFiles.length === 0) {
      console.log('No completed files to download.');
      return;
    }

    const zip = new JSZip();

    for (const file of completedFiles) {
      const extension = options.format === 'jpeg' ? 'jpg' : options.format;
      const filename = `${file.file.name.split('.')[0]}_processed.${extension}`;
      zip.file(filename, file.result!);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'processed_images.zip');
  };

  const getStatusIcon = (status: BatchFile['status']) => {
    switch (status) {
      case 'completed':
        return <CompleteIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <LinearProgress sx={{ width: 24, height: 24 }} />;
      default:
        return <UploadIcon color="action" />;
    }
  };

  const getStatusColor = (status: BatchFile['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'processing':
        return 'warning';
      default:
        return 'default';
    }
  };

  const generateCodeExample = () => {
    const code = `import { ${
      options.operation === 'resize'
        ? 'processImage'
        : options.operation === 'thumbnail'
          ? 'createThumbnail'
          : options.operation === 'avatar'
            ? 'createAvatar'
            : 'createSocialImage'
    } } from '@cp949/web-image-util';

// Batch processing example
const processFiles = async (files) => {
  const results = [];

  for (const file of files) {
    try {
      ${
        options.operation === 'resize'
          ? `const result = await processImage(file)
        .resize({ fit: 'cover', width: ${options.width}, height: ${options.height} })
        .toBlob('${options.format}');`
          : options.operation === 'thumbnail'
            ? `const result = await createThumbnail(file, {
        size: ${options.size || 150},
        format: '${options.format}',
        quality: ${options.quality / 100}
      });`
            : options.operation === 'avatar'
              ? `const result = await createAvatar(file, {
        size: ${options.size || 128},
        format: '${options.format}'
      });`
              : `const result = await createSocialImage(file, {
        platform: '${options.socialPlatform || 'instagram'}',
        format: '${options.format}',
        quality: ${options.quality / 100}
      });`
      }

      results.push({ file, result, status: 'success' });
    } catch (error) {
      results.push({ file, error, status: 'error' });
    }
  }

  return results;
};

// Parallel processing with Promise.all (faster)
const processFilesParallel = async (files) => {
  const promises = files.map(async (file) => {
    try {
      ${
        options.operation === 'resize'
          ? `const result = await processImage(file).resize({ fit: 'cover', width: ${options.width}, height: ${options.height} }).toBlob();`
          : `const result = await ${options.operation}(file, options);`
      }
      return { file, result, status: 'success' };
    } catch (error) {
      return { file, error, status: 'error' };
    }
  });

  return Promise.all(promises);
};

// Download using JSZip
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const downloadAsZip = async (results) => {
  const zip = new JSZip();
  
  results.forEach((item, index) => {
    if (item.status === 'success') {
      zip.file(\`processed_\${index}.${options.format}\`, item.result);
    }
  });
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, 'processed_images.zip');
};`;

    return [
      {
        title: 'Batch Processing Code',
        code,
        language: 'typescript',
      },
    ];
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Batch Processing
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Process multiple images at once with the same settings.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* File Upload */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Add Image Files
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
                    {isDragActive ? 'Drop files here' : 'Drag multiple images or click to select'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supports JPEG, PNG, WebP files
                  </Typography>
                </Box>

                {files.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      {files.length} files selected
                    </Typography>
                    <Button size="small" onClick={clearAll} color="error">
                      Clear All
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Processing Options */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Processing Options
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Operation Type</InputLabel>
                  <Select
                    value={options.operation}
                    label="Operation Type"
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        operation: e.target.value as 'resize' | 'thumbnail' | 'avatar' | 'social',
                      }))
                    }
                  >
                    <MenuItem value="resize">Resize</MenuItem>
                    <MenuItem value="thumbnail">Thumbnail</MenuItem>
                    <MenuItem value="avatar">Avatar</MenuItem>
                    <MenuItem value="social">Social Image</MenuItem>
                  </Select>
                </FormControl>

                {/* Resize Options */}
                {options.operation === 'resize' && (
                  <Box>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="Width"
                          type="number"
                          value={options.width}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              width: parseInt(e.target.value) || 300,
                            }))
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          label="Height"
                          type="number"
                          value={options.height}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              height: parseInt(e.target.value) || 200,
                            }))
                          }
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Thumbnail/Avatar Options */}
                {(options.operation === 'thumbnail' || options.operation === 'avatar') && (
                  <TextField
                    fullWidth
                    label="Size (px)"
                    type="number"
                    value={options.size || (options.operation === 'thumbnail' ? 150 : 128)}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        size: parseInt(e.target.value) || 150,
                      }))
                    }
                    sx={{ mb: 2 }}
                  />
                )}

                {/* Social Image Options */}
                {options.operation === 'social' && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Platform</InputLabel>
                    <Select
                      value={options.socialPlatform || 'instagram'}
                      label="Platform"
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          socialPlatform: e.target.value as 'instagram' | 'twitter' | 'facebook',
                        }))
                      }
                    >
                      <MenuItem value="instagram">Instagram</MenuItem>
                      <MenuItem value="twitter">Twitter</MenuItem>
                      <MenuItem value="facebook">Facebook</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {/* Common Options */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Output Format</InputLabel>
                  <Select
                    value={options.format}
                    label="Output Format"
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        format: e.target.value as 'jpeg' | 'png' | 'webp' | 'avif',
                      }))
                    }
                  >
                    <MenuItem value="jpeg">JPEG</MenuItem>
                    <MenuItem value="png">PNG</MenuItem>
                    <MenuItem value="webp">WebP</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Quality (%)"
                  type="number"
                  value={options.quality}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      quality: parseInt(e.target.value) || 80,
                    }))
                  }
                  inputProps={{ min: 10, max: 100 }}
                  sx={{ mb: 3 }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<StartIcon />}
                  onClick={processBatch}
                  disabled={files.length === 0 || processing}
                  size="large"
                >
                  {processing ? 'Processing...' : `Start Batch Processing (${files.length} files)`}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* Processing Status */}
            {files.length > 0 && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Processing Status</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label={`Completed ${completedCount}`} color="success" size="small" />
                      {errorCount > 0 && <Chip label={`Failed ${errorCount}`} color="error" size="small" />}
                    </Stack>
                  </Box>

                  {processing && (
                    <Box sx={{ mb: 2 }}>
                      <LinearProgress variant="determinate" value={progress} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Progress: {Math.round(progress)}%
                      </Typography>
                    </Box>
                  )}

                  <List dense>
                    {files.map((file) => (
                      <ListItem key={file.id}>
                        <ListItemIcon>{getStatusIcon(file.status)}</ListItemIcon>
                        <ListItemText
                          primary={file.file.name}
                          secondary={
                            file.status === 'error'
                              ? file.error
                              : file.status === 'completed'
                                ? `Completed (${file.processingTime}ms)`
                                : file.status === 'processing'
                                  ? 'Processing...'
                                  : 'Pending'
                          }
                        />
                        <ListItemSecondaryAction>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={file.status} color={getStatusColor(file.status)} size="small" />
                            <IconButton
                              edge="end"
                              onClick={() => removeFile(file.id)}
                              disabled={processing}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  {completedCount > 0 && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={downloadResults}
                        color="success"
                      >
                        Download Processed Images (ZIP)
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Processing Statistics */}
            {completedCount > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Processing Statistics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Processed Files
                      </Typography>
                      <Typography variant="h6">{completedCount} files</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Average Processing Time
                      </Typography>
                      <Typography variant="h6">
                        {Math.round(
                          files
                            .filter((f) => f.status === 'completed' && f.processingTime)
                            .reduce((sum, f) => sum + (f.processingTime || 0), 0) / completedCount
                        )}
                        ms
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                      <Typography variant="h6">{Math.round((completedCount / files.length) * 100)}%</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Processed Size
                      </Typography>
                      <Typography variant="h6">
                        {Math.round(
                          (files
                            .filter((f) => f.status === 'completed' && f.result)
                            .reduce((sum, f) => sum + (f.result?.size || 0), 0) /
                            1024 /
                            1024) *
                            100
                        ) / 100}
                        MB
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Code Example */}
            <CodeSnippet title="Batch Processing Code Example" examples={generateCodeExample()} />

            {/* Tips */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Performance Tips:</strong>
                <br />
                • For large files, split them into smaller batches for processing
                <br />
                • Use Promise.all for faster parallel processing
                <br />• Consider memory usage and avoid processing too many files at once
              </Typography>
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
