# @cp949/web-image-util

> 🎨 High-performance TypeScript library for image processing in modern web browsers

A browser-native image processing library built on Canvas 2D API with intuitive chaining API pattern for web browser environments.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

## ✨ Key Features

- **🔗 Chainable API**: Intuitive method chaining pattern
- **🎯 Complete Type Safety**: Full TypeScript support with discriminated union types
- **🌐 Browser Native**: Canvas API-based, zero external dependencies
- **📦 Tree-shakable**: ES modules for optimal bundle size
- **⚡ High Performance**: Canvas pooling and memory optimization
- **🎨 Modern Formats**: WebP, JPEG, PNG support (AVIF with browser support)
- **📱 Responsive Ready**: Optimized for various screen sizes and devices
- **🖼️ Advanced SVG**: High-quality SVG processing with vector preservation

## 🚀 Quick Start

```bash
npm install @cp949/web-image-util
```

```typescript
import { processImage } from '@cp949/web-image-util';

// 🆕 Recommended: New ResizeConfig API
const thumbnail = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// Advanced image processing
const result = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600, background: '#ffffff' })
  .blur(2)
  .toBlob({ format: 'webp', quality: 0.8 });

// Social media image
const instagramPost = await processImage(source)
  .resize({ fit: 'cover', width: 1080, height: 1080 })
  .toFile('instagram-post.jpg');
```


## 📚 Library Architecture

This is a **monorepo** built with **Turbo** and **pnpm workspaces**, containing:

- **Core Library** (`sub/web-image-util/`) - The main image processing package
- **Demo App** (`apps/exam/`) - Interactive Next.js application showcasing all features
- **Shared Configs** (`sub/typescript-config/`) - Shared TypeScript configuration

## 📦 Core Library Features

The main library provides comprehensive image processing capabilities:

### 🎯 **Advanced Resize Engine**

```typescript
// Precise size control with 5 fit modes
processImage(source).resize({ fit: 'cover', width: 300, height: 200 })   // Crop to fit (maintain ratio, fill area)
processImage(source).resize({ fit: 'contain', width: 300, height: 200 }) // Fit within bounds (show full image)
processImage(source).resize({ fit: 'fill', width: 300, height: 200 })    // Stretch to exact size (ignore ratio)

// Smart size constraints (shrink only, no enlargement)
processImage(source).resize({ fit: 'maxFit', width: 800, height: 600 })  // Max 800x600 bounds
processImage(source).resize({ fit: 'maxFit', width: 800 })               // Max width 800px
processImage(source).resize({ fit: 'maxFit', height: 600 })              // Max height 600px

// Size guarantee (enlarge only, no shrinking)
processImage(source).resize({ fit: 'minFit', width: 400, height: 300 })  // Min 400x300 guarantee
processImage(source).resize({ fit: 'minFit', width: 300 })               // Min width 300px guarantee
```

### 🎨 **Image Effects & Filters**

```typescript
// Basic blur effect
const blurred = await processImage(source)
  .resize({ fit: 'cover', width: 400, height: 300 })
  .blur(2)  // Blur radius 2px
  .toBlob();

// Advanced features (advanced subpackage) - Watermarks
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// Text watermark
const canvas = await processImage(source).resize({ fit: 'cover', width: 400, height: 300 }).toCanvas();
const watermarked = SimpleWatermark.addText(canvas, {
  text: '© 2024 Company Name',
  position: 'bottom-right',
  style: 'white-shadow'
});
```

### 📤 **Output Formats & Optimization**

```typescript
// Multiple output types (extended)
const blob = await processImage(source).toBlob({ format: 'webp', quality: 0.8 });
const dataURL = await processImage(source).toDataURL({ format: 'jpeg', quality: 0.9 });
const file = await processImage(source).toFile('image.png');
const canvas = await processImage(source).toCanvas();
const element = await processImage(source).toElement();     // HTMLImageElement
const arrayBuffer = await processImage(source).toArrayBuffer(); // ArrayBuffer
const uint8Array = await processImage(source).toUint8Array();   // Uint8Array

// Format-optimized settings
const webpResult = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob({ format: 'webp', quality: 0.8 });  // WebP for high compression

const jpegResult = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob({ format: 'jpeg', quality: 0.85 }); // JPEG for photos
```

### 🎛️ **Convenience Functions (Presets)**

```typescript
import { createThumbnail, createAvatar, createSocialImage } from '@cp949/web-image-util/presets';

// Quick thumbnail generation
const thumbnail = await createThumbnail(source, {
  size: 150,
  format: 'webp',
  quality: 0.8
});

// Avatar image (square + rounded)
const avatar = await createAvatar(source, {
  size: 120,
  background: '#f0f0f0'
});

// Social media formats
const igPost = await createSocialImage(source, { platform: 'instagram' });
const fbCover = await createSocialImage(source, { platform: 'facebook' });
```

### ⚡ **Batch Processing**

