// Error display component

'use client';

import { Alert, Button, Stack } from '@mui/material';
import { ImageProcessError } from '@cp949/web-image-util';
import { getErrorMessage, getErrorSeverity } from '../../utils/errorHandling';

interface ErrorDisplayProps {
  error: ImageProcessError | Error | null;
  onRetry?: () => void;
  onClear?: () => void;
  canRetry?: boolean;
}

export function ErrorDisplay({ error, onRetry, onClear, canRetry }: ErrorDisplayProps) {
  if (!error) return null;

  const severity = getErrorSeverity(error);

  return (
    <Alert
      severity={severity}
      action={
        <Stack direction="row" spacing={1}>
          {canRetry && onRetry && (
            <Button size="small" onClick={onRetry} color="inherit">
              Retry
            </Button>
          )}
          {onClear && (
            <Button size="small" onClick={onClear} color="inherit">
              Close
            </Button>
          )}
        </Stack>
      }
    >
      {getErrorMessage(error)}
    </Alert>
  );
}