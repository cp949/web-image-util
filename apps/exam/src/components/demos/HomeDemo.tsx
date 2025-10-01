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
          브라우저에서 사용하는 강력한 이미지 처리 라이브러리
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
                고성능 처리
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Canvas API 기반 최적화된 이미지 처리
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <ComponentsIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                다양한 기능
              </Typography>
              <Typography variant="body2" color="text.secondary">
                리사이징, 필터, 워터마크, 포맷 변환
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <SecurityIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                타입 안전성
              </Typography>
              <Typography variant="body2" color="text.secondary">
                완전한 TypeScript 지원
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <GalleryIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                다양한 포맷
              </Typography>
              <Typography variant="body2" color="text.secondary">
                JPEG, PNG, WebP, SVG 지원
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          빠른 시작
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          라이브러리의 기본 사용법을 확인해보세요
        </Typography>

        <Card sx={{ mt: 4, textAlign: 'left' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              설치
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
              기본 사용법
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

// 이미지 리사이징
const resized = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// 아바타 생성
const avatar = await createAvatar(source, { size: 150 });

// 🚀 Shortcut API (Sharp.js 스타일)
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .blur(2)
  .toBlob();`}</code>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* 데모 페이지 링크 */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          데모 페이지
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          다양한 기능들을 직접 체험해보세요
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ gap: 2 }}>
          <Button component={Link} href="/basic" variant="outlined" size="large">
            기본 리사이징
          </Button>
          <Button component={Link} href="/shortcut-api" variant="outlined" size="large" startIcon={<ShortcutIcon />}>
            Shortcut API
          </Button>
          <Button component={Link} href="/presets" variant="outlined" size="large">
            프리셋
          </Button>
          <Button component={Link} href="/advanced" variant="outlined" size="large">
            고급 기능
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
// removed old export default;