```typescript
// Parallel processing (using Promise.all)
const sources = [image1, image2, image3];

const results = await Promise.all(
  sources.map(source =>
    processImage(source)
      .resize({ fit: 'cover', width: 300, height: 200 })
      .toBlob({ format: 'webp', quality: 0.8 })
  )
);

// Sequential processing (memory efficient)
const batchResults = [];
for (const source of sources) {
  const result = await processImage(source)
    .resize({ fit: 'cover', width: 400, height: 300 })
    .toBlob();
  batchResults.push(result);
}
```

### 🛠️ **Utilities & Conversion**

```typescript
import {
  convertToBlob,
  convertToDataURL,
  convertToFile,
  convertToElement,
  detectBrowserCapabilities,
  enhanceBrowserCompatibility,
} from '@cp949/web-image-util';

// SVG compatibility enhancement
const { enhanced, report } = enhanceBrowserCompatibility(svgString, {
  fixDimensions: true,
  addNamespaces: true
});

// Convert image source to HTMLImageElement
const imageElement = await convertToElement(blob);

// Direct conversion (without chaining)
const blob = await convertToBlob(canvas, { format: 'webp', quality: 0.8 });

// Browser feature support detection
const capabilities = await detectBrowserCapabilities();
console.log('WebP support:', capabilities.webp);
console.log('AVIF support:', capabilities.avif);
console.log('OffscreenCanvas support:', capabilities.offscreenCanvas);
```

---

## 🖥️ Interactive Demo Application

### 📱 **Live Demo & Testing Platform**

A comprehensive Next.js 15 application built with React 19 and Material-UI, showcasing all library features in a real web environment.

