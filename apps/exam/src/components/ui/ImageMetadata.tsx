// Image metadata display component - Phase 3: Enhanced metadata display

'use client';

import {
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
  Chip,
  Box,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  PhotoSizeSelectActual,
  Speed,
  CompareArrows,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import type { ImageInfo, ProcessedImageInfo } from '../demos/types';
import { formatFileSize, formatProcessingTime } from '../../utils/errorHandling';

interface ImageMetadataProps {
  original: ImageInfo | null;
  processed: ProcessedImageInfo | null;
}

export function ImageMetadata({ original, processed }: ImageMetadataProps) {
  if (!original && !processed) return null;

  // Calculate processing efficiency
  const calculateEfficiency = () => {
    if (!original || !processed || !original.size || !processed.size) return null;

    const sizeReduction = 1 - processed.compressionRatio!;
    const processingSpeed = processed.processingTime;

    // Efficiency score (size reduction + processing speed)
    // Size reduction: ≥50% = Excellent, 20-50% = Good, <20% = Fair
    // Processing time: <100ms = Excellent, 100-500ms = Good, ≥500ms = Fair
    let score = 0;
    if (sizeReduction >= 0.5) score += 50;
    else if (sizeReduction >= 0.2) score += 30;
    else score += 10;

    if (processingSpeed < 100) score += 50;
    else if (processingSpeed < 500) score += 30;
    else score += 10;

    return {
      score,
      level: score >= 80 ? 'Excellent' : score >= 50 ? 'Good' : 'Fair',
      color: score >= 80 ? 'success' : score >= 50 ? 'info' : 'warning',
    };
  };

  const efficiency = calculateEfficiency();

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Info color="primary" />
          Image Information
        </Typography>

        <Grid container spacing={3}>
          {/* Original image info */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: 1,
                borderColor: 'grey.200',
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <PhotoSizeSelectActual fontSize="small" color="action" />
                Original Image
              </Typography>
              {original ? (
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Resolution
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {original.width} × {original.height}px
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total {(original.width * original.height / 1_000_000).toFixed(2)}MP
                    </Typography>
                  </Box>
                  {original.size && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        File Size
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatFileSize(original.size)}
                      </Typography>
                    </Box>
                  )}
                  {original.format && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Format
                      </Typography>
                      <Chip label={original.format.toUpperCase()} size="small" color="default" />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Please select an image
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Processed image info */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: processed ? 'success.50' : 'grey.50',
                borderRadius: 1,
                border: 1,
                borderColor: processed ? 'success.200' : 'grey.200',
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <CheckCircle fontSize="small" color={processed ? 'success' : 'action'} />
                Processed Result
              </Typography>
              {processed ? (
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Resolution
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {processed.width} × {processed.height}px
                    </Typography>
                    {original && (
                      <Typography variant="caption" color="text.secondary">
                        {processed.width === original.width && processed.height === original.height
                          ? 'Size maintained'
                          : `${((processed.width * processed.height) / (original.width * original.height) * 100).toFixed(0)}% of original`}
                      </Typography>
                    )}
                  </Box>
                  {processed.size && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        File Size
                      </Typography>
                      <Typography variant="body1" fontWeight="medium" color="success.main">
                        {formatFileSize(processed.size)}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Processing Time
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Speed fontSize="small" color="primary" />
                      <Typography variant="body1" fontWeight="medium">
                        {formatProcessingTime(processed.processingTime)}
                      </Typography>
                    </Box>
                  </Box>
                  {processed.compressionRatio && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Compression Efficiency
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <CompareArrows fontSize="small" color="success" />
                        <Typography
                          variant="body1"
                          fontWeight="medium"
                          color={processed.compressionRatio < 1 ? 'success.main' : 'inherit'}
                        >
                          {(processed.compressionRatio * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                      {processed.compressionRatio < 1 && (
                        <LinearProgress
                          variant="determinate"
                          value={(1 - processed.compressionRatio) * 100}
                          color="success"
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      )}
                      {processed.compressionRatio < 1 && (
                        <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                          {((1 - processed.compressionRatio) * 100).toFixed(0)}% file size reduction
                        </Typography>
                      )}
                    </Box>
                  )}
                  {processed.format && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Format
                      </Typography>
                      <Chip label={processed.format.toUpperCase()} size="small" color="success" />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No processed image
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Processing efficiency summary (shown only after processing) */}
          {efficiency && (
            <Grid size={12}>
              <Alert
                severity={efficiency.color as 'success' | 'info' | 'warning'}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                <Box sx={{ width: '100%' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Processing Efficiency: <strong>{efficiency.level}</strong> (Score: {efficiency.score}/100)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={efficiency.score}
                    color={efficiency.color as 'success' | 'info' | 'warning'}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {efficiency.score >= 80 && 'Achieved optimal compression ratio and fast processing speed.'}
                    {efficiency.score >= 50 && efficiency.score < 80 && 'Showing good performance.'}
                    {efficiency.score < 50 && 'There is room for performance improvement. Try adjusting the options.'}
                  </Typography>
                </Box>
              </Alert>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}