# @cp949/web-image-util Example App

A Next.js 15 App Router-based web application for demonstrating and testing the features of the `@cp949/web-image-util` library.

## 🚀 Quick Start

### Install Dependencies

```bash
# From root directory
pnpm install
```

### Run Development Server

```bash
# Navigate to example app directory
cd apps/exam

# Run development server
pnpm dev
```

Open `http://localhost:3000` in your browser to view the example application.

### Production Build

```bash
pnpm build
pnpm start
```

---

## 📱 Key Features

### ✨ Core Features (v2.0 API)

#### 1. **Basic Image Processing** (`/basic`)
- Resizing: Width/height settings, Fit modes (cover, contain, fill, inside, outside)
- Format conversion: JPEG, PNG, WebP
- Quality adjustment: 10-100% slider
- Advanced options: Prevent enlargement/reduction, background color settings
- Real-time preview and Before/After comparison
- Metadata display: Processing time, file size, compression ratio

**Core Features**:
- v2.0 API demo based on `processImage()` function
- Utilization of `ResultBlob`, `ResultDataURL` type system
- `ImageProcessError` error handling
- Integrated sample image selector

---

#### 2. **Preset Functions** (`/presets`)
- **Thumbnail Generation**: 50px, 100px, 150px, 200px (WebP optimized)
- **Avatar Creation**: Square, high-quality PNG (Future: circular masking, borders)
- **Social Media Images**: Optimal sizes for Instagram, Twitter, Facebook, LinkedIn, YouTube platforms

**Features**:
- `createThumbnail`, `createAvatar`, `createSocialImage` preset functions
- Automatic application of platform-specific recommended sizes
- Performance-optimized default settings

---

#### 3. **Advanced Features** (`/advanced`)
- **Watermark**: Text/image watermark composition (9 positions, opacity adjustment)
- **Filters**: Grayscale, Sepia, Brightness, Contrast, Blur (real-time preview)
- **Batch Processing**: Multiple image processing, progress indicators, ZIP download

**Features**:
- Utilization of `AdvancedImageProcessor` class
- Plugin-based filter system
- Parallel processing and performance optimization

---

### 🆕 v2.0 New Features

#### 4. **SVG Quality Comparison** (`/svg-quality-comparison`)
- Quality level comparison when converting SVG to raster images
- 4 quality levels: 1x (low), 2x (standard), 3x (high), 4x (ultra)
- Processing time and file size analysis
- Detailed comparison table and recommendations

**Core Technology**:
- Automatic quality selection based on SVG complexity (`quality: 'auto'`)
- Vector graphics quality preservation system
- Performance and quality balance optimization

---

#### 5. **Smart Format Selection** (`/smart-format`)
- JPEG, PNG, WebP format comparison
- Automatic browser support detection (WebP, AVIF, OffscreenCanvas)
- File size and compression ratio calculation
- Optimal format automatic recommendation logic

**Recommendation Algorithm**:
1. WebP support + compression ratio > 20% → **WebP**
2. Transparency required → **PNG**
3. Default → **JPEG**

---

#### 6. **Performance Benchmark** (`/performance-benchmark`)
- Small/medium/large image processing time measurement
- Memory usage monitoring (`usePerformanceMonitor` hook)
- Throughput calculation
- Benchmark results table and summary statistics

**Measurement Items**:
- Processing time (ms)
- Memory usage (MB)
- Throughput (images/sec)
- Performance score (comprehensive)

---

### 🛠️ Convenience Features

#### Sample Image Selector
- 12 sample images (4 each of JPEG, PNG, SVG)
- Format-based filtering (ALL/JPG/PNG/SVG)
- Grid preview and one-click selection
- Integrated into all major demo pages

#### Image Uploader
- Drag & drop support
- File selection button
- Integrated sample image selector
- File type and size validation

#### Before/After Comparison
- Side-by-side display of before and after processing
- Zoom and pan functionality
- Metadata display (size, file size, compression ratio)

---

## 🏗️ Project Structure

### Monorepo Structure

