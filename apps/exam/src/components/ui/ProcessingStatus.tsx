// Processing status display component

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
          {message || 'Processing image...'}
        </Typography>
        <LinearProgress variant={progress !== undefined ? 'determinate' : 'indeterminate'} value={progress} />
      </Stack>
    </Box>
  );
}