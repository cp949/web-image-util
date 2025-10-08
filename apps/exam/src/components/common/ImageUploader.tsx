import { useCallback, useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Alert, LinearProgress, Stack, Chip, SxProps } from '@mui/material';
import { CloudUpload as UploadIcon, Link as LinkIcon } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { SampleImageSelector } from './SampleImageSelector';

interface ImageUploaderProps {
  onImageSelect: (source: File | string) => void;
  supportedFormats?: string[];
  maxSize?: number; // MB
  /** Whether to show sample image selector (default: true) */
  showSampleSelector?: boolean;
  /** Sample selector type filter */
  sampleSelectorType?: 'all' | 'jpg' | 'png' | 'svg';
  /** Sample selector compact mode */
  sampleSelectorCompact?: boolean;
  /** Recommended sample demo type */
  recommendedSamplesFor?: string;
}

export function ImageUploader({
  onImageSelect,
  supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  maxSize = 10,
  showSampleSelector = true,
  sampleSelectorType = 'all',
  sampleSelectorCompact = true,
  recommendedSamplesFor,
}: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Check file size
        if (file.size > maxSize * 1024 * 1024) {
          setError(`File size must be ${maxSize}MB or less.`);
          return;
        }

        setError(null);
        setLoading(true);

        try {
          onImageSelect(file);
        } catch {
          setError('An error occurred while loading the image.');
        } finally {
          setLoading(false);
        }
      }
    },
    [onImageSelect, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': supportedFormats.map((format) => `.${format}`),
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const handleUrlInput = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      setError(null);
      onImageSelect(url);
    }
  };

  return (
    <Stack spacing={3}>
      {/* File upload UI */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Image
          </Typography>

          {/* Drag and drop area */}
          <Box
            {...getRootProps()}
            sx={{
              border: 2,
              borderColor: dragActive ? 'primary.main' : 'grey.300',
              borderStyle: 'dashed',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: dragActive ? 'primary.50' : 'background.paper',
              transition: 'all 0.2s ease',
              mb: 2,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'primary.50',
              },
            }}
          >
            <input {...getInputProps()} />
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop image here' : 'Drag image or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported formats: {supportedFormats.join(', ').toUpperCase()} (max {maxSize}MB)
            </Typography>
          </Box>

          {/* Additional option buttons */}
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button variant="outlined" startIcon={<LinkIcon />} onClick={handleUrlInput}>
              Load from URL
            </Button>
          </Stack>

          {/* Loading state */}
          {loading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading image...
              </Typography>
            </Box>
          )}

          {/* Error message */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Format support information */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Supported formats:
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {supportedFormats.map((format) => (
                <Chip key={format} label={format.toUpperCase()} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Sample image selector */}
      {showSampleSelector && (
        <SampleImageSelector
          onImageSelect={onImageSelect}
          selectedType={sampleSelectorType}
          compact={sampleSelectorCompact}
          recommendedFor={recommendedSamplesFor}
        />
      )}
    </Stack>
  );
}