```
web-image-util/                    # Monorepo root
├── apps/
│   └── exam/                      # Example app (this project)
│       ├── src/
│       │   ├── app/               # Next.js 15 App Router pages
│       │   │   ├── page.tsx       # Homepage
│       │   │   ├── basic/         # Basic processing
│       │   │   ├── presets/       # Preset functions
│       │   │   ├── advanced/      # Advanced features
│       │   │   ├── svg-quality-comparison/  # SVG quality comparison
│       │   │   ├── smart-format/  # Smart format selection
│       │   │   └── performance-benchmark/   # Performance benchmark
│       │   ├── components/
│       │   │   ├── demos/         # Demo components (business logic)
│       │   │   ├── common/        # Common components (ImageUploader etc)
│       │   │   ├── ui/            # UI components (ProcessingStatus etc)
│       │   │   └── layout/        # Layout (AppLayout)
│       │   ├── hooks/             # React hooks
│       │   │   ├── useImageProcessing.ts   # Image processing hook
│       │   │   ├── usePerformanceMonitor.ts # Performance monitoring
│       │   │   └── useSampleImages.ts      # Sample image management
│       │   ├── lib/               # Utilities
│       │   │   ├── types.ts       # Common type definitions
│       │   │   └── errorHandling.ts # Error handling utilities
│       │   └── theme.ts           # Material-UI theme
│       ├── public/
│       │   └── sample-images/     # Sample images (12 files)
│       ├── docs/                  # Documentation
│       │   ├── usage-guide.md     # Usage guide
│       │   ├── best-practices.md  # Best practices
│       │   ├── migration-guide.md # Migration guide
│       │   ├── troubleshooting.md # Troubleshooting
│       │   └── performance-tips.md # Performance optimization tips
│       ├── CLAUDE.md              # Developer guide
│       └── README.md              # This file
├── sub/
│   └── web-image-util/            # Main library
├── turbo.json                     # Turbo configuration
└── pnpm-workspace.yaml            # pnpm workspace
```

---

## 🔧 Technology Stack

### Core Framework
- **Next.js 15.5.4**: App Router, Server/Client Components, React 19 support
- **React 19.1.1**: Latest React (Concurrent Features, new hooks)
- **TypeScript 5.9**: Type safety guarantee
- **Turbo**: Monorepo build orchestration

### UI/UX
- **Material-UI (MUI) 7.3**: Modern React component library
- **Emotion 11.14**: CSS-in-JS styling
- **Grid v2**: Responsive layout system

### Feature Libraries
- **React Dropzone 14.3**: Drag & drop file upload
- **Chart.js 4.5**: Performance charts and data visualization
- **JSZip 3.10**: Batch processing ZIP download

### Main Library
- **@cp949/web-image-util**: Image processing library (workspace linked)
  - Main API: `processImage()`
  - Advanced features: `@cp949/web-image-util/advanced`
  - Presets: `@cp949/web-image-util/presets`
  - Utilities: `@cp949/web-image-util/utils`

---

## 📖 Key Page Guide

### 1. Homepage (`/`)
- Library introduction and quick start guide
- v2.0 key feature highlights
- Links to all demo pages

### 2. Basic Processing (`/basic`)
- **Target**: Beginner users
- **Learning Content**: Basic API usage, Fit modes, format conversion
- **Recommended Sample**: `sample1.jpg` (landscape image)

### 3. Presets (`/presets`)
- **Target**: General users
- **Learning Content**: Thumbnail, avatar, social image generation
- **Recommended Sample**: `sample2.jpg` (portrait photo)

### 4. Advanced Features (`/advanced`)
- **Target**: Advanced users
- **Learning Content**: Watermarks, filters, batch processing
- **Recommended Sample**: `sample3.png` (product image, transparent background)

### 5. SVG Quality Comparison (`/svg-quality-comparison`)
- **Target**: SVG users
- **Learning Content**: SVG quality system, complexity-based auto selection
- **Recommended Sample**: `sample4.svg` (graphic art)

### 6. Smart Format (`/smart-format`)
- **Target**: Web optimization enthusiasts
- **Learning Content**: Browser support detection, format-specific compression comparison
- **Recommended Sample**: All formats (JPEG, PNG) available

### 7. Performance Benchmark (`/performance-benchmark`)
- **Target**: Performance optimization focused developers
- **Learning Content**: Processing time measurement, memory usage, throughput
- **Recommended Sample**: Auto-generated (small/medium/large)

---

## 💻 Development Commands

### Development Server
```bash
pnpm dev          # Run development server (http://localhost:3000)
```

### Build
```bash
pnpm build        # Production build
pnpm start        # Run production server
```

### Quality Verification
```bash
pnpm typecheck    # TypeScript type check
pnpm lint         # ESLint linting
```

---

## 🎨 Design System

### Material-UI 7.3 Components

- **Layout**: Container, Grid (v2), Stack, Box
- **Input**: TextField, Button, Switch, Slider, Select
- **Display**: Card, Typography, Alert, CircularProgress
- **Navigation**: Drawer, List, ListItem, Divider

