'use client';

import type { ResultCanvas } from '@cp949/web-image-util';
import { processImage } from '@cp949/web-image-util';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';
import { BeforeAfterView } from '../ui/BeforeAfterView';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { ProcessingStatus } from '../ui/ProcessingStatus';

interface ShortcutResult {
  dataURL: string;
  width: number;
  height: number;
  processingTime: number;
}

interface ShortcutOperation {
  name: string;
  description: string;
  operation: (src: File) => Promise<ResultCanvas>;
  code: string;
}

// Direct Mapping operations
const DIRECT_OPERATIONS: ShortcutOperation[] = [
  {
    name: 'coverBox(300, 200)',
    description: 'Fill 300×200 box (may crop parts)',
    operation: (src: File) => processImage(src).shortcut.coverBox(300, 200).toCanvas(),
    code: `await processImage(file)
  .shortcut.coverBox(300, 200)
  .toBlob();`,
  },
  {
    name: 'containBox(300, 200)',
    description: 'Fit entire image within 300×200 box',
    operation: (src: File) => processImage(src).shortcut.containBox(300, 200).toCanvas(),
    code: `await processImage(file)
  .shortcut.containBox(300, 200)
  .toBlob();`,
  },
  {
    name: 'exactSize(300, 200)',
    description: 'Convert to exactly 300×200 size',
    operation: (src: File) => processImage(src).shortcut.exactSize(300, 200).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactSize(300, 200)
  .toBlob();`,
  },
  {
    name: 'maxWidth(400)',
    description: 'Limit maximum width to 400px',
    operation: (src: File) => processImage(src).shortcut.maxWidth(400).toCanvas(),
    code: `await processImage(file)
  .shortcut.maxWidth(400)
  .toBlob();`,
  },
  {
    name: 'maxHeight(300)',
    description: 'Limit maximum height to 300px',
    operation: (src: File) => processImage(src).shortcut.maxHeight(300).toCanvas(),
    code: `await processImage(file)
  .shortcut.maxHeight(300)
  .toBlob();`,
  },
  {
    name: 'minWidth(400)',
    description: 'Ensure minimum width of 400px',
    operation: (src: File) => processImage(src).shortcut.minWidth(400).toCanvas(),
    code: `await processImage(file)
  .shortcut.minWidth(400)
  .toBlob();`,
  },
];

// Lazy operations
const LAZY_OPERATIONS: ShortcutOperation[] = [
  {
    name: 'toScale(1.5)',
    description: 'Scale uniformly by 1.5x',
    operation: async (src: File) => processImage(src).shortcut.scale(1.5).toCanvas(),
    code: `await processImage(file)
  .shortcut.scale(1.5)
  .toBlob();`,
  },
  {
    name: 'scale(0.5)',
    description: 'Scale uniformly by 0.5x',
    operation: async (src: File) => processImage(src).shortcut.scale(0.5).toCanvas(),
    code: `await processImage(file)
  .shortcut.scale(0.5)
  .toBlob();`,
  },
  {
    name: 'exactWidth(200)',
    description: 'Adjust width to 200px',
    operation: async (src: File) => processImage(src).shortcut.exactWidth(200).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactWidth(200)
  .toBlob();`,
  },
  {
    name: 'exactHeight(200)',
    description: 'Adjust height to 200px',
    operation: async (src: File) => processImage(src).shortcut.exactHeight(200).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactHeight(200)
  .toBlob();`,
  },
  {
    name: 'scaleX(2)',
    description: 'Scale horizontally by 2x only',
    operation: async (src: File) => processImage(src).shortcut.scaleX(2).toCanvas(),
    code: `await processImage(file)
  .shortcut.scaleX(2)
  .toBlob();`,
  },
  {
    name: 'scaleY(0.5)',
    description: 'Scale vertically by 0.5x only',
    operation: (src: File) => processImage(src).shortcut.scaleY(0.5).toCanvas(),
    code: `await processImage(file)
  .shortcut.scaleY(0.5)
  .toBlob();`,
  },
];

// Chaining examples
const CHAINING_OPERATIONS: ShortcutOperation[] = [
  {
    name: 'coverBox + blur',
    description: 'Box sizing then blur effect',
    operation: (src: File) => processImage(src).shortcut.coverBox(300, 200).blur(3).toCanvas(),
    code: `await processImage(file)
  .shortcut.coverBox(300, 200)
  .blur(3)
  .toBlob();`,
  },
  {
    name: 'toScale + blur',
    description: 'Scale adjustment then blur effect',
    operation: (src: File) => processImage(src).shortcut.scale(1.5).blur(2).toCanvas(),
    code: `await processImage(file)
  .shortcut.scale(1.5)
  .blur(2)
  .toBlob();`,
  },
  {
    name: 'exactWidth + blur',
    description: 'Width adjustment then blur effect',
    operation: (src: File) => processImage(src).shortcut.exactWidth(300).blur(2).toCanvas(),
    code: `await processImage(file)
  .shortcut.exactWidth(300)
  .blur(2)
  .toBlob();`,
  },
  {
    name: 'containBox + blur',
    description: 'Fit in box then blur effect',
    operation: (src: File) => processImage(src).shortcut.containBox(300, 200).blur(1).toCanvas(),
    code: `await processImage(file)
  .shortcut.containBox(300, 200)
  .blur(1)
  .toBlob();`,
  },
];

// Array combining all operations
const ALL_OPERATIONS: ShortcutOperation[] = [...DIRECT_OPERATIONS, ...LAZY_OPERATIONS, ...CHAINING_OPERATIONS];

export function ShortcutApiDemo() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [results, setResults] = useState<{ [key: string]: ShortcutResult }>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Image selection handler - execute Shortcut processing immediately upon selection
  const handleImageSelect = async (source: string | File) => {
    setResults({});
    setError(null);

    if (source instanceof File) {
      // If File object
      setSelectedImage(source);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const preview = e.target?.result as string;
        setOriginalPreview(preview);

        // Automatically execute Shortcut processing after image load completion
        await processAllShortcuts(source);
      };
      reader.readAsDataURL(source);
    } else {
      // If string (URL/path) - process sample image
      try {
        setOriginalPreview(source);

        // Create File object from URL
        const response = await fetch(source);
        const blob = await response.blob();

        // Extract filename from URL or use default
        const filename = source.split('/').pop() || 'sample-image';
        const file = new File([blob], filename, { type: blob.type });

        setSelectedImage(file);

        // Automatically execute Shortcut processing after sample image load completion
        await processAllShortcuts(file);
      } catch (err) {
        console.error('Sample image load failed:', err);
        setError(new Error('Unable to load sample image.'));
        setSelectedImage(null);
        setOriginalPreview(null);
      }
    }
  };

  // Get operations from all categories
  const getAllOperations = () => {
    return ALL_OPERATIONS;
  };

  // Process all shortcuts
  const processAllShortcuts = async (imageFile?: File) => {
    const targetImage = imageFile || selectedImage;
    if (!targetImage) return;

    setProcessing(true);
    setError(null);
    const newResults: { [key: string]: ShortcutResult } = {};

    try {
      const operations = getAllOperations();

      for (const shortcut of operations) {
        const startTime = performance.now();
        const result: ResultCanvas = await shortcut.operation(targetImage);
        const processingTime = performance.now() - startTime;

        // Convert Canvas to Data URL
        const dataURL = result.canvas.toDataURL('image/png');
        newResults[shortcut.name] = {
          dataURL,
          width: result.canvas.width,
          height: result.canvas.height,
          processingTime,
        };
      }

      setResults(newResults);
    } catch (err) {
      console.error('Shortcut processing error:', err);
      setError(err instanceof Error ? err : new Error('An error occurred during processing.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" gutterBottom>
          🚀 Shortcut API
        </Typography>

        {/* Image uploader */}
        <Box sx={{ mb: 3 }}>
          <Container maxWidth="sm">
            <ImageUploader onImageSelect={handleImageSelect} />
          </Container>
        </Box>

        {/* Processing status */}
        <ProcessingStatus processing={processing} />

        {/* Error display */}
        {error && <ErrorDisplay error={error} onClear={() => setError(null)} />}

        {/* Results display */}
        {Object.keys(results).length > 0 && (
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {getAllOperations().map((shortcut) => {
              const result = results[shortcut.name];
              if (!result) return null;

              return (
                <Grid key={shortcut.name} size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {shortcut.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {shortcut.description}
                          </Typography>
                        </Box>

                        {/* Before/After comparison */}
                        {originalPreview && (
                          <BeforeAfterView
                            before={{ src: originalPreview }}
                            after={{
                              src: result.dataURL,
                              width: result.width,
                              height: result.height,
                              processingTime: result.processingTime,
                              format: 'png',
                            }}
                          />
                        )}

                        {/* Processing information */}
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Size: {result.width} × {result.height}px
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Processing time: {result.processingTime.toFixed(2)}ms
                          </Typography>
                        </Box>

                        {/* Code example */}
                        <CodeSnippet
                          examples={[
                            {
                              title: shortcut.name,
                              code: shortcut.code,
                              language: 'typescript',
                            },
                          ]}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Container>
  );
}
