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
 * SampleImageSelector 컴포넌트 Props
 */
interface SampleImageSelectorProps {
  /** 이미지 선택 시 호출되는 콜백 */
  onImageSelect: (imagePath: string) => void;
  /** 선택된 타입 (기본값: 'all') */
  selectedType?: 'all' | 'jpg' | 'png' | 'svg';
  /** 컴팩트 모드 여부 (기본값: false) */
  compact?: boolean;
  /** 추천 샘플 타입 (지정 시 해당 데모 타입에 맞는 샘플만 표시) */
  recommendedFor?: string;
}

/**
 * 샘플 이미지 선택기 컴포넌트
 *
 * 미리 준비된 샘플 이미지들을 갤러리 형태로 표시하고
 * 사용자가 클릭하여 즉시 선택할 수 있는 UI 제공
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

  // 추천 이미지가 지정된 경우 해당 이미지만 표시
  const displayImages: SampleImage[] = recommendedFor
    ? getRecommendedImages(recommendedFor)
    : selectedCategory === 'all'
      ? sampleImages
      : getImagesByType(selectedCategory);

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
              {recommendedFor ? '추천 샘플 이미지' : '샘플 이미지 선택'}
            </Typography>

            {!compact && !recommendedFor && (
              <ToggleButtonGroup
                value={selectedCategory}
                exclusive
                onChange={(_, newCategory) =>
                  setSelectedCategory(newCategory || 'all')
                }
                size="small"
              >
                <ToggleButton value="all">전체</ToggleButton>
                <ToggleButton value="jpg">JPG</ToggleButton>
                <ToggleButton value="png">PNG</ToggleButton>
                <ToggleButton value="svg">SVG</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

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
                    height={compact ? 80 : 120}
                    image={image.preview}
                    alt={image.name}
                    sx={{ objectFit: 'cover' }}
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
              선택한 카테고리에 샘플 이미지가 없습니다.
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            💡 클릭하여 즉시 이미지를 선택할 수 있습니다
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}