### Theme Configuration

```typescript
// src/theme.ts
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },    // Material Blue
    secondary: { main: '#dc004e' },  // Material Pink
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  }
});
```

### Responsive Breakpoints

- **xs**: 0px (mobile)
- **sm**: 600px (tablet)
- **md**: 900px (small desktop)
- **lg**: 1200px (large desktop)
- **xl**: 1536px (extra large)

---

## 📚 Documentation

### Example App Documentation

- **[Usage Guide](./docs/usage-guide.md)**: Detailed usage by feature
- **[Best Practices](./docs/best-practices.md)**: Recommendations and optimization
- **[Migration Guide](./docs/migration-guide.md)**: v1.x → v2.0 migration
- **[Troubleshooting](./docs/troubleshooting.md)**: Problem-solving guide
- **[Performance Tips](./docs/performance-tips.md)**: Performance improvement methods

### Main Library Documentation

- **[Main README](../../sub/web-image-util/README.md)**: Complete library documentation
- **[CLAUDE.md](./CLAUDE.md)**: Developer guide (for AI assistants)

---

## 🔒 Security Considerations

### File Upload Security
- **File Type Validation**: MIME type + extension verification
- **File Size Limits**: Default 10MB
- **Safe SVG Processing**: Prevent script execution (raster conversion)

### XSS Prevention
- **Input Validation**: User input data validation
- **Safe Rendering**: Leverage React's automatic escaping
- **CSP**: Content Security Policy application (production)

---

## 🌐 Browser Compatibility

### Supported Browsers (Recommended)
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Browser Feature Detection
```typescript
import { detectBrowserSupport } from '@cp949/web-image-util/utils';

const support = await detectBrowserSupport();
console.log('WebP support:', support.webp);
console.log('AVIF support:', support.avif);
console.log('OffscreenCanvas support:', support.offscreenCanvas);
```

### Fallback Strategy
- **WebP not supported**: Automatic fallback to JPEG
- **OffscreenCanvas not supported**: Fallback to Canvas 2D
- **Download attribute not supported**: window.open() fallback

---

## ⚡ Performance Optimization

### 1. Image Optimization
- Prioritize WebP format (when browser supports)
- Appropriate quality settings (80-85%)
- Lazy loading for sample images

### 2. Next.js Optimization
- Utilize App Router's Server Components
- Code splitting with dynamic imports
- Image optimization (next/image)

### 3. Memory Management
- Automatic Canvas Pool management (library)
- Sequential processing recommended (bulk images)
- Cleanup after URL.createObjectURL() usage

### 4. Bundle Optimization
- Tree Shaking (ES Modules)
- Import only necessary subpackages
- Reduce initial loading with dynamic imports

---

## 🐛 Known Issues

### 1. Next.js 15 + React 19
- Some MUI components show hydration warnings (development environment)
- Works normally in production builds

### 2. iOS Safari
- WebP support (Safari 14+)
- Download attribute not supported (fallback implemented)

### 3. Large Image Processing
- Recommend 2-stage resizing for images over 4096px
- Browser tab may crash when memory insufficient

---

## 🤝 Contributing

### Development Environment Setup

```bash
# Clone repository
git clone https://github.com/YOUR_REPO/web-image-util.git
cd web-image-util

# Install dependencies
pnpm install

# Run example app development server
cd apps/exam
pnpm dev
```

### Adding New Demo Pages

1. Create `src/app/your-feature/page.tsx`
2. Create `src/components/demos/YourFeatureDemo.tsx`
3. Add navigation item to `src/components/layout/AppLayout.tsx`
4. Integrate sample image selector (recommended)
5. Update documentation (`docs/usage-guide.md`)

### Coding Rules
- **TypeScript Strict Mode** compliance
- **Follow ESLint settings**
- **Korean comments** recommended
- **Write test code** (recommended)

---

## 📝 License

MIT License

---

## 🔗 Related Links

- **Main Library**: [@cp949/web-image-util](../../sub/web-image-util/README.md)
- **NPM Package**: [https://www.npmjs.com/package/@cp949/web-image-util](https://www.npmjs.com/package/@cp949/web-image-util)
- **GitHub Repository**: GitHub link (to be released)

---

## 🆘 Support

### Documentation
- [Usage Guide](./docs/usage-guide.md)
- [Best Practices](./docs/best-practices.md)
- [Troubleshooting](./docs/troubleshooting.md)

### Issue Reporting
- GitHub Issues (to be released)
- Bug reports and feature suggestions

---

**Happy Coding! 🎉**