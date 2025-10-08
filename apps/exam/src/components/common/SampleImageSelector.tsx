'use client';

import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useSampleImages, type SampleImage } from '../../hooks/useSampleImages';

/**
 * SampleImageSelector Component Props
 */
interface SampleImageSelectorProps {
  /** Callback invoked when an image is selected */
  onImageSelect: (imagePath: string) => void;
  /** Selected type (default: 'all') */
  selectedType?: 'all' | 'jpg' | 'png' | 'svg';
  /** Whether to use compact mode (default: false) */
  compact?: boolean;
  /** Recommended sample type (when specified, shows only samples for the demo type) */
  recommendedFor?: string;
}

/**
 * Sample Image Selector Component
 *
 * Displays prepared sample images in gallery format
 * with UI allowing users to immediately select by clicking
 */
export function SampleImageSelector({
  onImageSelect,
  selectedType = 'all',
  compact = false,
  recommendedFor,
}: SampleImageSelectorProps) {
  const { sampleImages, getImagesByType, getRecommendedImages } =
    useSampleImages();
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'jpg' | 'png' | 'svg'
  >(selectedType);

  // Display all sample images (recommendation filter removed)
  const displayImages: SampleImage[] = selectedCategory === 'all'
    ? sampleImages
    : getImagesByType(selectedCategory);

  // Recommended images info (for display)
  const recommendedImages = recommendedFor ? getRecommendedImages(recommendedFor) : [];

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6">
              Select Sample Image
            </Typography>

            {!compact && (
              <ToggleButtonGroup
                value={selectedCategory}
                exclusive
                onChange={(_, newCategory) =>
                  setSelectedCategory(newCategory || 'all')
                }
                size="small"
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="jpg">JPG</ToggleButton>
                <ToggleButton value="png">PNG</ToggleButton>
                <ToggleButton value="svg">SVG</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          {/* Performance comparison notice */}
          {recommendedFor === 'performance' && (
            <Typography variant="subtitle2" color="primary" sx={{ mt: 1, mb: 1 }}>
              📊 Select large images for performance comparison
            </Typography>
          )}

          <Grid container spacing={2}>
            {displayImages.map((image, index) => (
              <Grid key={index} size={{ xs: compact ? 4 : 3 }}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 3,
                    },
                    transition: 'all 0.2s',
                  }}
                  onClick={() => onImageSelect(image.path)}
                >
                  <CardMedia
                    component="img"
                    image={image.preview}
                    alt={image.name}
                    sx={{
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      height: compact ? 80 : 120
                    }}
                  />
                  {!compact && (
                    <CardContent sx={{ p: 1 }}>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ display: 'block', mb: 0.5 }}
                      >
                        {image.name}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 0.5,
                        }}
                      >
                        <Chip
                          label={image.type.toUpperCase()}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={image.size}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {image.description}
                      </Typography>
                    </CardContent>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>

          {displayImages.length === 0 && (
            <Typography variant="body2" color="text.secondary" align="center">
              No sample images available in the selected category.
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            💡 Click to select an image immediately
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}