// 처리 상태 표시 컴포넌트

'use client';

import { Box, LinearProgress, Stack, Typography } from '@mui/material';

interface ProcessingStatusProps {
  processing: boolean;
  progress?: number;
  message?: string;
}

export function ProcessingStatus({ processing, progress, message }: ProcessingStatusProps) {
  if (!processing) return null;

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {message || '이미지 처리 중...'}
        </Typography>
        <LinearProgress variant={progress !== undefined ? 'determinate' : 'indeterminate'} value={progress} />
      </Stack>
    </Box>
  );
}