**🌐 Live Demo**: [Start here](http://localhost:3000) (after running `pnpm dev`)

#### 🎨 **Feature Demo Pages**

1. **🏠 Homepage**
   - Library overview and key features
   - Quick start guide
   - Live code examples

2. **📐 Basic Processing**
   - Resize fit mode comparison (cover, contain, fill, maxFit, minFit)
   - Real-time preview with Before/After comparison
   - Interactive size adjustment sliders

3. **🎨 Advanced Features**
   - Watermark addition (text/image)
   - Image composition and layer management
   - Blur effects and basic filters

4. **📱 Presets**
   - Social media format auto-conversion
   - Thumbnail generator
   - Avatar creator

5. **🔄 Converters**
   - Format conversion (JPEG ↔ PNG ↔ WebP)
   - Quality adjustment and compression comparison
   - File size optimization

6. **📦 Batch Processing**
   - Multi-file upload
   - Bulk conversion and ZIP download
   - Progress indicators and performance stats

7. **⚡ Performance Testing**
   - Processing time benchmarks
   - Memory usage analysis
   - Large image processing tests

8. **🛠️ Developer Tools**
   - Image metadata display
   - Debug information and logs
   - API call monitoring

9. **🎯 Filter System**
   - Plugin-based filter architecture
   - Custom filter creation
   - Filter chains and presets

10. **🖼️ SVG Compatibility**
    - SVG rasterization
    - Compatibility enhancement options
    - Cross-browser rendering comparison

#### 🎛️ **Interactive UI Features**

- **Drag & Drop File Upload**: Intuitive file selection with visual feedback
- **Real-time Parameter Sliders**: Instant preview of processing changes
- **Before/After Comparison View**: Side-by-side result comparison
- **Code Generator**: Shows current settings as executable code
- **Multi-format Download**: Export results in various formats
- **Responsive Design**: Optimized for desktop/tablet/mobile
- **Modern Material-UI 7.3**: Clean, accessible interface
- **Dark/Light Theme**: User preference support
- **WCAG 2.1 Compliance**: Full accessibility standards

#### 🚀 **Running the Demo App**

```bash
# Install all dependencies from root
pnpm install

# Start development server (recommended)
pnpm dev

# Or run individually
cd apps/exam
pnpm dev
```

**🌐 Demo URL**: `http://localhost:3000`

#### 📱 **Tech Stack (2025 Latest)**

| Technology      | Version | Purpose                    |
| --------------- | ------- | -------------------------- |
| **React**       | 19.1.1  | Latest Concurrent Features |
| **Next.js**     | 15.5.4  | App Router & SSR           |
| **Material-UI** | 7.3.x   | Modern component library   |
| **TypeScript**  | 5.9.x   | Latest type system         |
| **Emotion**     | 11.14.x | CSS-in-JS styling          |
| **Chart.js**    | 4.5.x   | Performance visualization  |

#### 🎯 **Learn by Example Patterns**

```typescript
// 1. Basic usage pattern
const handleImageProcess = async (file: File) => {
  const result = await processImage(file)
    .resize({ fit: 'cover', width: 800, height: 600 })
    .toBlob({ format: 'webp', quality: 0.8 });

  setProcessedImage(URL.createObjectURL(result.blob));
};

// 2. Advanced filter chain
const applyArtisticEffect = async (source: File) => {
  const processor = processImage(source);

  // Multiple effect combination
  const result = await processor
    .resize({ fit: 'cover', width: 1024, height: 1024 })
    .blur(1)
    .toBlob({ format: 'jpeg', quality: 0.9 });

  return result;
};

// 3. Batch processing pattern
const processBatch = async (files: File[]) => {
  const results = await Promise.all(
    files.map(file =>
      processImage(file)
        .resize({ fit: 'cover', width: 300, height: 300 })
        .toBlob({ format: 'webp' })
    )
  );

  return results;
};
```

---

## 🏗️ Monorepo Structure

```
web-image-util/
├── 📦 sub/
│   ├── web-image-util/          # 🎯 Main library package
│   │   ├── src/
│   │   │   ├── index.ts         # Core API
│   │   │   ├── advanced-index.ts # Advanced features
│   │   │   ├── presets/         # Convenience functions
│   │   │   ├── utils/           # Utilities
│   │   │   ├── filters/         # Filter system
│   │   │   └── composition/     # Image composition
│   │   ├── tests/               # 106 test cases
│   │   └── README.md            # 📚 Complete API documentation
│   └── typescript-config/       # Shared TypeScript configuration
├── 🖥️ apps/
│   └── exam/                    # 📱 Next.js demo application
│       ├── src/
│       │   ├── app/             # Next.js 15 App Router pages
│       │   ├── components/      # Shared UI components
│       │   └── hooks/           # Custom hooks
│       ├── package.json
│       └── README.md            # 🎨 UI development guide
├── README.md                    # 📖 This file (project overview)
├── package.json                 # Workspace configuration
└── turbo.json                   # Build pipeline configuration
```

## 🛠️ Development Guide

### 📋 **Development Commands**

```bash
# 🏗️ Build
pnpm build              # Build all packages
pnpm build:watch        # Build in watch mode

# 🧪 Testing
pnpm test               # Run all tests
pnpm test:coverage      # Run with coverage
pnpm test:ui            # Run in UI mode

# 🔍 Quality Checks
pnpm typecheck          # TypeScript type checking
pnpm lint               # Biome linting
pnpm lint:fix           # Auto-fix Biome issues
pnpm format             # Biome formatting

# 🚀 Development Server
pnpm dev                # Start demo app dev server

# 📦 Publishing
pnpm version:patch      # Patch version update
pnpm version:minor      # Minor version update
pnpm publish            # Publish to npm
```

### 🎯 **Performance Targets**

- **📊 Test Coverage**: 90%+ overall
- **⚡ Bundle Size**: Main module < 50KB (gzipped)
- **🏃 Processing Speed**: 1080p image < 500ms
- **💾 Memory Efficiency**: Canvas pooling for memory reuse

### 🌐 **Browser Support**

| Browser     | Min Version | Key Features          |
| ----------- | ----------- | --------------------- |
| **Chrome**  | 88+         | WebP, OffscreenCanvas |
| **Firefox** | 90+         | WebP support          |
| **Safari**  | 14+         | WebP support          |
| **Edge**    | 88+         | Full support          |

**Required APIs**:
- Canvas 2D Context ✅
- FileReader API ✅
- Blob/File API ✅
- Web Workers (performance boost) 🔧

## 📚 Documentation

- **📖 [Library API Documentation](sub/web-image-util/README.md)** - Complete API reference
- **🎨 [Demo App Guide](apps/exam/README.md)** - UI development and integration guide

## 🌟 Key Technical Highlights

### 🎯 **SVG Processing Excellence**
Our **SVG detection and processing logic** is the technical crown jewel of this library:
- **Precise Detection**: Advanced content sniffing beyond simple MIME type checking
- **Browser Compatibility**: Automatic SVG enhancement for cross-browser support
- **Vector Preservation**: High-quality SVG-to-canvas rendering pipeline
- **XSS Prevention**: Security-focused SVG sanitization

### ⚡ **Performance Engineering**
- **Canvas Pooling**: Reusable canvas instances for memory efficiency
- **Lazy Rendering**: Deferred processing until final output
- **Smart Format Selection**: Automatic WebP/AVIF fallback based on browser support
- **Memory Optimization**: Intelligent cleanup and resource management

### 🔒 **Type Safety & DX**
- **Discriminated Unions**: Compile-time safety for resize configurations
- **Method Chaining**: Intuitive chaining API design
- **Tree Shaking**: ES modules for optimal bundle size
- **Zero Dependencies**: Pure Canvas 2D API implementation

## 📊 Project Stats

- **📝 Source Files**: 65 TypeScript files
- **🧪 Test Coverage**: 12 comprehensive test suites
- **📦 Current Version**: v2.0.25
- **🎯 TypeScript**: 5.9+ with strict mode
- **⚡ Build System**: Turbo + tsup for optimal performance

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- 📦 [npm Package](https://www.npmjs.com/package/@cp949/web-image-util)
- 💻 [GitHub Repository](https://github.com/cp949/web-image-util)
- 🐛 [Issue Tracker](https://github.com/cp949/web-image-util/issues)
- 📊 [Release Notes](https://github.com/cp949/web-image-util/releases)

---

**Made with ❤️ for the web development community**
