// 에러 표시 컴포넌트

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
              다시 시도
            </Button>
          )}
          {onClear && (
            <Button size="small" onClick={onClear} color="inherit">
              닫기
            </Button>
          )}
        </Stack>
      }
    >
      {getErrorMessage(error)}
    </Alert>
  );
}