'use client';

'use client';

import { Box, Typography, Card, CardContent, Grid, Chip, Container, Button, Stack } from '@mui/material';
import {
  PhotoLibrary as GalleryIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Widgets as ComponentsIcon,
  AutoFixHigh as ShortcutIcon,
} from '@mui/icons-material';
import Link from 'next/link';

export function HomeDemo() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Web Image Util
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Powerful image processing library for browsers
        </Typography>
        <Box sx={{ mt: 3 }}>
          <Chip label="React 19" color="primary" sx={{ mr: 1 }} />
          <Chip label="TypeScript" color="secondary" sx={{ mr: 1 }} />
          <Chip label="Canvas API" color="success" />
        </Box>
      </Box>

      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <SpeedIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                High Performance
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Optimized image processing based on Canvas API
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <ComponentsIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Rich Features
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Resizing, filters, watermarks, format conversion
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <SecurityIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Type Safety
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Full TypeScript support
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <GalleryIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Multiple Formats
              </Typography>
              <Typography variant="body2" color="text.secondary">
                JPEG, PNG, WebP, SVG support
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Quick Start
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Check out basic usage of the library
        </Typography>

        <Card sx={{ mt: 4, textAlign: 'left' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Installation
            </Typography>
            <Box
              component="pre"
              sx={{
                backgroundColor: 'grey.100',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
              }}
            >
              <code>npm install @cp949/web-image-util</code>
            </Box>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Basic Usage
            </Typography>
            <Box
              component="pre"
              sx={{
                backgroundColor: 'grey.100',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.875rem',
              }}
            >
              <code>{`import { processImage, createAvatar } from '@cp949/web-image-util';

// Image resizing
const resized = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// Avatar creation
const avatar = await createAvatar(source, { size: 150 });

// 🚀 Shortcut API (Sharp.js style)
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .blur(2)
  .toBlob();`}</code>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Demo page links */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Demo Pages
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Try various features hands-on
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ gap: 2 }}>
          <Button component={Link} href="/basic" variant="outlined" size="large">
            Basic Resizing
          </Button>
          <Button component={Link} href="/shortcut-api" variant="outlined" size="large" startIcon={<ShortcutIcon />}>
            Shortcut API
          </Button>
          <Button component={Link} href="/presets" variant="outlined" size="large">
            Presets
          </Button>
          <Button component={Link} href="/advanced" variant="outlined" size="large">
            Advanced Features
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
// removed old export default;
